import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuotationStatus } from '@prisma/client';
import { EmailProvider } from '../email/email.provider';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GenerateQuotationPayload,
  QuotationPayload,
} from './quotations.controller';

const quotationInclude = {
  lead: {
    select: {
      id: true,
      title: true,
      clientName: true,
      clientEmail: true,
      sourceName: true,
    },
  },
  proposal: {
    select: {
      id: true,
      proposalText: true,
      solutionSummary: true,
      timeline: true,
      budgetRange: true,
    },
  },
} as const;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProvider: EmailProvider,
  ) {}

  findAll() {
    return this.prisma.quotation.findMany({
      include: quotationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: quotationInclude,
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return quotation;
  }

  async generate(input: GenerateQuotationPayload) {
    if (!input.leadId) {
      throw new BadRequestException('leadId is required');
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: input.leadId },
      include: {
        proposals: {
          where: input.proposalId ? { id: input.proposalId } : undefined,
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const proposal = lead.proposals[0];
    const amount = parseAmount(
      input.amount ?? lead.budgetMax ?? lead.budgetMin,
    );
    if (amount === undefined) {
      throw new BadRequestException(
        'amount is required when lead budget is missing',
      );
    }

    return this.prisma.quotation.create({
      data: {
        leadId: lead.id,
        proposalId: proposal?.id,
        scopeSummary: proposal?.solutionSummary ?? lead.description,
        amount,
        currency: input.currency?.trim() || lead.currency || 'USD',
        timeline: proposal?.timeline,
        paymentTerms:
          input.paymentTerms?.trim() || '50% advance, 50% on delivery',
        status: QuotationStatus.DRAFT,
        pdfUrl: `/quotations/${lead.id}/preview`,
      },
      include: quotationInclude,
    });
  }

  async update(id: string, input: QuotationPayload) {
    await this.findOne(id);

    return this.prisma.quotation.update({
      where: { id },
      data: {
        scopeSummary: input.scopeSummary,
        amount: parseAmount(input.amount),
        currency: input.currency,
        timeline: emptyToNull(input.timeline),
        paymentTerms: emptyToNull(input.paymentTerms),
        status: input.status,
        pdfUrl: emptyToNull(input.pdfUrl),
      },
      include: quotationInclude,
    });
  }

  async sendEmail(
    id: string,
    input: { messageText?: string; subject?: string },
  ) {
    const quotation = await this.findOne(id);
    if (!quotation.lead.clientEmail) {
      throw new BadRequestException('Client email is missing');
    }

    const messageText =
      input.messageText?.trim() || quotationEmailText(quotation);
    await this.emailProvider.send({
      to: quotation.lead.clientEmail,
      subject: input.subject?.trim() || `Quotation: ${quotation.lead.title}`,
      text: messageText,
    });

    return this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.SENT },
      include: quotationInclude,
    });
  }
}

function parseAmount(value?: number | string | null) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new BadRequestException('Invalid amount');
  }

  return parsed;
}

function emptyToNull(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function quotationEmailText(
  quotation: Awaited<ReturnType<QuotationsService['findOne']>>,
) {
  return [
    `Hi ${quotation.lead.clientName ?? 'there'},`,
    '',
    `Please find the quotation for ${quotation.lead.title}.`,
    '',
    `Scope: ${quotation.scopeSummary}`,
    `Amount: ${quotation.currency} ${quotation.amount.toLocaleString()}`,
    quotation.timeline ? `Timeline: ${quotation.timeline}` : undefined,
    quotation.paymentTerms
      ? `Payment terms: ${quotation.paymentTerms}`
      : undefined,
    '',
    'Please let me know if you have any questions.',
  ]
    .filter(Boolean)
    .join('\n');
}
