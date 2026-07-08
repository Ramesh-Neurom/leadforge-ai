'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  LeadSource,
  createLeadSource,
  fetchLeadSources,
  syncLeadSource,
  testLeadSource,
} from '../../lib/lead-sources';

export default function SettingsPage() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [name, setName] = useState('Generic RSS Leads');
  const [feedUrl, setFeedUrl] = useState('');
  const [message, setMessage] = useState('');
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

    try {
      const result =
        action === 'test'
          ? await testLeadSource(source.id)
          : await syncLeadSource(source.id);
      setMessage(result.message);
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
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-500">
          Settings
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Lead Sources</h1>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_2fr_auto]"
      >
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Source name
          </span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">
            RSS feed URL
          </span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={feedUrl}
            onChange={(event) => setFeedUrl(event.target.value)}
            placeholder="https://example.com/jobs.rss"
            type="url"
            required
          />
        </label>
        <button
          className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={creating}
          type="submit"
        >
          {creating ? 'Adding...' : 'Add RSS'}
        </button>
      </form>

      {message ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Integration</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last sync</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sources.map((source) => (
              <tr key={source.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {source.name}
                  </div>
                  <div className="text-xs text-slate-500">{source.type}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {source.integrationType}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                    {source.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div>{source.lastSyncStatus ?? 'Not synced'}</div>
                  <div className="max-w-sm text-xs text-slate-500">
                    {source.lastSyncMessage ?? 'No sync activity yet.'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {source.lastSyncAt
                      ? new Date(source.lastSyncAt).toLocaleString()
                      : ''}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
                      disabled={busyId !== null}
                      onClick={() => handleAction(source, 'test')}
                      type="button"
                    >
                      {busyId === `${source.id}:test` ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      disabled={busyId !== null || source.status === 'DISABLED'}
                      onClick={() => handleAction(source, 'sync')}
                      type="button"
                    >
                      {busyId === `${source.id}:sync`
                        ? 'Syncing...'
                        : 'Sync now'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!sources.length ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-slate-500"
                  colSpan={5}
                >
                  No lead sources configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
