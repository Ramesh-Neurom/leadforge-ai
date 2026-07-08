import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiFollowupGeneratorService } from './ai-followup-generator.service';
import { AiLeadAnalysisService } from './ai-lead-analysis.service';
import { AiProposalGeneratorService } from './ai-proposal-generator.service';
import { OpenAiProvider } from './openai.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    OpenAiProvider,
    AiLeadAnalysisService,
    AiProposalGeneratorService,
    AiFollowupGeneratorService,
  ],
  exports: [
    AiLeadAnalysisService,
    AiProposalGeneratorService,
    AiFollowupGeneratorService,
  ],
})
export class AiAgentsModule {}
