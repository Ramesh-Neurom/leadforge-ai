import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoicePaymentStatus } from '@prisma/client';
import { EmailProvider } from '../email/email.provider';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicePayload } from './invoices.controller';

const invoiceInclude = {
  lead: {
    select: {
      id: true,
      title: true,
      clientName: true,
      clientEmail: true,
      sourceName: true,
    },
  },
} as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProvider: EmailProvider,
  ) {}

  findAll() {
    return this.prisma.invoice.findMany({
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async create(input: InvoicePayload) {
    if (!input.leadId || !input.amount) {
      throw new BadRequestException('leadId and amount are required');
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: input.leadId },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const invoiceNumber = input.invoiceNumber?.trim() || `INV-${Date.now()}`;
    return this.prisma.invoice.create({
      data: {
        leadId: lead.id,
        clientName: emptyToNull(input.clientName) ?? lead.clientName,
        amount: parseAmount(input.amount),
        currency: input.currency?.trim() || lead.currency || 'USD',
        invoiceNumber,
        invoicePdfUrl:
          emptyToNull(input.invoicePdfUrl) ??
          `/invoices/${invoiceNumber}/preview`,
        paymentStatus: input.paymentStatus ?? InvoicePaymentStatus.UNPAID,
        dueDate: parseOptionalDate(input.dueDate),
      },
      include: invoiceInclude,
    });
  }

  async update(id: string, input: InvoicePayload) {
    await this.findOne(id);

    return this.prisma.invoice.update({
      where: { id },
      data: {
        clientName: emptyToNull(input.clientName),
        amount:
          input.amount === undefined ? undefined : parseAmount(input.amount),
        currency: input.currency,
        invoiceNumber: input.invoiceNumber,
        invoicePdfUrl: emptyToNull(input.invoicePdfUrl),
        paymentStatus: input.paymentStatus,
        dueDate: parseOptionalDate(input.dueDate),
      },
      include: invoiceInclude,
    });
  }

  async sendEmail(
    id: string,
    input: { messageText?: string; subject?: string },
  ) {
    const invoice = await this.findOne(id);
    if (!invoice.lead.clientEmail) {
      throw new BadRequestException('Client email is missing');
    }

    const messageText = input.messageText?.trim() || invoiceEmailText(invoice);
    await this.emailProvider.send({
      to: invoice.lead.clientEmail,
      subject: input.subject?.trim() || `Invoice ${invoice.invoiceNumber}`,
      text: messageText,
    });

    return invoice;
  }

  markPaid(id: string) {
    return this.prisma.invoice.update({
      where: { id },
      data: { paymentStatus: InvoicePaymentStatus.PAID },
      include: invoiceInclude,
    });
  }
}

function parseAmount(value: number | string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new BadRequestException('Invalid amount');
  }

  return parsed;
}

function parseOptionalDate(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid dueDate');
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

function invoiceEmailText(
  invoice: Awaited<ReturnType<InvoicesService['findOne']>>,
) {
  return [
    `Hi ${invoice.clientName ?? invoice.lead.clientName ?? 'there'},`,
    '',
    `Please find invoice ${invoice.invoiceNumber} for ${invoice.lead.title}.`,
    '',
    `Amount: ${invoice.currency} ${invoice.amount.toLocaleString()}`,
    invoice.dueDate
      ? `Due date: ${invoice.dueDate.toLocaleDateString()}`
      : undefined,
    '',
    'Please let me know if you need any changes.',
  ]
    .filter(Boolean)
    .join('\n');
}
