'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import {
  Proposal,
  ProposalStatus,
  fetchProposals,
  formatProposalStatus,
} from '@/lib/proposals';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Table,
  TableWrapper,
  Td,
  Th,
  Thead,
} from '@/components/ui/DataTable';
import { cn } from '@/lib/utils';

const TABS: { label: string; value: 'ALL' | ProposalStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Waiting Approval', value: 'WAITING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Rejected', value: 'REJECTED' },
];

function proposalTone(status: ProposalStatus): BadgeTone {
  switch (status) {
    case 'APPROVED':
      return 'emerald';
    case 'SENT':
      return 'blue';
    case 'REJECTED':
      return 'rose';
    case 'WAITING_APPROVAL':
      return 'amber';
    default:
      return 'slate';
  }
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tab, setTab] = useState<'ALL' | ProposalStatus>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProposals()
      .then(setProposals)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const base: Record<string, number> = { ALL: proposals.length };
    for (const proposal of proposals) {
      base[proposal.status] = (base[proposal.status] ?? 0) + 1;
    }
    return base;
  }, [proposals]);

  const filtered = useMemo(
    () =>
      tab === 'ALL'
        ? proposals
        : proposals.filter((proposal) => proposal.status === tab),
    [proposals, tab],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        subtitle="Review proposal drafts, approvals, and sent status."
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-card">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === item.value
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {item.label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[11px]',
                tab === item.value
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500',
              )}
            >
              {counts[item.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <TableWrapper>
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-full animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        </TableWrapper>
      ) : filtered.length ? (
        <TableWrapper>
          <Table>
            <Thead>
              <tr>
                <Th>Lead</Th>
                <Th>Status</Th>
                <Th>Timeline</Th>
                <Th>Budget</Th>
                <Th>Approved</Th>
                <Th>Sent</Th>
              </tr>
            </Thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((proposal) => (
                <tr
                  key={proposal.id}
                  className="align-top transition-colors hover:bg-slate-50"
                >
                  <Td>
                    {proposal.lead ? (
                      <Link
                        href={`/leads/${proposal.lead.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {proposal.lead.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-500">
                        Lead unavailable
                      </span>
                    )}
                    <p className="mt-1 line-clamp-2 max-w-xl text-xs text-slate-500">
                      {proposal.solutionSummary || proposal.proposalText}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={proposalTone(proposal.status)} dot>
                      {formatProposalStatus(proposal.status)}
                    </Badge>
                  </Td>
                  <Td className="text-slate-600">{proposal.timeline || '—'}</Td>
                  <Td className="text-slate-600">
                    {proposal.budgetRange || '—'}
                  </Td>
                  <Td className="text-slate-600">
                    {proposal.approvedBy
                      ? `${proposal.approvedBy.name} on ${formatDate(proposal.approvedAt)}`
                      : '—'}
                  </Td>
                  <Td className="text-slate-600">
                    {proposal.sentAt
                      ? `${proposal.sentMethod ?? 'Manual'} on ${formatDate(proposal.sentAt)}`
                      : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      ) : (
        <EmptyState
          title="No proposals"
          description="Generate proposals from qualified leads to see them listed here."
          icon={FileText}
        />
      )}
    </div>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}
