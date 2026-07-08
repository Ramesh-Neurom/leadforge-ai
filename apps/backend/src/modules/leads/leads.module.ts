import { Module } from '@nestjs/common';
import { AiAgentsModule } from '../ai-agents/ai-agents.module';
import { AuthModule } from '../auth/auth.module';
import { CrmModule } from '../crm/crm.module';
import { FollowupsModule } from '../followups/followups.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [
    AuthModule,
    AiAgentsModule,
    CrmModule,
    FollowupsModule,
    ProposalsModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
