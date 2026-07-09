import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiAgentsModule } from '../ai-agents/ai-agents.module';
import { LeadOpportunityFilterService } from './lead-opportunity-filter.service';
import { LeadSourcesController } from './lead-sources.controller';
import { LeadSourcesService } from './lead-sources.service';

@Module({
  imports: [AuthModule, AiAgentsModule],
  controllers: [LeadSourcesController],
  providers: [LeadSourcesService, LeadOpportunityFilterService],
  exports: [LeadSourcesService],
})
export class LeadSourcesModule {}
