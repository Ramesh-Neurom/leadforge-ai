'use client';

import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function ConversationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversations"
        subtitle="Client message history is available from each lead's detail page."
      />
      <EmptyState
        title="Open a lead to view its conversation"
        description="Message threads, AI drafts, and client replies are tracked per lead. Head to a lead to view or continue a conversation."
        icon={MessagesSquare}
        action={
          <Link href="/leads">
            <Button variant="accent">Go to Leads</Button>
          </Link>
        }
      />
    </div>
  );
}
