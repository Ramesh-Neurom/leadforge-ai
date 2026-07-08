import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProposalStatus } from '@prisma/client';
import { AuthRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProposalsService } from './proposals.service';

@UseGuards(JwtAuthGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get()
  findAll() {
    return this.proposals.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proposals.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: ProposalPayload) {
    return this.proposals.update(id, body);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.proposals.approve(id, request.user.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.proposals.reject(id);
  }

  @Post(':id/mark-sent')
  markSent(
    @Param('id') id: string,
    @Body() body: { sentMethod?: string },
    @Req() request: AuthRequest,
  ) {
    return this.proposals.markSent(
      id,
      request.user.id,
      body.sentMethod,
      request.user.role,
    );
  }

  @Post(':id/send-email')
  sendEmail(
    @Param('id') id: string,
    @Body() body: { messageText?: string; subject?: string },
    @Req() request: AuthRequest,
  ) {
    return this.proposals.sendEmail(
      id,
      request.user.id,
      request.user.role,
      body,
    );
  }

  @Post(':id/copy-manual-send')
  copyManualSend(
    @Param('id') id: string,
    @Body() body: { messageText?: string },
    @Req() request: AuthRequest,
  ) {
    return this.proposals.copyManualSend(
      id,
      request.user.id,
      request.user.role,
      body.messageText,
    );
  }
}

export interface ProposalPayload {
  proposalText?: string;
  solutionSummary?: string | null;
  timeline?: string | null;
  budgetRange?: string | null;
  questionsJson?: unknown;
  questions?: string[] | string;
  portfolioLinksJson?: unknown;
  portfolioLinks?: string[] | string;
  status?: ProposalStatus;
  sentMethod?: string | null;
}
