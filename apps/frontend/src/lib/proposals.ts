import { API_URL } from './leads';

export const proposalStatuses = [
  'DRAFT',
  'WAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SENT',
] as const;

export type ProposalStatus = (typeof proposalStatuses)[number];

export interface Proposal {
  id: string;
  leadId: string;
  proposalText: string;
  solutionSummary: string | null;
  timeline: string | null;
  budgetRange: string | null;
  questionsJson: unknown;
  portfolioLinksJson: unknown;
  status: ProposalStatus;
  approvedById: string | null;
  approvedAt: string | null;
  sentMethod: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    title: string;
    clientName: string | null;
    clientCountry: string | null;
    sourceName: string;
    status: string;
  };
  approvedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface ProposalPayload {
  proposalText?: string;
  solutionSummary?: string | null;
  timeline?: string | null;
  budgetRange?: string | null;
  questions?: string;
  portfolioLinks?: string;
  status?: ProposalStatus;
  sentMethod?: string | null;
}

export async function fetchProposals() {
  return apiFetch<Proposal[]>('/api/proposals');
}

export async function fetchProposal(id: string) {
  return apiFetch<Proposal>(`/api/proposals/${id}`);
}

export async function generateProposal(leadId: string) {
  return apiFetch<Proposal>(`/api/leads/${leadId}/generate-proposal`, {
    method: 'POST',
  });
}

export async function updateProposal(id: string, payload: ProposalPayload) {
  return apiFetch<Proposal>(`/api/proposals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function approveProposal(id: string) {
  return apiFetch<Proposal>(`/api/proposals/${id}/approve`, {
    method: 'POST',
  });
}

export async function rejectProposal(id: string) {
  return apiFetch<Proposal>(`/api/proposals/${id}/reject`, {
    method: 'POST',
  });
}

export async function markProposalSent(id: string, sentMethod = 'Manual') {
  return apiFetch<Proposal>(`/api/proposals/${id}/mark-sent`, {
    method: 'POST',
    body: JSON.stringify({ sentMethod }),
  });
}

export async function sendProposalEmail(
  id: string,
  payload: { messageText: string; subject?: string },
) {
  return apiFetch<{ proposal: Proposal }>(`/api/proposals/${id}/send-email`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function copyProposalForManualSend(
  id: string,
  messageText: string,
) {
  return apiFetch<{ proposal: Proposal; messageText: string }>(
    `/api/proposals/${id}/copy-manual-send`,
    {
      method: 'POST',
      body: JSON.stringify({ messageText }),
    },
  );
}

export function formatProposalStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function proposalStatusBadgeClass(status: ProposalStatus) {
  if (status === 'APPROVED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'SENT') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (status === 'REJECTED') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
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
