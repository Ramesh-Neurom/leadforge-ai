import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FollowupStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FollowupsService } from './followups.service';

@UseGuards(JwtAuthGuard)
@Controller('followups')
export class FollowupsController {
  constructor(private readonly followups: FollowupsService) {}

  @Get()
  findAll(@Query('leadId') leadId?: string) {
    return this.followups.findAll({ leadId });
  }

  @Post()
  create(@Body() body: FollowupPayload) {
    return this.followups.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: FollowupPayload) {
    return this.followups.update(id, body);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.followups.complete(id);
  }
}

export interface FollowupPayload {
  leadId?: string;
  followupType?: string;
  message?: string;
  scheduledAt?: string;
  status?: FollowupStatus;
}
