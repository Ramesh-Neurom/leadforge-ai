'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { govt, Workspace, dateLabel } from '@/lib/government';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
export default function Bids() {
  const [items, setItems] = useState<Workspace[]>();
  const [error, setError] = useState('');
  useEffect(() => {
    govt<Workspace[]>('/bid-workspaces')
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bid Workspaces"
        subtitle="Internal bid preparation and approval. Final portal submission is manual."
      />
      {error && <p role="alert">{error}</p>}
      {!items && !error && <p>Loading bid workspaces…</p>}
      {items?.length === 0 && (
        <p>Create a bid workspace from a tender to begin.</p>
      )}
      {items?.map((w) => (
        <Card key={w.id} className="p-5">
          <Link
            className="font-semibold text-indigo-700"
            href={`/government/tenders/${w.tenderId}?tab=Bid`}
          >
            {w.tender?.title}
          </Link>
          <p>
            {w.status} · Deadline: {dateLabel(w.tender?.closesAt)}
          </p>
          <p className="text-sm text-slate-500">
            Technical: {w.technicalApprovalStatus} · Documents:{' '}
            {w.documentApprovalStatus} · Commercial:{' '}
            {w.commercialApprovalStatus}
          </p>
        </Card>
      ))}
    </div>
  );
}
