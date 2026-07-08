import { API_URL } from './leads';

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';

export interface Quotation {
  id: string;
  leadId: string;
  proposalId: string | null;
  scopeSummary: string;
  amount: number;
  currency: string;
  timeline: string | null;
  paymentTerms: string | null;
  status: QuotationStatus;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    title: string;
    clientName: string | null;
    clientEmail: string | null;
    sourceName: string;
  };
  proposal?: {
    id: string;
    proposalText: string;
    solutionSummary: string | null;
    timeline: string | null;
    budgetRange: string | null;
  } | null;
}

export interface GenerateQuotationPayload {
  leadId: string;
  proposalId?: string;
  amount?: string;
  currency?: string;
  paymentTerms?: string;
}

export async function fetchQuotations() {
  return apiFetch<Quotation[]>('/api/quotations');
}

export async function generateQuotation(payload: GenerateQuotationPayload) {
  return apiFetch<Quotation>('/api/quotations/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateQuotation(id: string, payload: Partial<Quotation>) {
  return apiFetch<Quotation>(`/api/quotations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function sendQuotationEmail(
  id: string,
  payload: { messageText?: string; subject?: string },
) {
  return apiFetch<Quotation>(`/api/quotations/${id}/send-email`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function formatQuotationStatus(status: QuotationStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
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
