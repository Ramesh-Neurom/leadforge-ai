export const apiBase =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api';
export async function govt<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(apiBase + path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers:
      body instanceof FormData
        ? undefined
        : { 'Content-Type': 'application/json' },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: 'Request failed' }));
    throw new Error(
      Array.isArray(error.message)
        ? error.message.join(', ')
        : (error.message ?? 'Request failed'),
    );
  }
  return response.json();
}
export type RecordValues = Record<
  string,
  string | number | boolean | null | undefined
>;
export interface Source {
  id: string;
  name: string;
  integrationType: string;
  status: string;
  configJson: {
    keywords: string[];
    excludeKeywords: string[];
    hardwareKeywords: string[];
    syncIntervalHours: number;
  };
  lastSyncStatus?: string;
  lastSyncMessage?: string;
}
export interface Document {
  id: string;
  name: string;
  documentType: string;
  processingStatus?: string;
  processingError?: string;
  status?: string;
  expiryDate?: string;
  issuer?: string;
  issueDate?: string;
  notes?: string;
}
export interface Requirement {
  id: string;
  requirement: string;
  requirementType?: string;
  requiredValue?: string;
  companyValue?: string;
  status?: string;
  complianceStatus?: string;
  clauseReference?: string;
  documentReference?: string;
  sourceDocumentId?: string;
  sourcePage?: number;
  pageReference?: number;
  evidence?: string;
  companyDocumentId?: string;
  notes?: string;
  confirmedById?: string;
}
export interface Section {
  id: string;
  sectionType: string;
  generatedContent: string;
  editedContent: string | null;
  version: number;
}
export interface Workspace {
  id: string;
  tenderId: string;
  status: string;
  technicalApprovalStatus: string;
  documentApprovalStatus: string;
  commercialApprovalStatus: string;
  sections: Section[];
  portalReference?: string;
  submittedAt?: string;
  tender?: { id: string; title: string; bidNumber: string; closesAt: string };
}
export interface Analysis {
  executiveSummary: string;
  serviceClassification: string;
  overallMatchScore: number;
  matchClassification: string;
  rawStructuredResult: Record<string, unknown>;
}
export interface Tender {
  id: string;
  title: string;
  bidNumber: string | null;
  buyerName: string | null;
  ministry?: string;
  department?: string;
  state?: string;
  locationText?: string;
  serviceCategory?: string;
  tenderType?: string;
  estimatedValue: string | null;
  currency: string;
  emdAmount: string | null;
  closesAt: string | null;
  publishedAt?: string;
  status: string;
  description?: string;
  scopeOfWork?: string;
  contractDuration?: string;
  sourceUrl?: string;
  relevance: string;
  relevanceReason?: string;
  source: Source;
  analysis: Analysis | null;
  documents: Document[];
  eligibility: Requirement[];
  compliance: Requirement[];
  workspace: Workspace | null;
  revisions: {
    id: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
    createdAt: string;
  }[];
  activities: {
    id: string;
    action: string;
    actorUserId: string;
    createdAt: string;
  }[];
}
export interface Readiness {
  analyzed: boolean;
  items: {
    documentType: string;
    description: string;
    count: number;
    available: number;
    status: string;
    verification: string;
    documents: { id: string; name: string }[];
  }[];
}
export interface Dashboard {
  metrics: Record<string, number>;
  priority: { id: string; title: string; closesAt: string }[];
  closing: { id: string; title: string; closesAt: string }[];
  revisions: {
    id: string;
    tenderId: string;
    fieldName: string;
    newValue: string;
  }[];
  analyses: { tenderId: string; executiveSummary: string }[];
  missing: Document[];
  notifications: {
    id: string;
    tenderId: string | null;
    message: string;
    readAt: string | null;
  }[];
}
export interface Capability {
  id: string;
  category: string;
  name: string;
  description: string | null;
  proficiency: string | null;
  keywords: string[];
  active: boolean;
}
export const tenderStatuses = [
  'NEW',
  'RELEVANCE_REVIEW',
  'ANALYZED',
  'QUALIFICATION_PENDING',
  'QUALIFIED',
  'NOT_QUALIFIED',
  'NOT_PURSUING',
  'BID_PREPARATION',
  'INTERNAL_REVIEW',
  'READY_FOR_SUBMISSION',
  'SUBMITTED',
  'AWARDED',
  'LOST',
  'CANCELLED',
  'EXPIRED',
];
export const complianceStatuses = [
  'NEEDS_VERIFICATION',
  'COMPLIANT',
  'PARTIALLY_COMPLIANT',
  'NOT_COMPLIANT',
  'NOT_APPLICABLE',
];
export const documentTypes = [
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
];
export const label = (s: string) =>
  s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const dateLabel = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString() : 'Unknown';
