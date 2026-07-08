import { Injectable } from '@nestjs/common';
import { OpenAiProvider } from './openai.provider';

export interface LeadAnalysisInput {
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
}

export interface AiLeadAnalysisResult {
  lead_score: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'IGNORE';
  category: string;
  required_skills: string[];
  budget_quality: string;
  client_seriousness: string;
  red_flags: string[];
  ai_summary: string;
  recommended_action: 'APPLY' | 'REVIEW' | 'IGNORE';
}

const companySkills = [
  'Full Stack Development',
  'MERN Stack',
  'MEAN Stack',
  'Backend Development',
  'AI & Machine Learning',
  'Mobile App Development',
  'Android Kotlin',
  'iOS Swift',
  'React Native',
  'Flutter',
  'Game Development',
  'Unity',
  'Unreal Engine',
  'AR/VR Development',
  'System Design & Architecture',
  'Cloud & DevOps',
  'API Development and Integrations',
];

@Injectable()
export class AiLeadAnalysisService {
  constructor(private readonly openAi: OpenAiProvider) {}

  async analyzeLead(input: LeadAnalysisInput) {
    const result =
      await this.openAi.createStrictJsonCompletion<AiLeadAnalysisResult>({
        systemPrompt: [
          'You are an expert business development analyst for a software services company.',
          'Analyze freelance/project leads only against the provided company skills.',
          'Return strict JSON only. Do not include markdown, comments, or extra text.',
          'Scoring rule: 80-100 = HIGH, 60-79 = MEDIUM, 40-59 = LOW, below 40 = IGNORE.',
          'Use recommended_action APPLY only when the lead is a strong fit and should be pursued.',
        ].join(' '),
        userPrompt: JSON.stringify(
          {
            company_skills: companySkills,
            lead: input,
            expected_json: {
              lead_score: 'number from 0 to 100',
              priority: 'HIGH | MEDIUM | LOW | IGNORE',
              category: 'string',
              required_skills: ['string'],
              budget_quality: 'string',
              client_seriousness: 'string',
              red_flags: ['string'],
              ai_summary: 'string',
              recommended_action: 'APPLY | REVIEW | IGNORE',
            },
          },
          null,
          2,
        ),
        jsonSchema: {
          name: 'lead_analysis',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'lead_score',
              'priority',
              'category',
              'required_skills',
              'budget_quality',
              'client_seriousness',
              'red_flags',
              'ai_summary',
              'recommended_action',
            ],
            properties: {
              lead_score: { type: 'number', minimum: 0, maximum: 100 },
              priority: {
                type: 'string',
                enum: ['HIGH', 'MEDIUM', 'LOW', 'IGNORE'],
              },
              category: { type: 'string' },
              required_skills: {
                type: 'array',
                items: { type: 'string' },
              },
              budget_quality: { type: 'string' },
              client_seriousness: { type: 'string' },
              red_flags: {
                type: 'array',
                items: { type: 'string' },
              },
              ai_summary: { type: 'string' },
              recommended_action: {
                type: 'string',
                enum: ['APPLY', 'REVIEW', 'IGNORE'],
              },
            },
          },
        },
      });

    return normalizeAnalysis(result);
  }
}

function normalizeAnalysis(result: AiLeadAnalysisResult): AiLeadAnalysisResult {
  const leadScore = Math.max(0, Math.min(100, Math.round(result.lead_score)));

  return {
    lead_score: leadScore,
    priority: priorityForScore(leadScore),
    category: result.category,
    required_skills: result.required_skills,
    budget_quality: result.budget_quality,
    client_seriousness: result.client_seriousness,
    red_flags: result.red_flags,
    ai_summary: result.ai_summary,
    recommended_action: result.recommended_action,
  };
}

function priorityForScore(score: number): AiLeadAnalysisResult['priority'] {
  if (score >= 80) {
    return 'HIGH';
  }

  if (score >= 60) {
    return 'MEDIUM';
  }

  if (score >= 40) {
    return 'LOW';
  }

  return 'IGNORE';
}
