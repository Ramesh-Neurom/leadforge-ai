import { Module } from '@nestjs/common';
import { AiAgentsModule } from '../ai-agents/ai-agents.module';
import { AuthModule } from '../auth/auth.module';
import { FollowupsController } from './followups.controller';
import { FollowupsService } from './followups.service';

@Module({
  imports: [AiAgentsModule, AuthModule],
  controllers: [FollowupsController],
  providers: [FollowupsService],
  exports: [FollowupsService],
})
export class FollowupsModule {}
