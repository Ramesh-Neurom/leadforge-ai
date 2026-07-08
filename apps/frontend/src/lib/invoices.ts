import { API_URL } from './leads';

export type InvoicePaymentStatus =
  'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
  id: string;
  leadId: string;
  clientName: string | null;
  amount: number;
  currency: string;
  invoiceNumber: string;
  invoicePdfUrl: string | null;
  paymentStatus: InvoicePaymentStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    title: string;
    clientName: string | null;
    clientEmail: string | null;
    sourceName: string;
  };
}

export interface InvoicePayload {
  leadId?: string;
  clientName?: string;
  amount?: string;
  currency?: string;
  invoiceNumber?: string;
  invoicePdfUrl?: string;
  paymentStatus?: InvoicePaymentStatus;
  dueDate?: string;
}

export async function fetchInvoices() {
  return apiFetch<Invoice[]>('/api/invoices');
}

export async function createInvoice(payload: InvoicePayload) {
  return apiFetch<Invoice>('/api/invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateInvoice(id: string, payload: InvoicePayload) {
  return apiFetch<Invoice>(`/api/invoices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function sendInvoiceEmail(
  id: string,
  payload: { messageText?: string; subject?: string },
) {
  return apiFetch<Invoice>(`/api/invoices/${id}/send-email`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function markInvoicePaid(id: string) {
  return apiFetch<Invoice>(`/api/invoices/${id}/mark-paid`, {
    method: 'POST',
  });
}

export function formatInvoiceStatus(status: InvoicePaymentStatus) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
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
