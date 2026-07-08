export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const leadStatuses = [
  'NEW',
  'AI_REVIEWED',
  'QUALIFIED',
  'PROPOSAL_DRAFTED',
  'WAITING_APPROVAL',
  'PROPOSAL_SENT',
  'CLIENT_REPLIED',
  'FOLLOW_UP_NEEDED',
  'MEETING_SCHEDULED',
  'NEGOTIATION',
  'WON',
  'LOST',
  'REJECTED',
] as const;

export type LeadStatus = (typeof leadStatuses)[number];

export interface LeadSource {
  id: string;
  name: string;
  type: string;
  integrationType: string;
  status: string;
}

export interface LeadAnalysis {
  id: string;
  leadScore: number;
  priority: string;
  category: string | null;
  budgetQuality: string | null;
  clientSeriousness: string | null;
  aiSummary: string | null;
  recommendedAction: string | null;
  requiredSkillsJson: unknown;
  redFlagsJson: unknown;
}

export interface Lead {
  id: string;
  sourceId: string;
  sourceName: string;
  externalId: string | null;
  title: string;
  description: string;
  clientName: string | null;
  clientCountry: string | null;
  clientEmail: string | null;
  clientProfileUrl: string | null;
  projectUrl: string | null;
  budgetType: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string | null;
  skillsJson: unknown;
  postedAt: string | null;
  status: LeadStatus;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
  analysis: LeadAnalysis | null;
  proposals?: Array<{
    id: string;
    leadId: string;
    proposalText: string;
    solutionSummary: string | null;
    timeline: string | null;
    budgetRange: string | null;
    questionsJson: unknown;
    portfolioLinksJson: unknown;
    status: 'DRAFT' | 'WAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT';
    approvedById: string | null;
    approvedAt: string | null;
    sentMethod: string | null;
    sentAt: string | null;
    createdAt: string;
    updatedAt: string;
    approvedBy?: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
  }>;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface LeadFilters {
  sourceId?: string;
  status?: string;
  minScore?: string;
  from?: string;
  to?: string;
}

export interface LeadFormPayload {
  sourceId: string;
  title: string;
  description: string;
  clientName?: string;
  clientCountry?: string;
  clientEmail?: string;
  clientProfileUrl?: string;
  projectUrl?: string;
  budgetType?: string;
  budgetMin?: string;
  budgetMax?: string;
  currency?: string;
  skills?: string;
  postedAt?: string;
}

export async function fetchLeadSources() {
  return apiFetch<LeadSource[]>('/api/leads/sources');
}

export async function fetchLeads(filters: LeadFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const suffix = params.size ? `?${params.toString()}` : '';
  return apiFetch<Lead[]>(`/api/leads${suffix}`);
}

export async function fetchLead(id: string) {
  return apiFetch<Lead>(`/api/leads/${id}`);
}

export async function createLead(payload: LeadFormPayload) {
  return apiFetch<Lead>('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      budgetMin: payload.budgetMin || undefined,
      budgetMax: payload.budgetMax || undefined,
      postedAt: payload.postedAt || undefined,
    }),
  });
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  return apiFetch<Lead>(`/api/leads/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function analyzeLead(id: string) {
  return apiFetch<Lead>(`/api/leads/${id}/analyze`, {
    method: 'POST',
  });
}

export function formatStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function statusBadgeClass(status: LeadStatus) {
  if (status === 'WON') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION'].includes(status)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (['LOST', 'REJECTED'].includes(status)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

async function apiFetch<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }

  return response.json() as Promise<T>;
}
