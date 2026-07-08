'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  PipelineColumn,
  PipelineLead,
  fetchPipeline,
  moveStage,
  pipelineStatuses,
} from '@/lib/crm';
import { LeadStatus, formatStatus, statusBadgeClass } from '@/lib/leads';

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
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CRM Pipeline</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track leads across sales stages and move them through the pipeline.
          </p>
        </div>
        <div className="rounded-md border bg-white px-4 py-3 text-sm">
          <span className="text-slate-500">Pipeline leads</span>
          <span className="ml-2 font-semibold">{totalLeads}</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading pipeline...</p>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="grid min-w-[2200px] grid-cols-12 gap-3">
            {columns.map((column) => (
              <div
                key={column.status}
                className="rounded-md border bg-slate-50"
              >
                <div className="border-b bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">
                      {formatStatus(column.status)}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {column.leads.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-3 p-3">
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
                    <p className="rounded-md border border-dashed bg-white px-3 py-6 text-center text-sm text-slate-400">
                      No leads
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
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
    <article className="rounded-md border bg-white p-3 shadow-sm">
      <div className="space-y-2">
        <Link
          href={`/leads/${lead.id}`}
          className="block text-sm font-medium hover:underline"
        >
          {lead.title}
        </Link>
        <div className="flex flex-wrap gap-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(lead.status)}`}
          >
            {formatStatus(lead.status)}
          </span>
          {lead.analysis ? (
            <span className="rounded-full border px-2 py-0.5 text-xs text-slate-600">
              Score {lead.analysis.leadScore}
            </span>
          ) : null}
        </div>
        <div className="space-y-1 text-xs text-slate-600">
          <p>Source: {lead.sourceName}</p>
          <p>Budget: {formatBudget(lead)}</p>
          <p>Manager: {lead.assignedTo?.name ?? '-'}</p>
        </div>
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-600">Move to</span>
          <select
            value={lead.status}
            disabled={moving}
            onChange={(event) =>
              onMove(lead.id, event.target.value as LeadStatus)
            }
            className="w-full rounded-md border px-2 py-1.5"
          >
            {pipelineStatuses.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

function formatBudget(lead: PipelineLead) {
  if (!lead.budgetMin && !lead.budgetMax) {
    return '-';
  }

  const currency = lead.currency ?? '';
  if (lead.budgetMin && lead.budgetMax) {
    return `${currency} ${lead.budgetMin.toLocaleString()} - ${lead.budgetMax.toLocaleString()}`;
  }

  return `${currency} ${(lead.budgetMin ?? lead.budgetMax)?.toLocaleString()}`;
}
