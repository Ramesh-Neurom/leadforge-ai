import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { AuthRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FollowupsService } from '../followups/followups.service';
import { ProposalsService } from '../proposals/proposals.service';
import { LeadsService } from './leads.service';

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly proposals: ProposalsService,
    private readonly followups: FollowupsService,
  ) {}

  @Get('sources')
  findSources() {
    return this.leads.findSources();
  }

  @Get()
  findAll(
    @Query('sourceId') sourceId?: string,
    @Query('status') status?: LeadStatus,
    @Query('minScore') minScore?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.leads.findAll({ sourceId, status, minScore, from, to });
  }

  @Post()
  create(@Body() body: LeadPayload) {
    return this.leads.create(body);
  }

  @Post(':id/analyze')
  analyze(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.leads.analyze(id, request.user.id);
  }

  @Post(':id/generate-proposal')
  generateProposal(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.proposals.generateForLead(id, request.user.id);
  }

  @Post(':id/generate-followup')
  generateFollowup(@Param('id') id: string) {
    return this.followups.generateForLead(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leads.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: LeadPayload,
    @Req() request: AuthRequest,
  ) {
    return this.leads.update(id, body, request.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leads.remove(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status?: LeadStatus },
    @Req() request: AuthRequest,
  ) {
    return this.leads.updateStatus(
      id,
      body.status,
      request.user.role,
      request.user.id,
    );
  }

  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() body: { assignedToId?: string | null },
  ) {
    return this.leads.assign(id, body.assignedToId);
  }

  @Get(':id/activities')
  activities(@Param('id') id: string) {
    return this.leads.findActivities(id);
  }
}

export interface LeadPayload {
  sourceId?: string;
  externalId?: string;
  title?: string;
  description?: string;
  clientName?: string;
  clientCountry?: string;
  clientEmail?: string;
  clientProfileUrl?: string;
  projectUrl?: string;
  budgetType?: string;
  budgetMin?: number | string | null;
  budgetMax?: number | string | null;
  currency?: string;
  skillsJson?: unknown;
  skills?: string[] | string;
  postedAt?: string | null;
  status?: LeadStatus;
  assignedToId?: string | null;
}
