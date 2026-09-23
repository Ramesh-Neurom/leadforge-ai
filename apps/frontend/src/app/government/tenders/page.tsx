'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  govt,
  Source,
  Tender,
  tenderStatuses,
  dateLabel,
} from '@/lib/government';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, LabeledField } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { RecordForm, Upload } from '@/components/government/Forms';
import { useAdminUser } from '@/components/layout/admin-context';
export default function Tenders() {
  const router = useRouter();
  const user = useAdminUser();
  const [data, setData] = useState<{ items: Tender[]; total: number }>({
    items: [],
    total: 0,
  });
  const [sources, setSources] = useState<Source[]>([]);
  const [query, setQuery] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [uploadFile, setUploadFile] = useState<File>();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    govt<Source[]>('/tender-sources')
      .then((s) => {
        setSources(s);
        setSourceId(s.find((s) => s.status === 'ACTIVE')?.id ?? '');
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = new URLSearchParams({
      ...Object.fromEntries(Object.entries(query).filter(([, v]) => v)),
      page: String(page),
    });
    govt<{ items: Tender[]; total: number }>(`/tenders?${qs}`)
      .then((d) => {
        if (active) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, page, refresh]);
  const filter = (key: string, value: string) => {
    setPage(1);
    setQuery((q) => ({ ...q, [key]: value }));
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Government Tenders"
        subtitle="Software services opportunities with evidence-led qualification."
      />
      <div className="flex gap-3">
        {['ADMIN', 'MANAGER', 'BD_EXECUTIVE'].includes(user?.role ?? '') && (
          <Button onClick={() => setShowForm(!showForm)}>Import tender</Button>
        )}
        <Button onClick={() => setRefresh((r) => r + 1)}>Refresh</Button>
      </div>
      {showForm && (
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">Manual tender intake</h2>
          <LabeledField label="Tender source">
            <Select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Choose a source</option>
              {sources
                .filter((s) => s.status === 'ACTIVE')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </LabeledField>
          {!sources.length && (
            <Link href="/government/sources">Create a source first</Link>
          )}
          <Upload
            onUpload={async (file) => {
              setUploadFile(file);
            }}
          />
          {uploadFile && <p>Selected: {uploadFile.name}</p>}
          <RecordForm
            submit="Import and open tender"
            fields={[
              { name: 'bidNumber', label: 'Bid number' },
              { name: 'sourceUrl', label: 'Official portal URL', type: 'url' },
              { name: 'title' },
              { name: 'buyerName' },
              { name: 'ministry' },
              { name: 'department' },
              { name: 'state' },
              { name: 'serviceCategory' },
              { name: 'estimatedValue', type: 'number' },
              { name: 'emdAmount', type: 'number' },
              { name: 'closesAt', type: 'datetime-local' },
              { name: 'description', type: 'textarea' },
              { name: 'scopeOfWork', type: 'textarea' },
            ]}
            onSave={async (values) => {
              const cleaned = Object.fromEntries(
                Object.entries(values).filter(([, v]) => v !== null),
              );
              const tender = await govt<Tender>('/tenders/manual', 'POST', {
                ...cleaned,
                tenderSourceId: sourceId,
                ...(!values.title && uploadFile
                  ? { title: uploadFile.name }
                  : {}),
              });
              if (uploadFile) {
                try {
                  const form = new FormData();
                  form.set('file', uploadFile);
                  await govt(
                    `/tenders/${tender.id}/documents/upload`,
                    'POST',
                    form,
                  );
                } catch (e) {
                  setError(
                    `Tender created; document upload failed: ${(e as Error).message}. Open the tender to retry.`,
                  );
                  setShowForm(false);
                  setRefresh((r) => r + 1);
                  return;
                }
              }
              router.push(`/government/tenders/${tender.id}`);
            }}
          />
        </Card>
      )}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <LabeledField label="Search">
            <Input
              value={query.search ?? ''}
              onChange={(e) => filter('search', e.target.value)}
              placeholder="Title, bid or buyer"
            />
          </LabeledField>
          <LabeledField label="Status">
            <Select onChange={(e) => filter('status', e.target.value)}>
              <option value="">All statuses</option>
              {tenderStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </LabeledField>
          <LabeledField label="Match">
            <Select
              onChange={(e) => filter('matchClassification', e.target.value)}
            >
              <option value="">All matches</option>
              {[
                'STRONG_MATCH',
                'POSSIBLE_MATCH',
                'WEAK_MATCH',
                'NOT_RELEVANT',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </LabeledField>
          <LabeledField label="Source">
            <Select onChange={(e) => filter('source', e.target.value)}>
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </LabeledField>
          <LabeledField label="Closing">
            <Select onChange={(e) => filter('closingSoon', e.target.value)}>
              <option value="">Any deadline</option>
              <option value="3">Next 3 days</option>
              <option value="7">Next 7 days</option>
              <option value="30">Next 30 days</option>
            </Select>
          </LabeledField>
          {['state', 'ministry', 'department', 'serviceCategory'].map((k) => (
            <LabeledField key={k} label={k}>
              <Input onChange={(e) => filter(k, e.target.value)} />
            </LabeledField>
          ))}
          <LabeledField label="Sort">
            <Select
              onChange={(e) => {
                setQuery((q) => ({
                  ...q,
                  sort: e.target.value,
                  direction: e.target.value === 'closesAt' ? 'asc' : 'desc',
                }));
              }}
            >
              <option value="createdAt">Newest</option>
              <option value="closesAt">Deadline</option>
              <option value="estimatedValue">Highest value</option>
            </Select>
          </LabeledField>
        </div>
      </Card>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading tenders…</p>
      ) : !data.items.length ? (
        <Card className="p-8">
          No tenders found. Import an opportunity or adjust filters.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  'Match',
                  'Tender / bid',
                  'Buyer / location',
                  'Value / EMD',
                  'Closing',
                  'Status / source',
                ].map((h) => (
                  <th className="p-4" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-4">
                    {t.analysis
                      ? `${t.analysis.overallMatchScore} · ${t.analysis.matchClassification}`
                      : t.relevance}
                  </td>
                  <td className="min-w-64 p-4">
                    <Link
                      className="font-medium text-indigo-700"
                      href={`/government/tenders/${t.id}`}
                    >
                      {t.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {t.bidNumber ?? 'Bid number unknown'}
                    </p>
                  </td>
                  <td className="p-4">
                    {t.buyerName ?? 'Unknown'}
                    <p>{t.state}</p>
                  </td>
                  <td className="p-4">
                    {t.estimatedValue
                      ? `${t.currency} ${t.estimatedValue}`
                      : 'Unknown'}
                    <p className="text-xs">EMD: {t.emdAmount ?? 'Unknown'}</p>
                  </td>
                  <td className="p-4">{dateLabel(t.closesAt)}</td>
                  <td className="p-4">
                    {t.status}
                    <p className="text-xs">{t.source.name}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <div className="flex items-center gap-4">
        <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span>
          Page {page} · {data.total} tenders
        </span>
        <Button
          disabled={page * 20 >= data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
