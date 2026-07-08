'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  FileText,
  Inbox,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react';
import { fetchLeads, type Lead } from '@/lib/leads';
import { fetchPipeline, type PipelineColumn } from '@/lib/crm';
import { fetchFollowups, isDueToday, type Followup } from '@/lib/followups';
import { useAdminUser } from '@/components/layout/admin-context';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatStatus } from '@/lib/leads';

const PLATFORMS: { label: string; match: string[]; icon: string }[] = [
  { label: 'Freelancer', match: ['freelancer'], icon: 'FL' },
  { label: 'Upwork', match: ['upwork'], icon: 'UP' },
  { label: 'Fiverr', match: ['fiverr'], icon: 'FV' },
  { label: 'LinkedIn', match: ['linkedin'], icon: 'IN' },
  { label: 'Indeed', match: ['indeed'], icon: 'ID' },
  { label: 'Remote Jobs', match: ['remote', 'remoteok'], icon: 'RO' },
];

export default function DashboardPage() {
  const user = useAdminUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipeline, setPipeline] = useState<PipelineColumn[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchLeads().catch(() => [] as Lead[]),
      fetchPipeline().catch(() => [] as PipelineColumn[]),
      fetchFollowups().catch(() => [] as Followup[]),
    ])
      .then(([nextLeads, nextPipeline, nextFollowups]) => {
        setLeads(nextLeads);
        setPipeline(nextPipeline);
        setFollowups(nextFollowups);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const count = (status: string) =>
      leads.filter((lead) => lead.status === status).length;

    const revenue = leads
      .filter((lead) => !['LOST', 'REJECTED'].includes(lead.status))
      .reduce((sum, lead) => sum + (lead.budgetMax ?? lead.budgetMin ?? 0), 0);

    const dueCount = followups.filter(
      (f) => f.status === 'PENDING' && isDueToday(f.scheduledAt),
    ).length;

    return {
      total: leads.length,
      new: count('NEW'),
      qualified: count('QUALIFIED'),
      proposalsSent: count('PROPOSAL_SENT'),
      clientReplies: count('CLIENT_REPLIED'),
      won: count('WON'),
      revenue,
      due: dueCount,
    };
  }, [leads, followups]);

  const recentLeads = useMemo(
    () =>
      [...leads]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 6),
    [leads],
  );

  const highPriorityLeads = useMemo(
    () =>
      leads
        .filter((lead) => lead.analysis?.priority?.toUpperCase() === 'HIGH')
        .sort(
          (a, b) =>
            (b.analysis?.leadScore ?? 0) - (a.analysis?.leadScore ?? 0),
        )
        .slice(0, 6),
    [leads],
  );

  const pipelineOverview = useMemo(() => {
    const maxCount = Math.max(
      1,
      ...pipeline.map((column) => column.leads.length),
    );
    return pipeline
      .filter((column) => column.leads.length > 0)
      .map((column) => ({
        status: column.status,
        count: column.leads.length,
        pct: Math.round((column.leads.length / maxCount) * 100),
      }));
  }, [pipeline]);

  const platformPerformance = useMemo(() => {
    return PLATFORMS.map((platform) => {
      const matched = leads.filter((lead) =>
        platform.match.some((needle) =>
          lead.sourceName?.toLowerCase().includes(needle),
        ),
      );
      return {
        ...platform,
        total: matched.length,
        won: matched.filter((lead) => lead.status === 'WON').length,
      };
    });
  }, [leads]);

  const revenueLabel = useMemo(() => {
    const currency = leads.find((lead) => lead.currency)?.currency ?? 'USD';
    return `${currency} ${stats.revenue.toLocaleString()}`;
  }, [leads, stats.revenue]);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900 p-6 text-white shadow-card sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
              <Sparkles className="h-3.5 w-3.5" />
              AI-powered acquisition
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Here is what is happening across your freelance acquisition
              pipeline today.
            </p>
          </div>
          <Link
            href="/leads"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
          >
            <Target className="h-4 w-4" />
            Manage Leads
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Leads" value={stats.total} icon={Inbox} accent="indigo" />
        <StatCard label="New Leads" value={stats.new} icon={Target} accent="blue" />
        <StatCard label="Qualified" value={stats.qualified} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Proposals Sent" value={stats.proposalsSent} icon={FileText} accent="violet" />
        <StatCard label="Client Replies" value={stats.clientReplies} icon={MessageSquare} accent="sky" />
        <StatCard label="Won Projects" value={stats.won} icon={Trophy} accent="amber" />
        <StatCard label="Revenue Pipeline" value={revenueLabel} icon={Wallet} accent="emerald" hint="Open opportunities" />
        <StatCard label="Follow-ups Due" value={stats.due} icon={TrendingUp} accent="rose" hint="Due today" />
      </div>

      {/* Recent + High priority */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card padded={false}>
          <div className="p-5">
            <CardHeader
              title="Recent Leads"
              description="Latest opportunities captured across all sources"
              action={
                <Link
                  href="/leads"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  View all
                </Link>
              }
            />
          </div>
          {loading ? (
            <ListSkeleton />
          ) : recentLeads.length ? (
            <ul className="divide-y divide-slate-100">
              {recentLeads.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {lead.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {lead.sourceName} • {formatDate(lead.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No leads yet"
                description="New leads will appear here as they are captured."
                icon={Inbox}
              />
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="p-5">
            <CardHeader
              title="High Priority Leads"
              description="AI-flagged leads that deserve immediate attention"
            />
          </div>
          {loading ? (
            <ListSkeleton />
          ) : highPriorityLeads.length ? (
            <ul className="divide-y divide-slate-100">
              {highPriorityLeads.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {lead.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        Score {lead.analysis?.leadScore ?? '—'} •{' '}
                        {lead.sourceName}
                      </p>
                    </div>
                    <PriorityBadge priority={lead.analysis?.priority} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No high-priority leads"
                description="Run AI analysis on leads to surface high-priority opportunities."
                icon={Sparkles}
              />
            </div>
          )}
        </Card>
      </div>

      {/* Pipeline overview */}
      <Card>
        <CardHeader
          title="Pipeline Overview"
          description="Distribution of leads across CRM stages"
          action={
            <Link
              href="/crm"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Open board
            </Link>
          }
        />
        <div className="mt-5 space-y-3">
          {pipelineOverview.length ? (
            pipelineOverview.map((row) => (
              <div key={row.status} className="flex items-center gap-3">
                <div className="w-40 shrink-0 truncate text-sm text-slate-600">
                  {formatStatus(row.status)}
                </div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <div className="w-8 shrink-0 text-right text-sm font-semibold text-slate-900">
                  {row.count}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="Pipeline is empty"
              description="Move leads through the CRM to see stage distribution."
            />
          )}
        </div>
      </Card>

      {/* Platform performance */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">
            Platform Performance
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {platformPerformance.map((platform) => (
            <div
              key={platform.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                  {platform.icon}
                </span>
                <span className="text-xs font-medium text-emerald-600">
                  {platform.won} won
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-500">
                {platform.label}
              </p>
              <p className="mt-0.5 text-xl font-semibold text-slate-900">
                {platform.total}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/70" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-200/70" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-slate-200/70" />
        </div>
      ))}
    </div>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}
