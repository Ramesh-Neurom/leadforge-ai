'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  govt,
  RecordValues,
  Capability,
  Document,
  documentTypes,
  apiBase,
} from '@/lib/government';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { RecordForm, Upload } from '@/components/government/Forms';
import { useAdminUser } from '@/components/layout/admin-context';
const categories = [
  'SOFTWARE_ENGINEERING',
  'AI_DATA',
  'CLOUD',
  'CYBERSECURITY',
  'IOT_EDGE',
  'DIGITAL_TWIN',
  'SYSTEM_INTEGRATION',
  'MANAGED_SERVICES',
  'IMPLEMENTATION_SERVICES',
  'FDE_STYLE',
  'OTHER',
];
export default function Company() {
  const user = useAdminUser();
  const manager = ['ADMIN', 'MANAGER'].includes(user?.role ?? '');
  const finance = ['ADMIN', 'MANAGER', 'FINANCE'].includes(user?.role ?? '');
  const uploader = ['ADMIN', 'MANAGER', 'FINANCE', 'BD_EXECUTIVE'].includes(
    user?.role ?? '',
  );
  const [profile, setProfile] = useState<RecordValues>();
  const [caps, setCaps] = useState<Capability[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [tab, setTab] = useState('Overview');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Capability | null>(null);
  const load = useCallback(async () => {
    const [p, c, d] = await Promise.all([
      govt<RecordValues>('/company-profile'),
      govt<Capability[]>('/company-capabilities'),
      govt<Document[]>('/company-documents'),
    ]);
    setProfile(p);
    setCaps(c);
    setDocs(d);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function save(path: string, method: string, body: unknown) {
    await govt(path, method, body);
    await load();
  }
  const profileFields: Record<string, { name: string; type?: string }[]> = {
    Overview: [
      { name: 'legalName' },
      { name: 'displayName' },
      { name: 'website', type: 'url' },
      { name: 'yearsInBusiness', type: 'number' },
      { name: 'employeeCount', type: 'number' },
      { name: 'locations' },
      { name: 'industries' },
      { name: 'notes', type: 'textarea' },
    ],
    'Financial / Eligibility': [
      { name: 'turnover', type: 'textarea' },
      { name: 'msmeStatus' },
      { name: 'startupStatus' },
      { name: 'governmentExperience', type: 'textarea' },
    ],
    Certifications: [{ name: 'certifications', type: 'textarea' }],
    Experience: [{ name: 'experience', type: 'textarea' }],
    Team: [{ name: 'team', type: 'textarea' }],
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Profile & Evidence"
        subtitle="Record verified capabilities and reusable evidence. Unknown information stays unknown."
      />
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {[
          'Overview',
          'Capabilities',
          'Financial / Eligibility',
          'Certifications',
          'Experience',
          'Documents',
          'Team',
        ].map((t) => (
          <Button
            key={t}
            onClick={() => setTab(t)}
            variant={tab === t ? 'primary' : 'secondary'}
          >
            {t}
          </Button>
        ))}
      </div>
      {!profile && !error && <p>Loading company profile…</p>}
      {profile && profileFields[tab] && (
        <Card className="p-6">
          <RecordForm
            key={tab}
            initial={profile}
            fields={profileFields[tab]}
            disabled={!manager}
            onSave={(v) => save('/company-profile', 'PUT', v)}
          />
        </Card>
      )}
      {tab === 'Capabilities' && (
        <div className="space-y-4">
          {caps.map((c) => (
            <Card key={c.id} className="p-5">
              <h3 className="font-semibold">
                {c.name} · {c.active ? 'Active' : 'Inactive'}
              </h3>
              <p>
                {c.category} · {c.proficiency ?? 'Proficiency unknown'}
              </p>
              <p>{c.description}</p>
              <p className="text-sm text-slate-500">{c.keywords.join(', ')}</p>
              {manager && (
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => setEditing(c)}>Edit</Button>
                  <Button
                    onClick={() =>
                      save(`/company-capabilities/${c.id}`, 'DELETE', {}).catch(
                        (e) => setError(e.message),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              )}
            </Card>
          ))}
          {manager && (
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">
                {editing ? 'Edit capability' : 'Add verified capability'}
              </h3>
              <RecordForm
                key={editing?.id ?? 'new'}
                initial={
                  editing
                    ? {
                        category: editing.category,
                        name: editing.name,
                        description: editing.description,
                        proficiency: editing.proficiency,
                        keywords: editing.keywords.join(', '),
                        active: editing.active ? 'true' : 'false',
                      }
                    : { active: 'true' }
                }
                fields={[
                  { name: 'category', options: categories, required: true },
                  { name: 'name', required: true },
                  { name: 'description', type: 'textarea' },
                  { name: 'proficiency' },
                  { name: 'keywords', label: 'Keywords, comma separated' },
                  {
                    name: 'active',
                    options: ['true', 'false'],
                    required: true,
                  },
                ]}
                onSave={async (v) => {
                  await save(
                    editing
                      ? `/company-capabilities/${editing.id}`
                      : '/company-capabilities',
                    editing ? 'PATCH' : 'POST',
                    {
                      ...v,
                      keywords: String(v.keywords ?? '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                      active: v.active === 'true',
                    },
                  );
                  setEditing(null);
                }}
              />
              {editing && (
                <Button onClick={() => setEditing(null)}>Cancel</Button>
              )}
            </Card>
          )}
        </div>
      )}
      {tab === 'Documents' && (
        <div className="space-y-5">
          {docs.map((d) => (
            <Card key={d.id} className="space-y-4 p-5">
              <h3 className="font-semibold">
                {d.name} · {d.status}
              </h3>
              <a
                className="text-indigo-700"
                href={`${apiBase}/company-documents/${d.id}/download`}
              >
                Download evidence
              </a>
              <details>
                <summary>Edit metadata and verify</summary>
                <RecordForm
                  disabled={!finance}
                  initial={{
                    name: d.name,
                    documentType: d.documentType,
                    issuer: d.issuer,
                    issueDate: d.issueDate,
                    expiryDate: d.expiryDate,
                    status: d.status,
                    notes: d.notes,
                  }}
                  fields={[
                    { name: 'name', required: true },
                    {
                      name: 'documentType',
                      options: documentTypes,
                      required: true,
                    },
                    { name: 'issuer' },
                    { name: 'issueDate', type: 'datetime-local' },
                    { name: 'expiryDate', type: 'datetime-local' },
                    {
                      name: 'status',
                      options: [
                        'AVAILABLE',
                        'MISSING',
                        'EXPIRED',
                        'EXPIRING_SOON',
                        'NEEDS_VERIFICATION',
                      ],
                      required: true,
                    },
                    { name: 'notes', type: 'textarea' },
                  ]}
                  onSave={(v) => save(`/company-documents/${d.id}`, 'PATCH', v)}
                />
              </details>
              {uploader && (
                <Upload
                  onUpload={async (file) => {
                    const form = new FormData();
                    form.set('file', file);
                    await save(
                      `/company-documents/${d.id}/upload`,
                      'POST',
                      form,
                    );
                  }}
                />
              )}
              {manager && (
                <Button
                  onClick={() =>
                    save(`/company-documents/${d.id}`, 'DELETE', {}).catch(
                      (e) => setError(e.message),
                    )
                  }
                >
                  Remove record
                </Button>
              )}
            </Card>
          ))}
          {uploader && (
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">
                Add company document record
              </h3>
              <RecordForm
                fields={[
                  { name: 'name', required: true },
                  {
                    name: 'documentType',
                    options: documentTypes,
                    required: true,
                  },
                  { name: 'issuer' },
                  { name: 'expiryDate', type: 'datetime-local' },
                  { name: 'notes', type: 'textarea' },
                ]}
                onSave={(v) =>
                  save('/company-documents', 'POST', {
                    ...v,
                    status: 'NEEDS_VERIFICATION',
                  })
                }
              />
              <p className="mt-4 text-sm text-slate-500">
                After creating a record, upload its file and verify it before
                marking it Available.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
