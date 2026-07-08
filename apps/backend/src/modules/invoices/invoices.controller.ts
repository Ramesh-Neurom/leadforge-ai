import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InvoicePaymentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvoicesService } from './invoices.service';

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  findAll() {
    return this.invoices.findAll();
  }

  @Post()
  create(@Body() body: InvoicePayload) {
    return this.invoices.create(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: InvoicePayload) {
    return this.invoices.update(id, body);
  }

  @Post(':id/send-email')
  sendEmail(
    @Param('id') id: string,
    @Body() body: { messageText?: string; subject?: string },
  ) {
    return this.invoices.sendEmail(id, body);
  }

  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string) {
    return this.invoices.markPaid(id);
  }
}

export interface InvoicePayload {
  leadId?: string;
  clientName?: string | null;
  amount?: number | string;
  currency?: string;
  invoiceNumber?: string;
  invoicePdfUrl?: string | null;
  paymentStatus?: InvoicePaymentStatus;
  dueDate?: string | null;
}
