import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FollowupsModule } from '../followups/followups.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [AuthModule, FollowupsModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
