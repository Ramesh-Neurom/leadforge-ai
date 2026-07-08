'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Followup,
  completeFollowup,
  fetchFollowups,
  followupStatusBadgeClass,
  formatFollowupStatus,
  isDueToday,
} from '@/lib/followups';

export default function FollowupsPage() {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFollowups();
  }, []);

  const dueToday = useMemo(
    () =>
      followups.filter(
        (followup) =>
          followup.status === 'PENDING' && isDueToday(followup.scheduledAt),
      ),
    [followups],
  );

  async function loadFollowups() {
    setLoading(true);
    fetchFollowups()
      .then(setFollowups)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleComplete(id: string) {
    setCompletingId(id);
    setError(null);
    try {
      await completeFollowup(id);
      setFollowups(await fetchFollowups());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to complete follow-up',
      );
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Follow-ups</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track scheduled proposal follow-ups and close them when done.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-md border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Due today</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {dueToday.length}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading follow-ups...</p>
          ) : dueToday.length ? (
            dueToday.map((followup) => (
              <FollowupRow
                key={followup.id}
                followup={followup}
                completing={completingId === followup.id}
                onComplete={handleComplete}
              />
            ))
          ) : (
            <p className="text-sm text-slate-500">No follow-ups due today.</p>
          )}
        </div>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h2 className="font-semibold">All follow-ups</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading follow-ups...</p>
          ) : followups.length ? (
            followups.map((followup) => (
              <FollowupRow
                key={followup.id}
                followup={followup}
                completing={completingId === followup.id}
                onComplete={handleComplete}
              />
            ))
          ) : (
            <p className="text-sm text-slate-500">No follow-ups scheduled.</p>
          )}
        </div>
      </section>
    </section>
  );
}

function FollowupRow({
  followup,
  completing,
  onComplete,
}: {
  followup: Followup;
  completing: boolean;
  onComplete: (id: string) => void;
}) {
  return (
    <article className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {followup.lead ? (
            <Link
              href={`/leads/${followup.lead.id}`}
              className="font-medium hover:underline"
            >
              {followup.lead.title}
            </Link>
          ) : (
            <p className="font-medium">Lead unavailable</p>
          )}
          <p className="mt-1 text-sm text-slate-600">{followup.message}</p>
          <p className="mt-2 text-xs text-slate-500">
            Scheduled {new Date(followup.scheduledAt).toLocaleString()} •{' '}
            {followup.followupType}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-1 text-xs font-medium ${followupStatusBadgeClass(followup.status)}`}
          >
            {formatFollowupStatus(followup.status)}
          </span>
          {followup.status === 'PENDING' ? (
            <button
              type="button"
              onClick={() => onComplete(followup.id)}
              disabled={completing}
              className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {completing ? 'Completing...' : 'Complete'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
