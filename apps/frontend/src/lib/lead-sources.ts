import { API_URL } from './leads';

export interface LeadSource {
  id: string;
  name: string;
  type: string;
  integrationType: string;
  status: string;
  configJson: unknown;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadSourcePayload {
  name: string;
  type?: string;
  integrationType: string;
  status?: string;
  configJson?: unknown;
}

export interface LeadSourceSyncResult {
  ok?: boolean;
  imported?: number;
  totalFetched?: number;
  passedFilter?: number;
  skippedDuplicate?: number;
  filteredOutJobPosts?: number;
  filteredOutIrrelevant?: number;
  filteredOutReasons?: string[];
  analyzed?: number;
  proposalGenerated?: number;
  message: string;
  sample?: unknown[];
}

export async function fetchLeadSources() {
  return apiFetch<LeadSource[]>('/api/lead-sources');
}

export async function createLeadSource(payload: LeadSourcePayload) {
  return apiFetch<LeadSource>('/api/lead-sources', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateLeadSource(
  id: string,
  payload: Partial<LeadSourcePayload>,
) {
  return apiFetch<LeadSource>(`/api/lead-sources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function testLeadSource(id: string) {
  return apiFetch<LeadSourceSyncResult>(`/api/lead-sources/${id}/test`, {
    method: 'POST',
  });
}

export async function syncLeadSource(id: string) {
  return apiFetch<LeadSourceSyncResult>(`/api/lead-sources/${id}/sync`, {
    method: 'POST',
  });
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
