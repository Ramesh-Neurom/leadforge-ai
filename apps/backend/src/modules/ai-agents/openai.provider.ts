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

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: unknown;
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
    const apiKey = this.config.get<string>('GEMINI_API_KEY');

    if (!apiKey || apiKey.trim().length < 10) {
      throw new BadRequestException(
        'Configure a valid GEMINI_API_KEY before using AI agents',
      );
    }

    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `${input.systemPrompt}

Return ONLY valid JSON.
Do not include markdown.
Do not include explanation outside JSON.

The JSON must follow this schema:
${JSON.stringify(input.jsonSchema.schema, null, 2)}`,
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: input.userPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    const payload = (await response.json()) as GeminiGenerateContentResponse;

    console.log('Gemini raw payload:', JSON.stringify(payload, null, 2));

    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload.error?.message ?? 'Gemini request failed',
      );
    }

    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error('Gemini empty response payload:', payload);

      throw new ServiceUnavailableException(
        `Gemini returned empty response. FinishReason: ${
          payload.candidates?.[0]?.finishReason ?? 'UNKNOWN'
        }`,
      );
    }

    const cleanedContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      return JSON.parse(cleanedContent) as T;
    } catch {
      console.error('Invalid Gemini JSON:', cleanedContent);
      throw new ServiceUnavailableException('Gemini returned invalid JSON');
    }
  }
}