import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TenderStatus } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { adapterFor, relevance } from './tender-source.adapter';
import * as S from './government.schemas';

export const documentSelect = {
  id: true,
  tenderId: true,
  documentType: true,
  name: true,
  sourceUrl: true,
  mimeType: true,
  size: true,
  sha256: true,
  processingStatus: true,
  processingError: true,
  createdAt: true,
} as const;
export const tenderInclude = {
  source: true,
  documents: { select: documentSelect },
  analysis: true,
  eligibility: true,
  compliance: {
    include: {
      companyDocument: {
        select: { id: true, name: true, status: true, expiryDate: true },
      },
    },
  },
  workspace: { include: { sections: true } },
  revisions: { orderBy: { createdAt: 'desc' as const }, take: 100 },
  activities: { orderBy: { createdAt: 'desc' as const }, take: 100 },
};
export const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const openStatuses: TenderStatus[] = [
  'NEW',
  'RELEVANCE_REVIEW',
  'ANALYZED',
  'QUALIFICATION_PENDING',
  'QUALIFIED',
  'BID_PREPARATION',
  'INTERNAL_REVIEW',
  'READY_FOR_SUBMISSION',
];

// Every preparation mutation takes the same database row lock as approvals.
// This keeps edits from racing with readiness/submission checks.
export async function lockTender(
  tx: Prisma.TransactionClient,
  tenderId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Tender" WHERE id = ${tenderId} FOR UPDATE`;
  const tender = await tx.tender.findUnique({ where: { id: tenderId } });
  if (!tender) throw new NotFoundException('Tender not found');
  if (['SUBMITTED', 'AWARDED', 'LOST'].includes(tender.status))
    throw new ConflictException('Submitted bid records are locked.');
  return tender;
}
export async function invalidate(
  tx: Prisma.TransactionClient,
  tenderId: string,
  actor: string,
  area: 'all' | 'technical' | 'document' | 'commercial' = 'all',
) {
  const data: Prisma.BidWorkspaceUpdateManyMutationInput = {
    status: 'IN_PREPARATION',
    updatedById: actor,
  };
  if (area === 'all' || area === 'technical')
    data.technicalApprovalStatus = 'PENDING';
  if (area === 'all' || area === 'document')
    data.documentApprovalStatus = 'PENDING';
  if (area === 'all' || area === 'commercial')
    data.commercialApprovalStatus = 'PENDING';
  await tx.bidWorkspace.updateMany({ where: { tenderId }, data });
  await tx.tender.updateMany({
    where: { id: tenderId, status: 'READY_FOR_SUBMISSION' },
    data: { status: 'INTERNAL_REVIEW' },
  });
}
export function activity(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  action: string,
  tenderId?: string,
  metadata?: unknown,
) {
  return tx.governmentActivity.create({
    data: {
      actorUserId,
      action,
      tenderId,
      metadata: metadata === undefined ? undefined : json(metadata),
    },
  });
}

@Injectable()
export class GovernmentService {
  constructor(readonly db: PrismaService) {}
  sources() {
    return this.db.tenderSource.findMany({ orderBy: { name: 'asc' } });
  }
  async source(id: string) {
    const source = await this.db.tenderSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Source not found');
    return source;
  }
  createSource(input: unknown) {
    const data = S.parse(S.sourceInput, input);
    return this.db.tenderSource.create({ data });
  }
  async updateSource(id: string, input: unknown) {
    await this.source(id);
    const data = S.parse(S.sourceInput.partial(), input);
    return this.db.tenderSource.update({ where: { id }, data });
  }
  async testSource(id: string) {
    const s = await this.source(id);
    return adapterFor(s.integrationType).test(
      S.parse(S.sourceConfig, s.configJson),
    );
  }
  async syncSource(id: string) {
    const s = await this.source(id);
    if (s.status !== 'ACTIVE')
      throw new BadRequestException('Source is disabled');
    const result = await this.testSource(id);
    await this.db.tenderSource.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'MANUAL_REQUIRED',
        lastSyncMessage: result.message,
      },
    });
    return {
      ...result,
      status: 'MANUAL_REQUIRED',
      fetched: 0,
      relevant: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
  }
  async intake(input: unknown, actor: string) {
    const parsed = S.parse(S.tenderInput, input);
    const source = await this.source(parsed.tenderSourceId);
    if (source.status !== 'ACTIVE')
      throw new BadRequestException('Source is disabled');
    if (!parsed.title && !parsed.bidNumber && !parsed.sourceUrl)
      throw new BadRequestException('Provide title, bid number or URL');
    const externalId =
      (parsed.externalId || parsed.bidNumber)?.trim().toUpperCase() ||
      (parsed.sourceUrl ? new URL(parsed.sourceUrl).href : randomUUID());
    const capabilities = await this.db.companyCapability.findMany({
      where: { active: true },
    });
    const classified = relevance(
      `${parsed.title ?? ''} ${parsed.description ?? ''} ${parsed.scopeOfWork ?? ''}`,
      S.parse(S.sourceConfig, source.configJson),
      capabilities,
    );
    const data = {
      ...parsed,
      externalId,
      title:
        parsed.title ||
        parsed.bidNumber ||
        'Imported tender — details required',
      ...classified,
      lastSyncedAt: new Date(),
    };
    return this.db.$transaction(async (tx) => {
      // Serializes same-source imports, including the first insert.
      await tx.$queryRaw`SELECT id FROM "TenderSource" WHERE id = ${source.id} FOR UPDATE`;
      const existing = await tx.tender.findUnique({
        where: {
          tenderSourceId_externalId: { tenderSourceId: source.id, externalId },
        },
      });
      if (existing) {
        await lockTender(tx, existing.id);
        return this.updateInTransaction(
          tx,
          existing.id,
          { ...parsed, externalId },
          actor,
        );
      }
      const tender = await tx.tender.create({ data });
      await activity(tx, actor, 'TENDER_IMPORTED', tender.id);
      return tender;
    });
  }
  async list(input: unknown) {
    const q = S.parse(S.listInput, input);
    const where: Prisma.TenderWhereInput = {
      tenderSourceId: q.source,
      status: q.status,
      ministry: q.ministry,
      department: q.department,
      state: q.state,
      serviceCategory: q.serviceCategory,
      tenderType: q.tenderType,
    };
    if (q.search)
      where.OR = ['title', 'bidNumber', 'buyerName'].map((key) => ({
        [key]: { contains: q.search, mode: 'insensitive' },
      }));
    if (q.closingFrom || q.closingTo || q.closingSoon)
      where.closesAt = {
        gte: q.closingFrom ?? (q.closingSoon ? new Date() : undefined),
        lte:
          q.closingTo ??
          (q.closingSoon
            ? new Date(Date.now() + q.closingSoon * 86400000)
            : undefined),
      };
    if (q.estimatedValueMin != null || q.estimatedValueMax != null)
      where.estimatedValue = {
        gte: q.estimatedValueMin ?? undefined,
        lte: q.estimatedValueMax ?? undefined,
      };
    for (const key of [
      'emdRequired',
      'msePreference',
      'startupPreference',
    ] as const)
      if (q[key]) where[key] = q[key] === 'true';
    if (q.matchClassification || q.minScore !== undefined)
      where.analysis = {
        matchClassification: q.matchClassification,
        overallMatchScore: { gte: q.minScore },
      };
    if (q.eligibilityStatus)
      where.eligibility = { some: { status: q.eligibilityStatus } };
    const [items, total] = await this.db.$transaction([
      this.db.tender.findMany({
        where,
        select: {
          id: true,
          title: true,
          bidNumber: true,
          buyerName: true,
          ministry: true,
          department: true,
          state: true,
          serviceCategory: true,
          estimatedValue: true,
          currency: true,
          emdAmount: true,
          closesAt: true,
          status: true,
          relevance: true,
          source: { select: { name: true } },
          analysis: {
            select: { overallMatchScore: true, matchClassification: true },
          },
        },
        orderBy: [{ [q.sort]: q.direction }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.tender.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  async detail(id: string) {
    const t = await this.db.tender.findUnique({
      where: { id },
      include: tenderInclude,
    });
    if (!t) throw new NotFoundException('Tender not found');
    return t;
  }
  async update(id: string, input: unknown, actor: string) {
    const data = S.parse(S.tenderPatch, input);
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, id);
      return this.updateInTransaction(tx, id, data, actor);
    });
  }
  private async updateInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.TenderUncheckedUpdateInput,
    actor: string,
  ) {
    const before = await tx.tender.findUniqueOrThrow({ where: { id } });
    const updated = await tx.tender.update({ where: { id }, data });
    const source = await tx.tenderSource.findUniqueOrThrow({
      where: { id: updated.tenderSourceId },
    });
    const capabilities = await tx.companyCapability.findMany({
      where: { active: true },
    });
    const classified = relevance(
      `${updated.title} ${updated.description ?? ''} ${updated.scopeOfWork ?? ''}`,
      S.parse(S.sourceConfig, source.configJson),
      capabilities,
    );
    await tx.tender.update({ where: { id }, data: classified });
    const changes = (
      [
        'title',
        'description',
        'closesAt',
        'emdAmount',
        'estimatedValue',
        'scopeOfWork',
        'contractDuration',
      ] as const
    ).filter((key) => String(before[key]) !== String(updated[key]));
    for (const key of changes)
      await tx.tenderRevision.create({
        data: {
          tenderId: id,
          fieldName: key,
          oldValue: before[key] == null ? null : String(before[key]),
          newValue: updated[key] == null ? null : String(updated[key]),
        },
      });
    const substantiveChanged = Object.keys(data).some(
      (key) =>
        !['externalId', 'tenderSourceId', 'lastSyncedAt'].includes(key) &&
        String(before[key as keyof typeof before]) !==
          String(updated[key as keyof typeof updated]),
    );
    if (substantiveChanged) await invalidate(tx, id, actor);
    if (changes.length) {
      await invalidate(tx, id, actor);
      await tx.governmentNotification.upsert({
        where: {
          key: `revision:${id}:${hash(changes.map((k) => updated[k]))}`,
        },
        update: {},
        create: {
          key: `revision:${id}:${hash(changes.map((k) => updated[k]))}`,
          tenderId: id,
          message: `Tender changed: ${changes.join(', ')}`,
        },
      });
    }
    await activity(tx, actor, 'TENDER_UPDATED', id, {
      fields: Object.keys(data),
    });
    return updated;
  }
  async status(id: string, input: unknown, actor: string) {
    const { status } = S.parse(S.statusInput, input);
    if (
      ['READY_FOR_SUBMISSION', 'SUBMITTED', 'AWARDED', 'LOST'].includes(status)
    )
      throw new BadRequestException(
        'Use the bid workspace for approval and submission transitions',
      );
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, id);
      await invalidate(tx, id, actor);
      await activity(tx, actor, 'TENDER_STATUS_CHANGED', id, { status });
      return tx.tender.update({ where: { id }, data: { status } });
    });
  }
  async updateCompliance(
    id: string,
    itemId: string,
    input: unknown,
    actor: string,
  ) {
    const data = S.parse(S.complianceInput, input);
    if (
      data.complianceStatus === 'COMPLIANT' &&
      !data.evidence?.trim() &&
      !data.companyDocumentId
    )
      throw new BadRequestException('Compliant status requires evidence');
    if (
      data.companyDocumentId &&
      !(await this.db.companyDocument.findUnique({
        where: { id: data.companyDocumentId },
      }))
    )
      throw new BadRequestException('Company document not found');
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, id);
      const result = await tx.tenderComplianceItem.updateMany({
        where: { id: itemId, tenderId: id },
        data: { ...data, confirmedById: actor },
      });
      if (!result.count)
        throw new NotFoundException('Compliance item not found');
      await invalidate(tx, id, actor, 'document');
      await activity(tx, actor, 'COMPLIANCE_UPDATED', id, { itemId, ...data });
      return result;
    });
  }
  async updateEligibility(
    id: string,
    itemId: string,
    input: unknown,
    actor: string,
  ) {
    const data = S.parse(S.eligibilityInput, input);
    if (data.status === 'COMPLIANT' && !data.evidence?.trim())
      throw new BadRequestException('Compliant status requires evidence');
    return this.db.$transaction(async (tx) => {
      await lockTender(tx, id);
      const result = await tx.tenderEligibility.updateMany({
        where: { id: itemId, tenderId: id },
        data: { ...data, confirmedById: actor },
      });
      if (!result.count)
        throw new NotFoundException('Eligibility item not found');
      await invalidate(tx, id, actor, 'document');
      await activity(tx, actor, 'ELIGIBILITY_UPDATED', id, { itemId, ...data });
      return result;
    });
  }
  async readiness(id: string) {
    const tender = await this.detail(id);
    const analysis = tender.analysis
      ? S.parse(S.analysisOutput, tender.analysis.rawStructuredResult)
      : null;
    const docs = await this.db.companyDocument.findMany();
    return {
      analyzed: !!analysis,
      items: (analysis?.requiredDocuments ?? []).map((r) => {
        const matches = docs.filter(
          (d) =>
            d.documentType === r.documentType &&
            d.storageKey &&
            d.status === 'AVAILABLE' &&
            (!d.expiryDate || d.expiryDate > new Date()),
        );
        return {
          ...r,
          available: matches.length,
          status:
            matches.length >= r.count
              ? 'AVAILABLE'
              : matches.length
                ? 'PARTIAL'
                : 'MISSING',
          documents: matches.map((d) => ({ id: d.id, name: d.name })),
          verification:
            'Verify issuer, scope and tender-specific applicability before approval',
        };
      }),
    };
  }
  async dashboard() {
    const now = new Date();
    const soon = (days: number) => ({
      status: { in: openStatuses },
      closesAt: { gte: now, lte: new Date(Date.now() + days * 86400000) },
    });
    const [
      total,
      newTenders,
      relevant,
      strong,
      possible,
      closing3,
      closing7,
      eligibility,
      issues,
      active,
      ready,
      submitted,
      won,
      lost,
      priority,
      closing,
      revisions,
      analyses,
      missing,
      notifications,
    ] = await Promise.all([
      this.db.tender.count(),
      this.db.tender.count({ where: { status: 'NEW' } }),
      this.db.tender.count({ where: { relevance: 'RELEVANT' } }),
      this.db.tenderAnalysis.count({
        where: { matchClassification: 'STRONG_MATCH' },
      }),
      this.db.tenderAnalysis.count({
        where: { matchClassification: 'POSSIBLE_MATCH' },
      }),
      this.db.tender.count({ where: soon(3) }),
      this.db.tender.count({ where: soon(7) }),
      this.db.tender.count({
        where: {
          OR: [
            { analysis: null },
            { eligibility: { some: { status: 'NEEDS_VERIFICATION' } } },
          ],
        },
      }),
      this.db.tender.count({
        where: {
          compliance: {
            some: {
              complianceStatus: {
                in: [
                  'NOT_COMPLIANT',
                  'PARTIALLY_COMPLIANT',
                  'NEEDS_VERIFICATION',
                ],
              },
            },
          },
        },
      }),
      this.db.bidWorkspace.count({
        where: {
          status: {
            in: [
              'IN_PREPARATION',
              'TECHNICAL_REVIEW',
              'DOCUMENT_REVIEW',
              'COMMERCIAL_REVIEW',
            ],
          },
        },
      }),
      this.db.bidWorkspace.count({ where: { status: 'READY_FOR_SUBMISSION' } }),
      this.db.bidWorkspace.count({ where: { status: 'SUBMITTED_MANUALLY' } }),
      this.db.bidWorkspace.count({ where: { status: 'WON' } }),
      this.db.bidWorkspace.count({ where: { status: 'LOST' } }),
      this.db.tender.findMany({
        where: {
          status: { in: openStatuses },
          analysis: { matchClassification: 'STRONG_MATCH' },
        },
        select: { id: true, title: true, closesAt: true },
        take: 10,
      }),
      this.db.tender.findMany({
        where: soon(7),
        select: { id: true, title: true, closesAt: true },
        orderBy: { closesAt: 'asc' },
        take: 10,
      }),
      this.db.tenderRevision.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.db.tenderAnalysis.findMany({
        select: { tenderId: true, executiveSummary: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.db.companyDocument.findMany({
        where: {
          OR: [
            { status: { not: 'AVAILABLE' } },
            { expiryDate: { lt: new Date(Date.now() + 30 * 86400000) } },
          ],
        },
        select: { id: true, name: true, status: true, expiryDate: true },
        take: 30,
      }),
      this.db.governmentNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
    return {
      metrics: {
        total,
        newTenders,
        relevant,
        strong,
        possible,
        closing3,
        closing7,
        eligibility,
        issues,
        active,
        ready,
        submitted,
        won,
        lost,
        missingDocuments: missing.length,
      },
      priority,
      closing,
      revisions,
      analyses,
      missing,
      notifications,
    };
  }
}
