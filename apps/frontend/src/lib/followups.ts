import { API_URL } from './leads';

export type FollowupStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface Followup {
  id: string;
  leadId: string;
  followupType: string;
  message: string;
  scheduledAt: string;
  status: FollowupStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    title: string;
    clientName: string | null;
    sourceName: string;
    status: string;
    assignedTo?: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
    analysis?: {
      leadScore: number;
      priority: string;
    } | null;
  };
}

export interface FollowupPayload {
  leadId?: string;
  followupType?: string;
  message?: string;
  scheduledAt?: string;
  status?: FollowupStatus;
}

export async function fetchFollowups(leadId?: string) {
  const suffix = leadId ? `?leadId=${encodeURIComponent(leadId)}` : '';
  return apiFetch<Followup[]>(`/api/followups${suffix}`);
}

export async function createFollowup(payload: FollowupPayload) {
  return apiFetch<Followup>('/api/followups', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFollowup(id: string, payload: FollowupPayload) {
  return apiFetch<Followup>(`/api/followups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function completeFollowup(id: string) {
  return apiFetch<Followup>(`/api/followups/${id}/complete`, {
    method: 'POST',
  });
}

export async function generateFollowup(leadId: string) {
  return apiFetch<Followup>(`/api/leads/${leadId}/generate-followup`, {
    method: 'POST',
  });
}

export function formatFollowupStatus(status: FollowupStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function followupStatusBadgeClass(status: FollowupStatus) {
  if (status === 'COMPLETED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'CANCELLED') {
    return 'border-slate-200 bg-slate-50 text-slate-500';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export function isDueToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
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
