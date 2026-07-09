'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Database, Plug, RefreshCw, Rss, TestTube2 } from 'lucide-react';
import {
  LeadSource,
  LeadSourceSyncResult,
  createLeadSource,
  fetchLeadSources,
  syncLeadSource,
  testLeadSource,
} from '../../lib/lead-sources';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, LabeledField } from '@/components/ui/Field';

/** Two-letter avatar + tone for known integrations. */
function sourceBrand(source: LeadSource): { icon: string; tone: string } {
  const key = `${source.integrationType} ${source.name}`.toLowerCase();
  if (key.includes('freelancer')) return { icon: 'FL', tone: 'bg-sky-600' };
  if (key.includes('remote')) return { icon: 'RO', tone: 'bg-orange-500' };
  if (key.includes('upwork')) return { icon: 'UP', tone: 'bg-emerald-600' };
  if (key.includes('fiverr')) return { icon: 'FV', tone: 'bg-green-600' };
  if (key.includes('linkedin')) return { icon: 'IN', tone: 'bg-blue-700' };
  if (key.includes('indeed')) return { icon: 'ID', tone: 'bg-indigo-600' };
  if (key.includes('manual')) return { icon: 'ME', tone: 'bg-slate-500' };
  if (key.includes('rss')) return { icon: 'RS', tone: 'bg-amber-500' };
  return { icon: 'LS', tone: 'bg-slate-700' };
}

function statusTone(status: string): BadgeTone {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'emerald';
    case 'DISABLED':
      return 'rose';
    default:
      return 'slate';
  }
}

export default function SettingsPage() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [name, setName] = useState('Generic RSS Leads');
  const [feedUrl, setFeedUrl] = useState('');
  const [message, setMessage] = useState('');
  const [syncResult, setSyncResult] = useState<LeadSourceSyncResult | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSources().catch((error) => setMessage(error.message));
  }, []);

  async function loadSources() {
    const data = await fetchLeadSources();
    setSources(data);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage('');
    try {
      await createLeadSource({
        name,
        type: 'RSS',
        integrationType: 'GENERIC_RSS',
        status: 'ACTIVE',
        configJson: { feedUrl },
      });
      setFeedUrl('');
      setMessage('RSS source added.');
      await loadSources();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to add source',
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(source: LeadSource, action: 'test' | 'sync') {
    setBusyId(`${source.id}:${action}`);
    setMessage('');
    setSyncResult(null);
    try {
      const result =
        action === 'test'
          ? await testLeadSource(source.id)
          : await syncLeadSource(source.id);
      setMessage(result.message);
      setSyncResult(action === 'sync' ? result : null);
      await loadSources();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
      await loadSources().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Sources"
        subtitle="Manage integrations and RSS feeds that supply new leads."
      />

      {/* Add RSS feed */}
      <Card>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Rss className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Add RSS feed
            </h2>
            <p className="text-sm text-slate-500">
              Connect any job board or marketplace RSS feed.
            </p>
          </div>
        </div>
        <form
          onSubmit={handleCreate}
          className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end"
        >
          <LabeledField label="Source name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </LabeledField>
          <LabeledField label="RSS feed URL">
            <Input
              value={feedUrl}
              onChange={(event) => setFeedUrl(event.target.value)}
              placeholder="https://example.com/jobs.rss"
              type="url"
              required
            />
          </LabeledField>
          <Button type="submit" variant="accent" disabled={creating}>
            <Plug className="h-4 w-4" />
            {creating ? 'Adding...' : 'Add RSS'}
          </Button>
        </form>
      </Card>

      {message ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {message}
        </div>
      ) : null}

      {syncResult ? (
        <Card>
          <h2 className="text-base font-semibold text-slate-900">
            Last sync result
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <SyncStat label="Fetched" value={syncResult.totalFetched} />
            <SyncStat label="Imported" value={syncResult.imported} />
            <SyncStat label="Duplicates" value={syncResult.skippedDuplicate} />
            <SyncStat
              label="Job posts"
              value={syncResult.filteredOutJobPosts}
            />
            <SyncStat
              label="Irrelevant"
              value={syncResult.filteredOutIrrelevant}
            />
            <SyncStat label="Analyzed" value={syncResult.analyzed} />
            <SyncStat label="Proposals" value={syncResult.proposalGenerated} />
          </div>
          {syncResult.filteredOutReasons?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
              {syncResult.filteredOutReasons.slice(0, 5).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {/* Source cards */}
      {sources.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map((source) => {
            const brand = sourceBrand(source);
            return (
              <Card key={source.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold text-white ${brand.tone}`}
                    >
                      {brand.icon}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {source.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {source.type} • {source.integrationType}
                      </p>
                    </div>
                  </div>
                  <Badge tone={statusTone(source.status)} dot>
                    {source.status}
                  </Badge>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Database className="h-3.5 w-3.5 text-slate-400" />
                    {source.lastSyncStatus ?? 'Not synced'}
                  </div>
                  <p className="mt-1 line-clamp-2 text-slate-500">
                    {source.lastSyncMessage ?? 'No sync activity yet.'}
                  </p>
                  {source.lastSyncAt ? (
                    <p className="mt-1 text-slate-400">
                      {new Date(source.lastSyncAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => handleAction(source, 'test')}
                  >
                    <TestTube2 className="h-4 w-4" />
                    {busyId === `${source.id}:test` ? 'Testing...' : 'Test'}
                  </Button>
                  <Button
                    variant="accent"
                    size="sm"
                    disabled={busyId !== null || source.status === 'DISABLED'}
                    onClick={() => handleAction(source, 'sync')}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${busyId === `${source.id}:sync` ? 'animate-spin' : ''}`}
                    />
                    {busyId === `${source.id}:sync` ? 'Syncing...' : 'Sync now'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No lead sources configured"
          description="Add an RSS feed above to start importing leads automatically."
          icon={Rss}
        />
      )}
    </div>
  );
}

function SyncStat({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value ?? 0}</p>
    </div>
  );
}
