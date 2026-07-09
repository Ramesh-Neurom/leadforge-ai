import { Injectable } from '@nestjs/common';
import type { NormalizedLead } from './lead-sources.service';

export type OpportunityType =
  'PROJECT_LEAD' | 'CONTRACT_LEAD' | 'JOB_POSTING' | 'IRRELEVANT';

export interface LeadOpportunityFilterConfig {
  importOnlyProjectLeads?: boolean;
  allowContractLeads?: boolean;
  strictJobPostFilter?: boolean;
  keywords?: string[];
  excludeKeywords?: string[];
}

export interface LeadOpportunityFilterResult {
  opportunityType: OpportunityType;
  score: number;
  reason: string;
}

const positiveProjectKeywords = [
  'freelance',
  'freelancer',
  'contract',
  'contractor',
  'consultant',
  'agency',
  'vendor',
  'outsourcing',
  'project',
  'fixed price',
  'milestone',
  'proposal',
  'quote',
  'quotation',
  'build',
  'develop',
  'create',
  'implement',
  'integrate',
  'mvp',
  'web app',
  'mobile app',
  'saas',
  'api integration',
  'backend api',
  'ai chatbot',
  'ai agent',
  'devops setup',
  'website development',
  'app development',
];

const contractKeywords = [
  'contract',
  'contractor',
  'freelance',
  'freelancer',
  'part-time',
  'part time',
  'consultant',
  'staff augmentation',
];

const negativeJobKeywords = [
  'full-time',
  'full time',
  'permanent',
  'employee',
  'employment',
  'salary',
  'benefits',
  'pto',
  '401(k)',
  '401k',
  'paid holidays',
  'medical insurance',
  'dental',
  'vision',
  'resume',
  'cv',
  'apply for this role',
  'job description',
  'job requirements',
  'responsibilities',
  'requirements',
  'join our team',
  'we are hiring',
  'candidate',
  'interview',
  'report to',
  'years of experience',
  'work authorization',
  'w2',
  'payroll',
  'hiring manager',
];

const irrelevantRoleKeywords = [
  'customer support',
  'sales representative',
  'marketing manager',
  'content writer',
  'copywriter',
  'hr',
  'recruiter',
  'talent acquisition',
  'virtual assistant',
  'data entry',
  'account executive',
  'product designer',
  'graphic designer',
  'ui designer only',
];

@Injectable()
export class LeadOpportunityFilterService {
  classify(
    lead: NormalizedLead,
    config: LeadOpportunityFilterConfig = {},
  ): LeadOpportunityFilterResult {
    const text = [
      lead.title,
      lead.description,
      lead.clientName,
      lead.clientCountry,
      ...(lead.skillsJson ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const positive = hits(text, [
      ...positiveProjectKeywords,
      ...(config.keywords ?? []),
    ]);
    const contract = hits(text, contractKeywords);
    const negative = hits(text, [
      ...negativeJobKeywords,
      ...(config.excludeKeywords ?? []),
    ]);
    const irrelevant = hits(text, irrelevantRoleKeywords);
    const score =
      positive.length * 2 +
      contract.length -
      negative.length * 2 -
      irrelevant.length * 3;
    const projectOnly = positive.filter((item) => !contract.includes(item));

    if (irrelevant.length) {
      return result('IRRELEVANT', score, irrelevant, 'irrelevant role');
    }

    if (contract.length && (projectOnly.length < 2 || negative.length > 0)) {
      return result(
        'CONTRACT_LEAD',
        score,
        [...contract, ...projectOnly],
        'contract/freelance signals',
      );
    }

    if (positive.length >= 2 && negative.length <= 1) {
      return result('PROJECT_LEAD', score, positive, 'project/service signals');
    }

    if (negative.length >= 2 || config.strictJobPostFilter !== false) {
      return result(
        'JOB_POSTING',
        score,
        negative,
        'job-posting signals or strict default',
      );
    }

    return result(
      'JOB_POSTING',
      score,
      [],
      'uncertain source item skipped by default',
    );
  }
}

function hits(text: string, keywords: string[]) {
  return Array.from(
    new Set(
      keywords
        .map((keyword) => keyword.trim().toLowerCase())
        .filter((keyword) => keyword && includesKeyword(text, keyword)),
    ),
  );
}

function includesKeyword(text: string, keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function result(
  opportunityType: OpportunityType,
  score: number,
  matches: string[],
  label: string,
): LeadOpportunityFilterResult {
  const suffix = matches.length ? `: ${matches.slice(0, 5).join(', ')}` : '';
  return {
    opportunityType,
    score,
    reason: `${label}${suffix}`,
  };
}
