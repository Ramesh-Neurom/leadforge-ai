import { API_URL } from './leads';

export type SenderType = 'CLIENT' | 'MANAGER' | 'AI_DRAFT' | 'SYSTEM';

export interface Message {
  id: string;
  conversationId: string;
  senderType: SenderType;
  messageText: string;
  messageChannel: string;
  aiSummary: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  leadId: string;
  clientName: string | null;
  source: string;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export async function fetchConversation(leadId: string) {
  return apiFetch<Conversation>(`/api/conversations/${leadId}`);
}

export async function saveConversationMessage(
  leadId: string,
  payload: {
    senderType?: SenderType;
    messageText: string;
    messageChannel?: string;
    aiSummary?: string;
  },
) {
  return apiFetch<Conversation>(`/api/conversations/${leadId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
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
