'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Lead,
  LeadFilters,
  LeadFormPayload,
  LeadSource,
  createLead,
  fetchLeadSources,
  fetchLeads,
  formatStatus,
  leadStatuses,
  parseStringArray,
  statusBadgeClass,
} from '@/lib/leads';

const emptyForm: LeadFormPayload = {
  sourceId: '',
  title: '',
  description: '',
  clientName: '',
  clientCountry: '',
  clientEmail: '',
  clientProfileUrl: '',
  projectUrl: '',
  budgetType: 'FIXED',
  budgetMin: '',
  budgetMax: '',
  currency: 'USD',
  skills: '',
  postedAt: '',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [filters, setFilters] = useState<LeadFilters>({});
  const [form, setForm] = useState<LeadFormPayload>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeadSources()
      .then((items) => {
        setSources(items);
        setForm((current) => ({
          ...current,
          sourceId: current.sourceId || items[0]?.id || '',
        }));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    fetchLeads()
      .then(setAllLeads)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLeads(filters)
      .then(setLeads)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const cards = useMemo(
    () => [
      ['Total leads', allLeads.length],
      ['New leads', allLeads.filter((lead) => lead.status === 'NEW').length],
      [
        'Qualified leads',
        allLeads.filter((lead) => lead.status === 'QUALIFIED').length,
      ],
      [
        'Proposal sent',
        allLeads.filter((lead) => lead.status === 'PROPOSAL_SENT').length,
      ],
      ['Won leads', allLeads.filter((lead) => lead.status === 'WON').length],
    ],
    [allLeads],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createLead(form);
      setForm({
        ...emptyForm,
        sourceId: sources[0]?.id || '',
        currency: form.currency || 'USD',
      });
      const [nextLeads, nextAllLeads] = await Promise.all([
        fetchLeads(filters),
        fetchLeads(),
      ]);
      setLeads(nextLeads);
      setAllLeads(nextAllLeads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lead Management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Capture, qualify, and track sales opportunities.
          </p>
        </div>
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

      <form onSubmit={handleCreate} className="rounded-md border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Manual lead create</h2>
            <p className="text-sm text-slate-500">
              Add a lead from a marketplace, referral, or direct conversation.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || !form.sourceId}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? 'Saving...' : 'Create lead'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field
            label="Title"
            value={form.title}
            onChange={(title) => setForm({ ...form, title })}
            required
          />
          <label className="space-y-1 text-sm">
            <span className="font-medium">Source</span>
            <select
              value={form.sourceId}
              onChange={(event) =>
                setForm({ ...form, sourceId: event.target.value })
              }
              className="w-full rounded-md border px-3 py-2"
              required
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Client name"
            value={form.clientName}
            onChange={(clientName) => setForm({ ...form, clientName })}
          />
          <Field
            label="Client country"
            value={form.clientCountry}
            onChange={(clientCountry) => setForm({ ...form, clientCountry })}
          />
          <Field
            label="Client email"
            value={form.clientEmail}
            onChange={(clientEmail) => setForm({ ...form, clientEmail })}
          />
          <Field
            label="Project URL"
            value={form.projectUrl}
            onChange={(projectUrl) => setForm({ ...form, projectUrl })}
          />
          <Field
            label="Budget min"
            value={form.budgetMin}
            onChange={(budgetMin) => setForm({ ...form, budgetMin })}
          />
          <Field
            label="Budget max"
            value={form.budgetMax}
            onChange={(budgetMax) => setForm({ ...form, budgetMax })}
          />
          <Field
            label="Currency"
            value={form.currency}
            onChange={(currency) => setForm({ ...form, currency })}
          />
          <Field
            label="Skills"
            value={form.skills}
            onChange={(skills) => setForm({ ...form, skills })}
            placeholder="Next.js, CRM, API"
          />
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium">Description</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              className="min-h-24 w-full rounded-md border px-3 py-2"
              required
            />
          </label>
        </div>
      </form>

      <div className="rounded-md border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Source</span>
            <select
              value={filters.sourceId ?? ''}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  sourceId: event.target.value || undefined,
                })
              }
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">All sources</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Status</span>
            <select
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  status: event.target.value || undefined,
                })
              }
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">All statuses</option>
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Min score"
            value={filters.minScore ?? ''}
            onChange={(minScore) => setFilters({ ...filters, minScore })}
          />
          <Field
            label="From date"
            type="date"
            value={filters.from ?? ''}
            onChange={(from) => setFilters({ ...filters, from })}
          />
          <Field
            label="To date"
            type="date"
            value={filters.to ?? ''}
            onChange={(to) => setFilters({ ...filters, to })}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Posted</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Loading leads...
                  </td>
                </tr>
              ) : leads.length ? (
                leads.map((lead) => (
                  <tr key={lead.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-slate-950 hover:underline"
                      >
                        {lead.title}
                      </Link>
                      <p className="mt-1 line-clamp-2 max-w-xl text-slate-500">
                        {lead.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {parseStringArray(lead.skillsJson)
                          .slice(0, 4)
                          .map((skill) => (
                            <span
                              key={skill}
                              className="rounded border px-2 py-0.5 text-xs text-slate-600"
                            >
                              {skill}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.sourceName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeClass(lead.status)}`}
                      >
                        {formatStatus(lead.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.analysis?.leadScore ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatBudget(lead)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(lead.postedAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No leads match the current filters.
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}

function formatBudget(lead: Lead) {
  if (!lead.budgetMin && !lead.budgetMax) {
    return '-';
  }

  const currency = lead.currency ?? '';
  if (lead.budgetMin && lead.budgetMax) {
    return `${currency} ${lead.budgetMin.toLocaleString()} - ${lead.budgetMax.toLocaleString()}`;
  }

  return `${currency} ${(lead.budgetMin ?? lead.budgetMax)?.toLocaleString()}`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}
