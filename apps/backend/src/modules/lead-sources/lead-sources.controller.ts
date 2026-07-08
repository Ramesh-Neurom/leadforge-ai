import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeadSourcePayload, LeadSourcesService } from './lead-sources.service';

@UseGuards(JwtAuthGuard)
@Controller('lead-sources')
export class LeadSourcesController {
  constructor(private readonly leadSources: LeadSourcesService) {}

  @Get()
  findAll() {
    return this.leadSources.findAll();
  }

  @Post()
  create(@Body() body: LeadSourcePayload) {
    return this.leadSources.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: LeadSourcePayload) {
    return this.leadSources.update(id, body);
  }

  @Post(':id/test')
  test(@Param('id') id: string) {
    return this.leadSources.test(id);
  }

  @Post(':id/sync')
  sync(@Param('id') id: string) {
    return this.leadSources.sync(id);
  }
}
