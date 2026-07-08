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

interface ZaiChatCompletionResponse {
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
  constructor(private readonly config: ConfigService) { }

  async createStrictJsonCompletion<T>(
    input: StrictJsonCompletionInput,
  ): Promise<T> {
    const apiKey = this.config.get<string>('ZAI_API_KEY');

    if (!apiKey || apiKey.trim().length < 10) {
      throw new BadRequestException(
        'Configure a valid ZAI_API_KEY before using AI agents',
      );
    }

    const baseUrl =
      this.config.get<string>('ZAI_BASE_URL') ??
      'https://api.z.ai/api/paas/v4/chat/completions';

    const model = this.config.get<string>('ZAI_MODEL') ?? 'glm-5.1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `${input.systemPrompt}

Return ONLY valid JSON.
Do not include markdown.
Do not include explanation outside JSON.
The JSON must follow this schema:
${JSON.stringify(input.jsonSchema.schema, null, 2)}`,
          },
          {
            role: 'user',
            content: input.userPrompt,
          },
        ],
        response_format: {
          type: 'json_object',
        },
      }),
    });

    const payload = (await response.json()) as ZaiChatCompletionResponse;

    console.log("check payload data", payload)

    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload.error?.message ?? 'Z.AI GLM request failed',
      );
    }

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new ServiceUnavailableException('Z.AI returned an empty response');
    }

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new ServiceUnavailableException('Z.AI returned invalid JSON');
    }
  }
}