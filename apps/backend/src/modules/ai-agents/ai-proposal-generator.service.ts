import { Injectable } from '@nestjs/common';
import { OpenAiProvider } from './openai.provider';

export interface ProposalLeadInput {
  title: string;
  description: string;
  sourceName: string;
  clientName?: string | null;
  clientCountry?: string | null;
  budgetType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  skills: string[];
  analysis?: {
    leadScore: number;
    priority: string;
    category?: string | null;
    requiredSkills: string[];
    budgetQuality?: string | null;
    clientSeriousness?: string | null;
    redFlags: string[];
    aiSummary?: string | null;
    recommendedAction?: string | null;
  } | null;
}

export interface AiProposalResult {
  proposal_text: string;
  solution_summary: string;
  timeline: string;
  budget_range: string;
  questions: string[];
  portfolio_links: string[];
}

@Injectable()
export class AiProposalGeneratorService {
  constructor(private readonly openAi: OpenAiProvider) {}

  async generateProposal(input: ProposalLeadInput) {
    return this.openAi.createStrictJsonCompletion<AiProposalResult>({
      systemPrompt: [
        'You are a senior business development proposal writer for a software services company.',
        'Write in simple professional English.',
        'Do not make fake claims, invent portfolio items, name unavailable team members, or promise guaranteed outcomes.',
        'Do not overpromise timelines or budget. Keep the proposal specific to the client requirement.',
        'The proposal must include a short client-specific opening, requirement understanding, technical solution, tech stack, timeline, budget range, 2 to 4 clarification questions, and a call-to-action.',
        'Return strict JSON only. Do not include markdown fences or extra text.',
      ].join(' '),
      userPrompt: JSON.stringify(
        {
          lead: input,
          expected_json: {
            proposal_text: 'complete client-ready proposal text',
            solution_summary: 'short summary of the proposed solution',
            timeline: 'realistic timeline string',
            budget_range: 'realistic budget range string',
            questions: ['2 to 4 clarification questions'],
            portfolio_links: [
              'known portfolio links only, otherwise empty array',
            ],
          },
        },
        null,
        2,
      ),
      jsonSchema: {
        name: 'proposal_generation',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: [
            'proposal_text',
            'solution_summary',
            'timeline',
            'budget_range',
            'questions',
            'portfolio_links',
          ],
          properties: {
            proposal_text: { type: 'string' },
            solution_summary: { type: 'string' },
            timeline: { type: 'string' },
            budget_range: { type: 'string' },
            questions: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: { type: 'string' },
            },
            portfolio_links: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    });
  }
}
