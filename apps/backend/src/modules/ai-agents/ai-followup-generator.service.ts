import { Injectable } from '@nestjs/common';
import { OpenAiProvider } from './openai.provider';

export interface FollowupInput {
  leadTitle: string;
  clientName?: string | null;
  proposalText?: string | null;
  lastMessage?: string | null;
  followupType: string;
}

export interface AiFollowupResult {
  message: string;
}

@Injectable()
export class AiFollowupGeneratorService {
  constructor(private readonly openAi: OpenAiProvider) {}

  generate(input: FollowupInput) {
    return this.openAi.createStrictJsonCompletion<AiFollowupResult>({
      systemPrompt: [
        'You write short professional follow-up messages for software project proposals.',
        'Use simple English, be polite, and do not pressure the client.',
        'Do not make fake claims, do not overpromise, and keep it under 120 words.',
        'Return strict JSON only.',
      ].join(' '),
      userPrompt: JSON.stringify(
        {
          input,
          expected_json: {
            message: 'short follow-up message',
          },
        },
        null,
        2,
      ),
      jsonSchema: {
        name: 'followup_message',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['message'],
          properties: {
            message: { type: 'string' },
          },
        },
      },
    });
  }
}
