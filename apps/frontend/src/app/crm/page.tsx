'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KanbanSquare, User } from 'lucide-react';
import {
  PipelineColumn,
  PipelineLead,
  fetchPipeline,
  moveStage,
  pipelineStatuses,
} from '@/lib/crm';
import { LeadStatus, formatStatus } from '@/lib/leads';
import { PageHeader } from '@/components/ui/PageHeader';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { cn } from '@/lib/utils';

/** Accent color used on each column's header strip. */
const columnAccent: Partial<Record<LeadStatus, string>> = {
  NEW: 'bg-slate-400',
  AI_REVIEWED: 'bg-indigo-400',
  QUALIFIED: 'bg-blue-500',
  PROPOSAL_DRAFTED: 'bg-violet-400',
  WAITING_APPROVAL: 'bg-amber-400',
  PROPOSAL_SENT: 'bg-sky-500',
  CLIENT_REPLIED: 'bg-cyan-500',
  FOLLOW_UP_NEEDED: 'bg-orange-400',
  MEETING_SCHEDULED: 'bg-purple-500',
  NEGOTIATION: 'bg-teal-500',
  WON: 'bg-emerald-500',
  LOST: 'bg-rose-500',
};

export default function CrmPage() {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPipeline();
  }, []);

  const totalLeads = useMemo(
    () => columns.reduce((total, column) => total + column.leads.length, 0),
    [columns],
  );

  async function loadPipeline() {
    setLoading(true);
    fetchPipeline()
      .then(setColumns)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleMove(leadId: string, status: LeadStatus) {
    setMovingLeadId(leadId);
    setError(null);
    try {
      await moveStage(leadId, status);
      setColumns(await fetchPipeline());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to move lead');
    } finally {
      setMovingLeadId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM Pipeline"
        subtitle="Track leads across sales stages and move them through the pipeline."
        actions={
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-card">
            <KanbanSquare className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Pipeline leads</span>
            <span className="font-semibold text-slate-900">{totalLeads}</span>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingState label="Loading pipeline..." />
      ) : (
        <div className="scrollbar-thin overflow-x-auto pb-3">
          <div className="flex gap-4">
            {columns.map((column) => (
              <div
                key={column.status}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/80"
              >
                <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        columnAccent[column.status] ?? 'bg-slate-400',
                      )}
                    />
                    <h2 className="text-sm font-semibold text-slate-800">
                      {formatStatus(column.status)}
                    </h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {column.leads.length}
                  </span>
                </div>
                <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-3">
                  {column.leads.length ? (
                    column.leads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        moving={movingLeadId === lead.id}
                        onMove={handleMove}
                      />
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-400">
                      No leads
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  moving,
  onMove,
}: {
  lead: PipelineLead;
  moving: boolean;
  onMove: (leadId: string, status: LeadStatus) => void;
}) {
  return (
    <article
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-card-hover',
        moving && 'opacity-60',
      )}
    >
      <Link
        href={`/leads/${lead.id}`}
        className="block text-sm font-medium text-slate-900 hover:text-indigo-600"
      >
        {lead.title}
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {lead.analysis ? (
          <>
            <PriorityBadge priority={lead.analysis.priority} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Score {lead.analysis.leadScore}
            </span>
          </>
        ) : null}
      </div>

      <dl className="mt-3 space-y-1 text-xs text-slate-500">
        <div className="flex justify-between gap-2">
          <dt>Source</dt>
          <dd className="font-medium text-slate-700">{lead.sourceName}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Budget</dt>
          <dd className="font-medium text-slate-700">{formatBudget(lead)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Assigned</dt>
          <dd className="flex items-center gap-1 font-medium text-slate-700">
            <User className="h-3 w-3 text-slate-400" />
            {lead.assignedTo?.name ?? 'Unassigned'}
          </dd>
        </div>
      </dl>

      <label className="mt-3 block">
        <span className="sr-only">Move to stage</span>
        <select
          value={lead.status}
          disabled={moving}
          onChange={(event) => onMove(lead.id, event.target.value as LeadStatus)}
          className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
        >
          {pipelineStatuses.map((status) => (
            <option key={status} value={status}>
              Move to: {formatStatus(status)}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function formatBudget(lead: PipelineLead) {
  if (!lead.budgetMin && !lead.budgetMax) {
    return '—';
  }
  const currency = lead.currency ?? '';
  if (lead.budgetMin && lead.budgetMax) {
    return `${currency} ${lead.budgetMin.toLocaleString()} - ${lead.budgetMax.toLocaleString()}`;
  }
  return `${currency} ${(lead.budgetMin ?? lead.budgetMax)?.toLocaleString()}`;
}
