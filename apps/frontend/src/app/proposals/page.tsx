'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Proposal,
  fetchProposals,
  formatProposalStatus,
  proposalStatusBadgeClass,
} from '@/lib/proposals';

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProposals()
      .then(setProposals)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const cards = useMemo(
    () => [
      ['Total proposals', proposals.length],
      [
        'Drafts',
        proposals.filter((proposal) => proposal.status === 'DRAFT').length,
      ],
      [
        'Waiting approval',
        proposals.filter((proposal) => proposal.status === 'WAITING_APPROVAL')
          .length,
      ],
      [
        'Approved',
        proposals.filter((proposal) => proposal.status === 'APPROVED').length,
      ],
      [
        'Sent',
        proposals.filter((proposal) => proposal.status === 'SENT').length,
      ],
    ],
    [proposals],
  );

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Proposals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review proposal drafts, approvals, and sent status.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-md border bg-white p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Timeline</th>
                <th className="px-4 py-3 font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Approved</th>
                <th className="px-4 py-3 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Loading proposals...
                  </td>
                </tr>
              ) : proposals.length ? (
                proposals.map((proposal) => (
                  <tr key={proposal.id} className="align-top">
                    <td className="px-4 py-3">
                      {proposal.lead ? (
                        <Link
                          href={`/leads/${proposal.lead.id}`}
                          className="font-medium text-slate-950 hover:underline"
                        >
                          {proposal.lead.title}
                        </Link>
                      ) : (
                        <span className="font-medium">Lead unavailable</span>
                      )}
                      <p className="mt-1 max-w-xl text-slate-500 line-clamp-2">
                        {proposal.solutionSummary || proposal.proposalText}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${proposalStatusBadgeClass(proposal.status)}`}
                      >
                        {formatProposalStatus(proposal.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {proposal.timeline || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {proposal.budgetRange || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {proposal.approvedBy
                        ? `${proposal.approvedBy.name} on ${formatDate(proposal.approvedAt)}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {proposal.sentAt
                        ? `${proposal.sentMethod ?? 'Manual'} on ${formatDate(proposal.sentAt)}`
                        : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No proposals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}
