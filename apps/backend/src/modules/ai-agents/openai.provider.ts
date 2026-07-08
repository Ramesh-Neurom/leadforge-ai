import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface StrictJsonCompletionInput {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: {
    name: string;
    schema: Record<string, unknown>;
  };
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

@Injectable()
export class OpenAiProvider {
  constructor(private readonly config: ConfigService) {}

  async createStrictJsonCompletion<T>(
    input: StrictJsonCompletionInput,
  ): Promise<T> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey.startsWith('sk-dummy')) {
      throw new BadRequestException(
        'Configure a valid OPENAI_API_KEY before using AI agents',
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: input.jsonSchema.name,
            strict: true,
            schema: input.jsonSchema.schema,
          },
        },
      }),
    });

    const payload = (await response.json()) as OpenAiChatCompletionResponse;
    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload.error?.message ?? 'OpenAI request failed',
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException(
        'OpenAI returned an empty response',
      );
    }

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new ServiceUnavailableException('OpenAI returned invalid JSON');
    }
  }
}
