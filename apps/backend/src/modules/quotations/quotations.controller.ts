import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { QuotationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuotationsService } from './quotations.service';

@UseGuards(JwtAuthGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Get()
  findAll() {
    return this.quotations.findAll();
  }

  @Post('generate')
  generate(@Body() body: GenerateQuotationPayload) {
    return this.quotations.generate(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotations.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: QuotationPayload) {
    return this.quotations.update(id, body);
  }

  @Post(':id/send-email')
  sendEmail(
    @Param('id') id: string,
    @Body() body: { messageText?: string; subject?: string },
  ) {
    return this.quotations.sendEmail(id, body);
  }
}

export interface GenerateQuotationPayload {
  leadId?: string;
  proposalId?: string;
  amount?: number | string;
  currency?: string;
  paymentTerms?: string;
}

export interface QuotationPayload {
  scopeSummary?: string;
  amount?: number | string;
  currency?: string;
  timeline?: string | null;
  paymentTerms?: string | null;
  status?: QuotationStatus;
  pdfUrl?: string | null;
}
