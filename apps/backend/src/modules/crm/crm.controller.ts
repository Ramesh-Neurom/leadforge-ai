import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { AuthRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CrmService } from './crm.service';

@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('pipeline')
  pipeline() {
    return this.crm.pipeline();
  }

  @Post('move-stage')
  moveStage(
    @Body() body: { leadId?: string; status?: LeadStatus },
    @Req() request: AuthRequest,
  ) {
    return this.crm.moveStage(
      body.leadId,
      body.status,
      request.user.id,
      request.user.role,
    );
  }

  @Get('activities')
  activities() {
    return this.crm.findActivities();
  }
}
