'use client';
import { useEffect, useState } from 'react';
import { govt, Source } from '@/lib/government';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { RecordForm } from '@/components/government/Forms';
import { useAdminUser } from '@/components/layout/admin-context';
export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Source | null>(null);
  const user = useAdminUser();
  const canEdit = ['ADMIN', 'MANAGER'].includes(user?.role ?? '');
  const load = () => govt<Source[]>('/tender-sources').then(setSources);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tender Sources"
        subtitle="GeM currently supports manual bid, URL and document intake. Automatic discovery is unavailable."
      />
      {error && <p role="alert">{error}</p>}
      {message && (
        <p role="status" className="rounded-lg bg-blue-50 p-4">
          {message}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {sources.map((s) => (
          <Card key={s.id} className="space-y-3 p-5">
            <h2 className="font-semibold">{s.name}</h2>
            <p>
              {s.integrationType} · {s.status}
            </p>
            <p className="text-sm text-slate-500">
              {s.lastSyncMessage ?? 'Manual intake ready'}
            </p>
            <div className="flex gap-2">
              {canEdit && <Button onClick={() => setEditing(s)}>Edit</Button>}
              {['test', 'sync'].map((action) => (
                <Button
                  key={action}
                  onClick={async () => {
                    try {
                      const result = await govt<{ message: string }>(
                        `/tender-sources/${s.id}/${action}`,
                        'POST',
                        {},
                      );
                      setMessage(result.message);
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {action === 'test' ? 'Test availability' : 'Check sync'}
                </Button>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {!sources.length && <p>Add a manual or GeM source to begin.</p>}
      {canEdit && (
        <Card className="p-6">
          <h2 className="mb-4 font-semibold">
            {editing ? 'Edit source' : 'Add source'}
          </h2>
          <RecordForm
            key={editing?.id ?? 'new'}
            initial={
              editing
                ? {
                    name: editing.name,
                    integrationType: editing.integrationType,
                    status: editing.status,
                    keywords: editing.configJson.keywords.join('\n'),
                    excludeKeywords:
                      editing.configJson.excludeKeywords.join('\n'),
                    hardwareKeywords:
                      editing.configJson.hardwareKeywords.join('\n'),
                  }
                : { integrationType: 'MANUAL_GOVT_TENDER', status: 'ACTIVE' }
            }
            fields={[
              { name: 'name', required: true },
              {
                name: 'integrationType',
                options: ['MANUAL_GOVT_TENDER', 'GEM_BIDPLUS'],
                required: true,
              },
              {
                name: 'status',
                options: ['ACTIVE', 'DISABLED'],
                required: true,
              },
              {
                name: 'keywords',
                label: 'Software discovery terms (one per line)',
                type: 'textarea',
              },
              {
                name: 'excludeKeywords',
                label: 'Excluded scopes (one per line)',
                type: 'textarea',
              },
              {
                name: 'hardwareKeywords',
                label: 'Hardware supply terms (one per line)',
                type: 'textarea',
              },
            ]}
            onSave={async (v) => {
              const words = (name: string) =>
                String(v[name] ?? '')
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);
              await govt(
                editing ? `/tender-sources/${editing.id}` : '/tender-sources',
                editing ? 'PATCH' : 'POST',
                {
                  name: v.name,
                  integrationType: v.integrationType,
                  status: v.status,
                  configJson: {
                    keywords: words('keywords'),
                    excludeKeywords: words('excludeKeywords'),
                    hardwareKeywords: words('hardwareKeywords'),
                    syncIntervalHours: 4,
                  },
                },
              );
              setEditing(null);
              await load();
            }}
          />
          {editing && (
            <Button onClick={() => setEditing(null)}>Cancel editing</Button>
          )}
        </Card>
      )}
    </div>
  );
}
