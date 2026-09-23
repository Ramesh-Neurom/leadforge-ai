'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { govt, Dashboard, label, dateLabel } from '@/lib/government';
export default function GovernmentOverview() {
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState('');
  const load = () =>
    govt<Dashboard>('/government/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Government Procurement"
        subtitle="Discover software opportunities, verify evidence and prepare bids for human submission."
      />
      <div className="flex gap-4">
        <Link href="/government/tenders" className="text-indigo-700">
          Browse tenders
        </Link>
        <Link href="/government/sources" className="text-indigo-700">
          Tender sources
        </Link>
        <Button onClick={load}>Refresh</Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading procurement overview…</p>}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
            {Object.entries(data.metrics).map(([key, value]) => (
              <Card key={key} className="p-4">
                <p className="text-xs text-slate-500">
                  {label(key.replace(/([A-Z])/g, ' $1'))}
                </p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              ['High priority opportunities', data.priority],
              ['Closing soon', data.closing],
            ].map(([title, items]) => (
              <Card className="p-5" key={title as string}>
                <h2 className="mb-4 font-semibold">{title as string}</h2>
                {(items as Dashboard['priority']).length ? (
                  (items as Dashboard['priority']).map((t) => (
                    <Link
                      className="block border-t py-3 text-indigo-700"
                      key={t.id}
                      href={`/government/tenders/${t.id}`}
                    >
                      {t.title}
                      <span className="block text-xs text-slate-500">
                        {dateLabel(t.closesAt)}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No opportunities in this view.
                  </p>
                )}
              </Card>
            ))}
            <Card className="p-5">
              <h2 className="font-semibold">Recent changes</h2>
              {data.revisions.map((r) => (
                <Link
                  key={r.id}
                  className="block border-t py-3"
                  href={`/government/tenders/${r.tenderId}`}
                >
                  {label(r.fieldName)}: {r.newValue ?? 'Unknown'}
                </Link>
              ))}
              {!data.revisions.length && <p>No revisions yet.</p>}
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">
                Missing or expiring company documents
              </h2>
              {data.missing.map((d) => (
                <p key={d.id} className="py-2">
                  {d.name} — {label(d.status ?? 'NEEDS_VERIFICATION')}
                </p>
              ))}
              <Link href="/company" className="text-indigo-700">
                Manage company evidence
              </Link>
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">Recent intelligence</h2>
              {data.analyses.map((a) => (
                <Link
                  key={a.tenderId}
                  className="block border-t py-3"
                  href={`/government/tenders/${a.tenderId}`}
                >
                  {a.executiveSummary}
                </Link>
              ))}
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">Notifications</h2>
              {data.notifications.map((n) => (
                <div key={n.id} className="border-t py-3">
                  <p>{n.message}</p>
                  {!n.readAt && (
                    <Button
                      onClick={async () => {
                        await govt(
                          `/government/notifications/${n.id}/read`,
                          'PATCH',
                          {},
                        );
                        await load();
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
