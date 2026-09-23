import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OpenAiProvider } from '../ai-agents/openai.provider';
import { GovernmentController } from './government.controller';
import { GovernmentService } from './government.service';
import { CompanyService } from './company.service';
import { TenderDocumentService } from './tender-document.service';
import { TenderAnalysisService } from './tender-analysis.service';
import { BidWorkspaceService } from './bid-workspace.service';
import { GovernmentNotificationsService } from './government-notifications.service';
@Module({
  imports: [AuthModule],
  controllers: [GovernmentController],
  providers: [
    GovernmentService,
    CompanyService,
    TenderDocumentService,
    TenderAnalysisService,
    BidWorkspaceService,
    OpenAiProvider,
    GovernmentNotificationsService,
  ],
})
export class GovernmentModule {}
