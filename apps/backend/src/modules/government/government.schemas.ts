import { BadRequestException } from '@nestjs/common';
import {
  ComplianceStatus,
  MatchClassification,
  TenderIntegration,
  TenderStatus,
  BidStatus,
} from '@prisma/client';
import { z } from 'zod';

const text = z.string().trim().max(20000);
const nullableText = text.nullable().optional();
const date = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v))
  .nullable()
  .optional();
const money = z
  .union([
    z.number().finite().nonnegative().max(1e14),
    z.string().regex(/^\d{1,14}(\.\d{1,2})?$/),
  ])
  .nullable()
  .optional();
export const sourceConfig = z
  .object({
    keywords: z.array(z.string().trim().min(1).max(100)).max(200).default([]),
    excludeKeywords: z
      .array(z.string().trim().min(1).max(100))
      .max(200)
      .default([]),
    hardwareKeywords: z
      .array(z.string().trim().min(1).max(100))
      .max(100)
      .default([]),
    syncIntervalHours: z.number().int().min(1).max(168).default(4),
  })
  .strict();
export const sourceInput = z
  .object({
    name: text.min(1).max(200),
    integrationType: z.nativeEnum(TenderIntegration),
    status: z.enum(['ACTIVE', 'DISABLED']).default('ACTIVE'),
    configJson: sourceConfig,
  })
  .strict();
export const tenderInput = z
  .object({
    tenderSourceId: text.min(1),
    externalId: text.max(500).optional(),
    bidNumber: nullableText,
    title: text.min(1).max(500).optional(),
    description: nullableText,
    buyerName: nullableText,
    ministry: nullableText,
    department: nullableText,
    state: nullableText,
    locationText: nullableText,
    serviceCategory: nullableText,
    tenderType: nullableText,
    estimatedValue: money,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default('INR'),
    publishedAt: date,
    closesAt: date,
    emdAmount: money,
    emdRequired: z.boolean().nullable().optional(),
    msePreference: z.boolean().nullable().optional(),
    startupPreference: z.boolean().nullable().optional(),
    contractDuration: nullableText,
    scopeOfWork: nullableText,
    sourceUrl: z
      .string()
      .url()
      .max(2000)
      .refine((v) => new URL(v).protocol === 'https:', 'HTTPS required')
      .nullable()
      .optional(),
  })
  .strict();
export const tenderPatch = tenderInput
  .omit({ tenderSourceId: true, externalId: true })
  .partial();
export const statusInput = z
  .object({ status: z.nativeEnum(TenderStatus) })
  .strict();
export const listInput = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: text.max(200).optional(),
    source: text.optional(),
    status: z.nativeEnum(TenderStatus).optional(),
    ministry: text.optional(),
    department: text.optional(),
    state: text.optional(),
    serviceCategory: text.optional(),
    tenderType: text.optional(),
    closingFrom: date,
    closingTo: date,
    closingSoon: z.coerce.number().int().min(1).max(90).optional(),
    estimatedValueMin: money,
    estimatedValueMax: money,
    emdRequired: z.enum(['true', 'false']).optional(),
    msePreference: z.enum(['true', 'false']).optional(),
    startupPreference: z.enum(['true', 'false']).optional(),
    matchClassification: z.nativeEnum(MatchClassification).optional(),
    minScore: z.coerce.number().min(0).max(100).optional(),
    eligibilityStatus: z.nativeEnum(ComplianceStatus).optional(),
    sort: z
      .enum(['closesAt', 'createdAt', 'estimatedValue'])
      .default('createdAt'),
    direction: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();
export const companyInput = z
  .object({
    legalName: nullableText,
    displayName: nullableText,
    website: z.string().url().nullable().optional(),
    yearsInBusiness: z.number().int().nonnegative().nullable().optional(),
    employeeCount: z.number().int().nonnegative().nullable().optional(),
    turnover: nullableText,
    locations: nullableText,
    industries: nullableText,
    certifications: nullableText,
    msmeStatus: nullableText,
    startupStatus: nullableText,
    governmentExperience: nullableText,
    experience: nullableText,
    team: nullableText,
    notes: nullableText,
  })
  .strict();
export const capabilityInput = z
  .object({
    category: z.enum([
      'SOFTWARE_ENGINEERING',
      'AI_DATA',
      'CLOUD',
      'CYBERSECURITY',
      'IOT_EDGE',
      'DIGITAL_TWIN',
      'SYSTEM_INTEGRATION',
      'MANAGED_SERVICES',
      'IMPLEMENTATION_SERVICES',
      'FDE_STYLE',
      'OTHER',
    ]),
    name: text.min(1).max(200),
    description: nullableText,
    proficiency: nullableText,
    keywords: z.array(z.string().trim().min(1).max(100)).max(100),
    active: z.boolean().default(true),
  })
  .strict();
export const companyDocumentTypes = [
  'COMPANY_REGISTRATION',
  'GST',
  'PAN',
  'UDYAM',
  'STARTUP_INDIA',
  'COMPANY_PROFILE',
  'TURNOVER_CERTIFICATE',
  'AUDITED_FINANCIAL',
  'WORK_ORDER',
  'COMPLETION_CERTIFICATE',
  'EXPERIENCE_CERTIFICATE',
  'ISO_CERTIFICATE',
  'TEAM_CV',
  'TECHNICAL_CERTIFICATE',
  'CLIENT_REFERENCE',
  'OTHER',
] as const;
export const companyDocumentInput = z
  .object({
    documentType: z.enum(companyDocumentTypes),
    name: text.min(1).max(200),
    issuer: nullableText,
    issueDate: date,
    expiryDate: date,
    status: z
      .enum([
        'AVAILABLE',
        'MISSING',
        'EXPIRED',
        'EXPIRING_SOON',
        'NEEDS_VERIFICATION',
      ])
      .default('NEEDS_VERIFICATION'),
    notes: nullableText,
  })
  .strict();
export const documentTypeInput = z.enum([
  'BID_DOCUMENT',
  'ATC',
  'BOQ',
  'SCOPE_OF_WORK',
  'TECHNICAL_SPECIFICATION',
  'CORRIGENDUM',
  'ANNEXURE',
  'OTHER',
]);
export const complianceInput = z
  .object({
    complianceStatus: z.nativeEnum(ComplianceStatus),
    evidence: nullableText,
    companyDocumentId: nullableText,
    notes: nullableText,
  })
  .strict();
export const eligibilityInput = z
  .object({
    status: z.nativeEnum(ComplianceStatus),
    companyValue: nullableText,
    evidence: nullableText,
    notes: nullableText,
  })
  .strict();
export const sectionInput = z
  .object({ editedContent: text.min(1), version: z.number().int().min(1) })
  .strict();
export const commercialInput = z
  .object({
    effortEstimate: nullableText,
    developmentCost: money,
    implementationCost: money,
    cloudCost: money,
    travelCost: money,
    supportCost: money,
    amcCost: money,
    taxAssumptions: nullableText,
    internalMargin: z.number().min(0).max(100).nullable().optional(),
    recommendedInternalRange: nullableText,
    approvedQuote: money,
    notes: nullableText,
  })
  .strict();
export const workspaceInput = z
  .object({ status: z.nativeEnum(BidStatus) })
  .strict();
export const submissionInput = z
  .object({
    submittedAt: z
      .string()
      .datetime({ offset: true })
      .transform((v) => new Date(v)),
    portalReference: text.min(1).max(500),
    submissionNotes: nullableText,
  })
  .strict();
const fit = z
  .object({
    rating: z.enum(['HIGH', 'MEDIUM', 'LOW', 'NEEDS_VERIFICATION']),
    explanation: text,
  })
  .strict();
const requirement = z
  .object({
    requirementType: text.min(1).max(200),
    requirement: text.min(1).max(2000),
    requiredValue: text.nullable(),
    sourceDocumentId: z.string().nullable(),
    sourcePage: z.number().int().positive().nullable(),
    clauseReference: text.nullable(),
    evidenceQuote: text.min(1).max(2000),
  })
  .strict();
export const analysisOutput = z
  .object({
    executiveSummary: text.min(1),
    serviceClassification: z.enum([
      'SOFTWARE_SERVICE',
      'IT_SERVICE',
      'SYSTEM_INTEGRATION',
      'SOFTWARE_MAINTENANCE',
      'MANAGED_SERVICE',
      'CLOUD_SERVICE',
      'CYBERSECURITY_SERVICE',
      'AI_DATA_SERVICE',
      'IOT_SOFTWARE',
      'DIGITAL_TWIN',
      'CONSULTING',
      'IMPLEMENTATION_SERVICE',
      'HYBRID',
      'PRODUCT_ONLY',
      'OTHER',
    ]),
    overallMatchScore: z.number().int().min(0).max(100),
    matchClassification: z.nativeEnum(MatchClassification),
    buyerWants: text,
    scope: text,
    deliverables: z.array(text).max(100),
    exclusions: z.array(text).max(100),
    technicalFit: fit,
    serviceFit: fit,
    domainFit: fit,
    experienceFit: fit,
    eligibilityFit: fit,
    teamFit: fit,
    certificationFit: fit,
    turnoverFit: fit,
    timelineFit: fit,
    documentationFit: fit,
    commercialRisk: fit,
    keyRisks: z.array(text).max(100),
    disqualificationRisks: z.array(text).max(100),
    clarifications: z.array(text).max(100),
    recommendedInternalActions: z.array(text).max(100),
    extractedTerms: z
      .object({
        emd: text.nullable(),
        deadline: text.nullable(),
        exemptions: text.nullable(),
        preferences: text.nullable(),
        paymentTerms: text.nullable(),
        penalties: text.nullable(),
        performanceSecurity: text.nullable(),
        evaluationCriteria: text.nullable(),
        sla: text.nullable(),
        supportPeriod: text.nullable(),
        technologies: text.nullable(),
        team: text.nullable(),
      })
      .strict(),
    requirements: z.array(requirement).max(150),
    requiredDocuments: z
      .array(
        z
          .object({
            documentType: z.enum(companyDocumentTypes),
            description: text.min(1),
            count: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const bidOutput = z
  .object({
    sections: z
      .array(
        z
          .object({
            sectionType: z.enum([
              'EXECUTIVE_SUMMARY',
              'UNDERSTANDING',
              'SOLUTION',
              'ARCHITECTURE',
              'TECH_STACK',
              'IMPLEMENTATION',
              'PROJECT_PLAN',
              'INTEGRATION',
              'SECURITY',
              'DEPLOYMENT',
              'TESTING',
              'TRAINING',
              'SUPPORT',
              'SLA',
              'AMC',
              'TEAM',
              'EXPERIENCE',
              'ASSUMPTIONS',
              'DEPENDENCIES',
              'CLARIFICATIONS',
              'RISKS',
            ]),
            content: text.min(1),
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict();
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    );
  return result.data;
}
