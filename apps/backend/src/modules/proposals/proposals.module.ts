import { Module } from '@nestjs/common';
import { AiAgentsModule } from '../ai-agents/ai-agents.module';
import { AuthModule } from '../auth/auth.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { CrmModule } from '../crm/crm.module';
import { EmailModule } from '../email/email.module';
import { FollowupsModule } from '../followups/followups.module';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [
    AuthModule,
    AiAgentsModule,
    ConversationsModule,
    CrmModule,
    EmailModule,
    FollowupsModule,
  ],
  controllers: [ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
