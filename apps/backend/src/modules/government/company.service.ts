import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { activity } from './government.service';
import * as S from './government.schemas';

@Injectable()
export class CompanyService {
  constructor(readonly db: PrismaService) {}
  profile() {
    return this.db.companyProfile.upsert({
      where: { id: 'company' },
      create: { id: 'company' },
      update: {},
      include: { capabilities: true },
    });
  }
  async saveProfile(input: unknown, actor: string) {
    const data = S.parse(S.companyInput, input);
    await this.profile();
    return this.db.$transaction(async (tx) => {
      const result = await tx.companyProfile.update({
        where: { id: 'company' },
        data,
      });
      await activity(tx, actor, 'COMPANY_PROFILE_UPDATED', undefined, {
        fields: Object.keys(data),
      });
      await this.invalidateCompany(tx);
      return result;
    });
  }
  capabilities() {
    return this.db.companyCapability.findMany({ orderBy: { name: 'asc' } });
  }
  async saveCapability(input: unknown, actor: string, id?: string) {
    await this.profile();
    const data = S.parse(S.capabilityInput, input);
    return this.db.$transaction(async (tx) => {
      const result = id
        ? await tx.companyCapability.update({ where: { id }, data })
        : await tx.companyCapability.create({ data });
      await activity(tx, actor, 'CAPABILITY_SAVED', undefined, {
        id: result.id,
      });
      await this.invalidateCompany(tx);
      return result;
    });
  }
  async deleteCapability(id: string, actor: string) {
    return this.db.$transaction(async (tx) => {
      const result = await tx.companyCapability.delete({ where: { id } });
      await activity(tx, actor, 'CAPABILITY_DELETED', undefined, { id });
      await this.invalidateCompany(tx);
      return result;
    });
  }
  async documents() {
    const docs = await this.db.companyDocument.findMany({
      orderBy: { createdAt: 'desc' },
      omit: { storageKey: true },
    });
    return docs.map((d) => ({
      ...d,
      status:
        d.expiryDate && d.expiryDate < new Date()
          ? 'EXPIRED'
          : d.expiryDate && d.expiryDate < new Date(Date.now() + 30 * 86400000)
            ? 'EXPIRING_SOON'
            : d.status,
    }));
  }
  async saveDocument(input: unknown, actor: string, id?: string) {
    await this.profile();
    const data = S.parse(S.companyDocumentInput, input);
    if (data.status === 'AVAILABLE') {
      const existing = id
        ? await this.db.companyDocument.findUnique({ where: { id } })
        : null;
      if (!existing?.storageKey)
        throw new BadRequestException(
          'Upload a file before marking evidence available',
        );
      if (data.expiryDate && data.expiryDate < new Date())
        throw new BadRequestException('Document has expired');
    }
    return this.db.$transaction(async (tx) => {
      const result = id
        ? await tx.companyDocument.update({ where: { id }, data })
        : await tx.companyDocument.create({ data });
      await activity(tx, actor, 'COMPANY_DOCUMENT_SAVED', undefined, {
        id: result.id,
      });
      await this.invalidateCompany(tx);
      const { storageKey: _key, ...safe } = result;
      void _key;
      return safe;
    });
  }
  async deleteDocument(id: string, actor: string) {
    if (!(await this.db.companyDocument.findUnique({ where: { id } })))
      throw new NotFoundException();
    return this.db.$transaction(async (tx) => {
      await tx.companyDocument.delete({ where: { id } });
      await activity(tx, actor, 'COMPANY_DOCUMENT_DELETED', undefined, { id });
      await this.invalidateCompany(tx);
      return { deleted: true };
    });
  }
  async invalidateCompany(tx: Prisma.TransactionClient) {
    await tx.bidWorkspace.updateMany({
      where: { status: { notIn: ['SUBMITTED_MANUALLY', 'WON', 'LOST'] } },
      data: {
        technicalApprovalStatus: 'PENDING',
        documentApprovalStatus: 'PENDING',
        commercialApprovalStatus: 'PENDING',
        status: 'IN_PREPARATION',
      },
    });
    await tx.tender.updateMany({
      where: { status: 'READY_FOR_SUBMISSION' },
      data: { status: 'INTERNAL_REVIEW' },
    });
  }
}
