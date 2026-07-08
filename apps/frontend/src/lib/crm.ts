import { API_URL, LeadStatus, formatStatus } from './leads';

export const pipelineStatuses: LeadStatus[] = [
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
];

export interface PipelineLead {
  id: string;
  title: string;
  sourceName: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string | null;
  status: LeadStatus;
  analysis: {
    leadScore: number;
    priority: string;
  } | null;
  assignedTo: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface PipelineColumn {
  status: LeadStatus;
  leads: PipelineLead[];
}

export interface CrmActivity {
  id: string;
  leadId: string;
  userId: string;
  activityType: string;
  description: string;
  metadataJson: unknown;
  createdAt: string;
  lead?: {
    id: string;
    title: string;
    status: LeadStatus;
    sourceName: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export async function fetchPipeline() {
  return apiFetch<PipelineColumn[]>('/api/crm/pipeline');
}

export async function moveStage(leadId: string, status: LeadStatus) {
  return apiFetch<PipelineLead>('/api/crm/move-stage', {
    method: 'POST',
    body: JSON.stringify({ leadId, status }),
  });
}

export async function fetchCrmActivities() {
  return apiFetch<CrmActivity[]>('/api/crm/activities');
}

export async function fetchLeadActivities(leadId: string) {
  return apiFetch<CrmActivity[]>(`/api/leads/${leadId}/activities`);
}

export function formatActivityType(type: string) {
  return formatStatus(type as LeadStatus);
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
