import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAiProvider } from '../ai-agents/openai.provider';
import {
  GovernmentService,
  activity,
  hash,
  invalidate,
  lockTender,
} from './government.service';
import {
  TenderAnalysisService,
  governmentPrompt,
} from './tender-analysis.service';
import * as S from './government.schemas';

export function assertReady(workspace: {
  technicalApprovalStatus: string;
  documentApprovalStatus: string;
  commercialApprovalStatus: string;
}) {
  if (
    [
      workspace.technicalApprovalStatus,
      workspace.documentApprovalStatus,
      workspace.commercialApprovalStatus,
    ].some((s) => s !== 'APPROVED')
  )
    throw new BadRequestException(
      'Technical, document and commercial approvals are all required.',
    );
}

@Injectable()
export class BidWorkspaceService {
  constructor(
    private db: PrismaService,
    private ai: OpenAiProvider,
    private government: GovernmentService,
    private analysis: TenderAnalysisService,
  ) {}
  async find(id: string) {
    const w = await this.db.bidWorkspace.findUnique({
      where: { id },
      include: { sections: { orderBy: { id: 'asc' } } },
    });
    if (!w) throw new NotFoundException('Workspace not found');
    return w;
  }
  list() {
    return this.db.bidWorkspace.findMany({
      include: {
        tender: {
          select: { id: true, title: true, bidNumber: true, closesAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  async create(tenderId: string, actor: string) {
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, tenderId);
      const existing = await tx.bidWorkspace.findUnique({
        where: { tenderId },
        include: { sections: true },
      });
      if (existing) return existing;
      const workspace = await tx.bidWorkspace.create({
        data: { tenderId, createdById: actor, updatedById: actor },
        include: { sections: true },
      });
      await tx.tender.update({
        where: { id: tenderId },
        data: { status: 'BID_PREPARATION' },
      });
      await activity(tx, actor, 'BID_WORKSPACE_CREATED', tenderId, {
        workspaceId: workspace.id,
      });
      return workspace;
    });
  }
  async generate(tenderId: string, actor: string, sectionType?: string) {
    const tender = await this.government.detail(tenderId);
    if (!tender.workspace || !tender.analysis)
      throw new BadRequestException(
        'Create workspace and analyze tender first',
      );
    const context = await this.analysis.context(tenderId);
    if (tender.analysis.inputHash !== hash(context))
      throw new BadRequestException(
        'Analysis is stale. Reanalyze after tender/company changes.',
      );
    const input = {
      ...context,
      analysis: tender.analysis.rawStructuredResult,
      requestedSection: sectionType ?? 'all relevant sections',
    };
    const result = S.parse(
      S.bidOutput,
      await this.ai.createStrictJsonCompletion<unknown>({
        systemPrompt:
          governmentPrompt +
          ' Generate an editable technical bid, only relevant sections. Each factual claim must be grounded in the supplied records. Clearly label proposed approaches versus verified capabilities. Include [NEEDS COMPANY INPUT] for missing company commitments and facts. Do not assert compliance or approval. No financial price submission.',
        userPrompt: JSON.stringify(input),
        jsonSchema: {
          name: 'government_technical_bid',
          schema: z.toJSONSchema(S.bidOutput),
        },
      }),
    );
    if (
      new Set(result.sections.map((s) => s.sectionType)).size !==
      result.sections.length
    )
      throw new BadRequestException('AI returned duplicate sections');
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, tenderId);
      if (hash(await this.analysis.context(tenderId)) !== hash(context))
        throw new ConflictException(
          'Tender evidence changed during generation. Reanalyze and retry.',
        );
      for (const section of result.sections) {
        if (sectionType && section.sectionType !== sectionType) continue;
        await tx.bidSection.upsert({
          where: {
            bidWorkspaceId_sectionType: {
              bidWorkspaceId: tender.workspace!.id,
              sectionType: section.sectionType,
            },
          },
          create: {
            bidWorkspaceId: tender.workspace!.id,
            sectionType: section.sectionType,
            generatedContent: section.content,
          },
          update: {
            generatedContent: section.content,
            version: { increment: 1 },
            status: 'DRAFT',
          },
        });
      }
      await invalidate(tx, tenderId, actor, 'technical');
      await activity(tx, actor, 'TECHNICAL_BID_GENERATED', tenderId, {
        sectionType: sectionType ?? 'all',
        humanEditsPreserved: true,
      });
      return { generated: true };
    });
  }
  async edit(id: string, sectionId: string, input: unknown, actor: string) {
    const data = S.parse(S.sectionInput, input);
    const w = await this.find(id);
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, w.tenderId);
      const result = await tx.bidSection.updateMany({
        where: { id: sectionId, bidWorkspaceId: id, version: data.version },
        data: {
          editedContent: data.editedContent,
          version: { increment: 1 },
          status: 'EDITED',
        },
      });
      if (!result.count)
        throw new ConflictException(
          'Section changed or does not exist. Refresh before saving.',
        );
      await invalidate(tx, w.tenderId, actor, 'technical');
      await activity(tx, actor, 'BID_SECTION_EDITED', w.tenderId, {
        sectionId,
        version: data.version + 1,
      });
      return result;
    });
  }
  async commercial(id: string) {
    await this.find(id);
    return this.db.commercialWorksheet.findUnique({
      where: { bidWorkspaceId: id },
    });
  }
  async saveCommercial(id: string, input: unknown, actor: string) {
    const data = S.parse(S.commercialInput, input);
    const w = await this.find(id);
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, w.tenderId);
      const result = await tx.commercialWorksheet.upsert({
        where: { bidWorkspaceId: id },
        create: { bidWorkspaceId: id, ...data },
        update: data,
      });
      await invalidate(tx, w.tenderId, actor, 'commercial');
      await activity(tx, actor, 'COMMERCIAL_UPDATED', w.tenderId, {
        workspaceId: id,
      });
      return result;
    });
  }
  private async checkDocuments(tx: Prisma.TransactionClient, tenderId: string) {
    const tender = await tx.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        analysis: true,
        eligibility: true,
        compliance: { include: { companyDocument: true } },
        documents: true,
      },
    });
    if (!tender.analysis)
      throw new BadRequestException('Tender analysis required');
    if (
      tender.analysis.inputHash !== hash(await this.analysis.context(tenderId))
    )
      throw new BadRequestException(
        'Tender analysis is stale. Reanalyze and review before approval.',
      );
    if (tender.documents.some((d) => d.processingStatus !== 'PROCESSED'))
      throw new BadRequestException('Unprocessed tender documents remain');
    if (
      tender.eligibility.some(
        (i) =>
          !['COMPLIANT', 'NOT_APPLICABLE'].includes(i.status) ||
          !i.confirmedById,
      ) ||
      tender.compliance.some(
        (i) =>
          !['COMPLIANT', 'NOT_APPLICABLE'].includes(i.complianceStatus) ||
          !i.confirmedById,
      )
    )
      throw new BadRequestException(
        'Resolve and confirm all eligibility and compliance items',
      );
    for (const i of tender.compliance) {
      const doc = i.companyDocument;
      if (
        doc &&
        (doc.status !== 'AVAILABLE' ||
          !doc.storageKey ||
          (doc.expiryDate && doc.expiryDate < new Date()))
      )
        throw new BadRequestException(
          'Linked evidence is unavailable or expired',
        );
    }
    const output = S.parse(
      S.analysisOutput,
      tender.analysis.rawStructuredResult,
    );
    const docs = await tx.companyDocument.findMany({
      where: {
        status: 'AVAILABLE',
        storageKey: { not: null },
        OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
      },
    });
    if (
      output.requiredDocuments.some(
        (r) =>
          docs.filter((d) => d.documentType === r.documentType).length <
          r.count,
      )
    )
      throw new BadRequestException('Required company documents are missing');
  }
  async approve(
    id: string,
    area: 'technical' | 'documents' | 'commercial',
    actor: string,
  ) {
    const w = await this.find(id);
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, w.tenderId);
      const current = await tx.bidWorkspace.findUniqueOrThrow({
        where: { id },
        include: { sections: true, commercial: true },
      });
      if (area === 'technical') {
        if (
          !current.sections.length ||
          current.sections.some((s) =>
            /NEEDS COMPANY INPUT/i.test(s.editedContent ?? s.generatedContent),
          )
        )
          throw new BadRequestException(
            'Complete all technical sections and missing company input before approval',
          );
      }
      if (area === 'documents') await this.checkDocuments(tx, w.tenderId);
      if (area === 'commercial' && current.commercial?.approvedQuote == null)
        throw new BadRequestException('Approved quote is required');
      const data =
        area === 'technical'
          ? { technicalApprovalStatus: 'APPROVED' as const }
          : area === 'documents'
            ? { documentApprovalStatus: 'APPROVED' as const }
            : { commercialApprovalStatus: 'APPROVED' as const };
      await activity(tx, actor, `${area.toUpperCase()}_APPROVED`, w.tenderId, {
        workspaceId: id,
      });
      return tx.bidWorkspace.update({
        where: { id },
        data: { ...data, updatedById: actor },
      });
    });
  }
  async status(id: string, input: unknown, actor: string) {
    const { status } = S.parse(S.workspaceInput, input);
    const w = await this.find(id);
    if (status === 'SUBMITTED_MANUALLY')
      throw new BadRequestException('Use mark-submitted with portal reference');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Tender" WHERE id = ${w.tenderId} FOR UPDATE`;
      const current = await tx.bidWorkspace.findUniqueOrThrow({
        where: { id },
      });
      if (['WON', 'LOST'].includes(status)) {
        if (current.status !== 'SUBMITTED_MANUALLY')
          throw new BadRequestException(
            'Only submitted bids can be marked won/lost',
          );
      } else {
        await lockTender(tx, w.tenderId);
      }
      if (status === 'READY_FOR_SUBMISSION') {
        assertReady(current);
        await this.checkDocuments(tx, w.tenderId);
        const tender = await tx.tender.findUniqueOrThrow({
          where: { id: w.tenderId },
        });
        if (tender.closesAt && tender.closesAt <= new Date())
          throw new BadRequestException('Tender deadline has passed');
      }
      const tenderStatus =
        status === 'READY_FOR_SUBMISSION'
          ? 'READY_FOR_SUBMISSION'
          : status === 'WON'
            ? 'AWARDED'
            : status === 'LOST'
              ? 'LOST'
              : status === 'NOT_PURSUED'
                ? 'NOT_PURSUING'
                : 'INTERNAL_REVIEW';
      await tx.tender.update({
        where: { id: w.tenderId },
        data: { status: tenderStatus },
      });
      await activity(tx, actor, 'BID_STATUS_CHANGED', w.tenderId, {
        from: current.status,
        to: status,
      });
      if (status === 'READY_FOR_SUBMISSION')
        await tx.governmentNotification.upsert({
          where: { key: `ready:${id}` },
          update: {
            message: 'Bid ready for manual portal submission',
            readAt: null,
          },
          create: {
            key: `ready:${id}`,
            tenderId: w.tenderId,
            message: 'Bid ready for manual portal submission',
          },
        });
      return tx.bidWorkspace.update({
        where: { id },
        data: { status, updatedById: actor },
      });
    });
  }
  async submitted(id: string, input: unknown, actor: string) {
    const data = S.parse(S.submissionInput, input);
    if (data.submittedAt > new Date())
      throw new BadRequestException('Submission date cannot be in the future');
    const w = await this.find(id);
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, w.tenderId);
      const current = await tx.bidWorkspace.findUniqueOrThrow({
        where: { id },
      });
      if (current.status !== 'READY_FOR_SUBMISSION')
        throw new BadRequestException('Bid must be ready for submission');
      assertReady(current);
      await this.checkDocuments(tx, w.tenderId);
      await tx.tender.update({
        where: { id: w.tenderId },
        data: { status: 'SUBMITTED' },
      });
      await activity(tx, actor, 'SUBMITTED_MANUALLY', w.tenderId, data);
      return tx.bidWorkspace.update({
        where: { id },
        data: {
          ...data,
          status: 'SUBMITTED_MANUALLY',
          submittedById: actor,
          updatedById: actor,
        },
      });
    });
  }
}
