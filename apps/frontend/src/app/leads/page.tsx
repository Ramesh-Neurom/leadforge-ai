'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Inbox, Plus, Target, Trophy, X } from 'lucide-react';
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
} from '@/lib/leads';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { Input, Select, LabeledField, Textarea } from '@/components/ui/Field';
import { Table, TableWrapper, Td, Th, Thead } from '@/components/ui/DataTable';

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
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [form, setForm] = useState<LeadFormPayload>(emptyForm);
  const [showForm, setShowForm] = useState(false);
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

  const visibleLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch =
        !term ||
        lead.title.toLowerCase().includes(term) ||
        lead.description.toLowerCase().includes(term) ||
        (lead.clientName ?? '').toLowerCase().includes(term);
      const matchesPriority =
        !priority ||
        lead.analysis?.priority?.toUpperCase() === priority.toUpperCase();
      return matchesSearch && matchesPriority;
    });
  }, [leads, search, priority]);

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
      setShowForm(false);
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
    <div className="space-y-6">
      <PageHeader
        title="Lead Management"
        subtitle="Capture, qualify, and track sales opportunities."
        actions={
          <Button variant="accent" onClick={() => setShowForm((v) => !v)}>
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {showForm ? 'Close' : 'Add Lead'}
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total leads"
          value={allLeads.length}
          icon={Inbox}
          accent="indigo"
        />
        <StatCard
          label="New"
          value={allLeads.filter((l) => l.status === 'NEW').length}
          icon={Target}
          accent="blue"
        />
        <StatCard
          label="Qualified"
          value={allLeads.filter((l) => l.status === 'QUALIFIED').length}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Proposal sent"
          value={allLeads.filter((l) => l.status === 'PROPOSAL_SENT').length}
          icon={Target}
          accent="violet"
        />
        <StatCard
          label="Won"
          value={allLeads.filter((l) => l.status === 'WON').length}
          icon={Trophy}
          accent="amber"
        />
      </div>

      {/* Create form */}
      {showForm ? (
        <Card>
          <form onSubmit={handleCreate}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  New lead
                </h2>
                <p className="text-sm text-slate-500">
                  Add a lead from a marketplace, referral, or direct
                  conversation.
                </p>
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !form.sourceId}
              >
                {saving ? 'Saving...' : 'Create lead'}
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <LabeledField label="Title">
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </LabeledField>
              <LabeledField label="Source">
                <Select
                  value={form.sourceId}
                  onChange={(e) =>
                    setForm({ ...form, sourceId: e.target.value })
                  }
                  required
                >
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </Select>
              </LabeledField>
              <LabeledField label="Client name">
                <Input
                  value={form.clientName}
                  onChange={(e) =>
                    setForm({ ...form, clientName: e.target.value })
                  }
                />
              </LabeledField>
              <LabeledField label="Client country">
                <Input
                  value={form.clientCountry}
                  onChange={(e) =>
                    setForm({ ...form, clientCountry: e.target.value })
                  }
                />
              </LabeledField>
              <LabeledField label="Client email">
                <Input
                  value={form.clientEmail}
                  onChange={(e) =>
                    setForm({ ...form, clientEmail: e.target.value })
                  }
                />
              </LabeledField>
              <LabeledField label="Project URL">
                <Input
                  value={form.projectUrl}
                  onChange={(e) =>
                    setForm({ ...form, projectUrl: e.target.value })
                  }
                />
              </LabeledField>
              <LabeledField label="Budget min">
                <Input
                  value={form.budgetMin}
                  onChange={(e) =>
                    setForm({ ...form, budgetMin: e.target.value })
                  }
                />
              </LabeledField>
              <LabeledField label="Budget max">
                <Input
                  value={form.budgetMax}
                  onChange={(e) =>
                    setForm({ ...form, budgetMax: e.target.value })
                  }
                />
              </LabeledField>
              <LabeledField label="Currency">
                <Input
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                />
              </LabeledField>
              <LabeledField label="Skills" hint="Comma separated">
                <Input
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="Next.js, CRM, API"
                />
              </LabeledField>
              <LabeledField label="Description" className="md:col-span-2">
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="min-h-24"
                  required
                />
              </LabeledField>
            </div>
          </form>
        </Card>
      ) : null}

      {/* Filters */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by title, client..."
      >
        <Select
          value={filters.sourceId ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, sourceId: e.target.value || undefined })
          }
          className="lg:w-40"
        >
          <option value="">All sources</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.status ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, status: e.target.value || undefined })
          }
          className="lg:w-44"
        >
          <option value="">All statuses</option>
          {leadStatuses.map((status) => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </Select>
        <Select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="lg:w-36"
        >
          <option value="">All priority</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </Select>
        <Input
          type="date"
          value={filters.from ?? ''}
          onChange={(e) =>
            setFilters({ ...filters, from: e.target.value || undefined })
          }
          className="lg:w-40"
        />
      </SearchFilterBar>

      {/* Table */}
      {loading ? (
        <TableWrapper>
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-full animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        </TableWrapper>
      ) : visibleLeads.length ? (
        <TableWrapper>
          <Table minWidth="min-w-[1000px]">
            <Thead>
              <tr>
                <Th>Lead</Th>
                <Th>Type</Th>
                <Th>Source</Th>
                <Th>Budget</Th>
                <Th>Score</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Assigned</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </Thead>
            <tbody className="divide-y divide-slate-100">
              {visibleLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="align-top transition-colors hover:bg-slate-50"
                >
                  <Td>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {lead.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 max-w-md text-xs text-slate-500">
                      {lead.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {parseStringArray(lead.skillsJson)
                        .slice(0, 4)
                        .map((skill) => (
                          <span
                            key={skill}
                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600"
                          >
                            {skill}
                          </span>
                        ))}
                    </div>
                  </Td>
                  <Td>
                    <OpportunityBadge type={lead.opportunityType} />
                  </Td>
                  <Td className="text-slate-600">{lead.sourceName}</Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {formatBudget(lead)}
                  </Td>
                  <Td>
                    <span className="font-semibold text-slate-900">
                      {lead.analysis?.leadScore ?? '—'}
                    </span>
                  </Td>
                  <Td>
                    <PriorityBadge priority={lead.analysis?.priority} />
                  </Td>
                  <Td>
                    <StatusBadge status={lead.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {lead.assignedTo?.name ?? '—'}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {formatDate(lead.createdAt)}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      View
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      ) : (
        <EmptyState
          title="No leads found"
          description="No leads match the current filters. Adjust filters or add a new lead."
          icon={Inbox}
          action={
            <Button variant="accent" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          }
        />
      )}
    </div>
  );
}

function formatBudget(lead: Lead) {
  if (!lead.budgetMin && !lead.budgetMax) {
    return '—';
  }
  const currency = lead.currency ?? '';
  if (lead.budgetMin && lead.budgetMax) {
    return `${currency} ${lead.budgetMin.toLocaleString()} - ${lead.budgetMax.toLocaleString()}`;
  }
  return `${currency} ${(lead.budgetMin ?? lead.budgetMax)?.toLocaleString()}`;
}

function OpportunityBadge({ type }: { type: Lead['opportunityType'] }) {
  if (!type) {
    return <span className="text-slate-400">-</span>;
  }

  const isProject = type === 'PROJECT_LEAD';
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium ${
        isProject
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
      }`}
    >
      {type}
    </span>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}
