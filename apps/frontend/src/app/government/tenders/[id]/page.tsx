'use client';
import { use, useCallback, useEffect, useState } from 'react';
import {
  govt,
  Tender,
  Document,
  Requirement,
  Readiness,
  RecordValues,
  Section,
  apiBase,
  label,
  dateLabel,
  complianceStatuses,
} from '@/lib/government';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Textarea, Select, LabeledField } from '@/components/ui/Field';
import { RecordForm, Upload } from '@/components/government/Forms';
import { useAdminUser } from '@/components/layout/admin-context';

function Intelligence({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-slate-500">Unknown</span>;
  if (Array.isArray(value))
    return (
      <ul className="list-inside list-disc space-y-2">
        {value.map((v, i) => (
          <li key={i}>
            <Intelligence value={v} />
          </li>
        ))}
      </ul>
    );
  if (typeof value === 'object')
    return (
      <div className="space-y-3">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <h3 className="font-medium text-slate-700">
              {label(k.replace(/([A-Z])/g, ' $1'))}
            </h3>
            <Intelligence value={v} />
          </div>
        ))}
      </div>
    );
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}
function ReviewItem({
  item,
  kind,
  docs,
  save,
  disabled,
}: {
  item: Requirement;
  kind: 'eligibility' | 'compliance';
  docs: Document[];
  save: (v: RecordValues) => Promise<unknown>;
  disabled: boolean;
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-2 font-semibold">{item.requirement}</h3>
      <p className="mb-3 text-xs text-slate-500">
        Clause: {item.clauseReference ?? 'Not specified'} · Document:{' '}
        {item.documentReference ?? item.sourceDocumentId ?? 'Tender fields'} ·
        Page: {item.pageReference ?? item.sourcePage ?? 'Unknown'} ·{' '}
        {item.confirmedById ? 'Human reviewed' : 'Pending verification'}
      </p>
      <RecordForm
        disabled={disabled}
        initial={{
          status: item.status,
          complianceStatus: item.complianceStatus,
          companyValue: item.companyValue,
          evidence: item.evidence,
          notes: item.notes,
          companyDocumentId: item.companyDocumentId,
        }}
        fields={[
          {
            name: kind === 'eligibility' ? 'status' : 'complianceStatus',
            options: complianceStatuses,
            required: true,
          },
          ...(kind === 'eligibility'
            ? [{ name: 'companyValue', label: 'Actual company value' }]
            : [
                {
                  name: 'companyDocumentId',
                  label: 'Company document ID (see evidence list)',
                },
              ]),
          { name: 'evidence', type: 'textarea' },
          { name: 'notes', type: 'textarea' },
        ]}
        onSave={save}
      />
      {kind === 'compliance' && (
        <details className="mt-3">
          <summary>Available evidence references</summary>
          {docs.map((d) => (
            <p className="text-xs" key={d.id}>
              {d.name} — {d.status} — {d.id}
            </p>
          ))}
        </details>
      )}
    </Card>
  );
}
function SectionEditor({
  section,
  save,
  regenerate,
  disabled,
}: {
  section: Section;
  save: (text: string) => Promise<void>;
  regenerate: () => Promise<void>;
  disabled: boolean;
}) {
  const [text, setText] = useState(
    section.editedContent ?? section.generatedContent,
  );
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{label(section.sectionType)}</h3>
      <p className="text-xs text-slate-500">
        Version {section.version}. Regeneration preserves saved human edits.
      </p>
      <Textarea
        aria-label="Technical bid section"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={20}
        disabled={disabled}
      />
      {text.includes('NEEDS COMPANY INPUT') && (
        <p className="text-amber-700">
          Complete missing company information before approval.
        </p>
      )}
      <div className="flex gap-3">
        <Button disabled={disabled} onClick={() => save(text)}>
          Save section
        </Button>
        <Button disabled={disabled} onClick={regenerate}>
          Regenerate AI draft
        </Button>
      </div>
      {section.editedContent && (
        <details>
          <summary>AI generated version</summary>
          <p className="whitespace-pre-wrap">{section.generatedContent}</p>
        </details>
      )}
    </div>
  );
}
export default function TenderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const user = useAdminUser();
  const [t, setTender] = useState<Tender>();
  const [tab, setTab] = useState('Overview');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<Document[]>([]);
  const [ready, setReady] = useState<Readiness>();
  const [commercial, setCommercial] = useState<RecordValues>({});
  const [selected, setSelected] = useState('');
  const [documentType, setDocumentType] = useState('BID_DOCUMENT');
  const manager = ['ADMIN', 'MANAGER'].includes(user?.role ?? '');
  const finance = ['ADMIN', 'MANAGER', 'FINANCE'].includes(user?.role ?? '');
  const writer = ['ADMIN', 'MANAGER', 'BD_EXECUTIVE', 'TECH_REVIEWER'].includes(
    user?.role ?? '',
  );
  const reviewer = ['ADMIN', 'MANAGER', 'TECH_REVIEWER'].includes(
    user?.role ?? '',
  );
  const locked = !!t && ['SUBMITTED', 'AWARDED', 'LOST'].includes(t.status);
  const load = useCallback(async () => {
    const [next, evidence, readiness] = await Promise.all([
      govt<Tender>(`/tenders/${id}`),
      govt<Document[]>('/company-documents'),
      govt<Readiness>(`/tenders/${id}/readiness`),
    ]);
    setTender(next);
    setDocs(evidence);
    setReady(readiness);
    if (next.workspace && finance)
      setCommercial(
        (await govt<RecordValues | null>(
          `/bid-workspaces/${next.workspace.id}/commercial`,
        )) ?? {},
      );
  }, [id, finance]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
    if (new URLSearchParams(window.location.search).get('tab') === 'Bid')
      setTab('Bid');
  }, [load]);
  async function action(path: string, method = 'POST', body: unknown = {}) {
    setBusy(true);
    setError('');
    try {
      await govt(path, method, body);
      await load();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const click = (path: string, method = 'POST', body: unknown = {}) => {
    void action(path, method, body).catch(() => undefined);
  };
  if (!t)
    return (
      <div>{error ? <p role="alert">{error}</p> : <p>Loading tender…</p>}</div>
    );
  const workspace = t.workspace;
  const section =
    workspace?.sections.find((s) => s.id === selected) ??
    workspace?.sections[0];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        subtitle={`${t.bidNumber ?? 'Bid number unknown'} · ${t.buyerName ?? 'Buyer unknown'} · ${t.source.name}`}
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-indigo-50 px-3 py-1">{t.status}</span>
        <span>Closing: {dateLabel(t.closesAt)}</span>
        {t.closesAt && (
          <span>
            {Math.ceil(
              (new Date(t.closesAt).getTime() - Date.now()) / 86400000,
            )}{' '}
            days remaining
          </span>
        )}
        <span>
          {t.analysis
            ? `${t.analysis.overallMatchScore}/100 · ${t.analysis.matchClassification}`
            : t.relevance}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {writer && !locked && (
          <Button
            disabled={busy}
            onClick={() => click(`/tenders/${id}/analyze`)}
          >
            Analyze tender
          </Button>
        )}
        {reviewer && !locked && (
          <Button
            disabled={busy}
            onClick={() => click(`/tenders/${id}/reanalyze`)}
          >
            Reanalyze
          </Button>
        )}
        {['ADMIN', 'MANAGER', 'BD_EXECUTIVE'].includes(user?.role ?? '') &&
          !workspace && (
            <Button
              disabled={busy}
              onClick={() => click(`/tenders/${id}/bid-workspace`)}
            >
              Create bid workspace
            </Button>
          )}
        {manager && !locked && (
          <Button
            disabled={busy}
            onClick={() =>
              click(`/tenders/${id}/status`, 'PATCH', {
                status: 'NOT_PURSUING',
              })
            }
          >
            Not pursuing
          </Button>
        )}
        {t.sourceUrl && (
          <a
            href={t.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 text-indigo-700"
          >
            Open source portal
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      {busy && <p role="status">Processing…</p>}
      <div role="tablist" className="flex flex-wrap gap-2 border-b pb-3">
        {[
          'Overview',
          'Documents',
          'Intelligence',
          'Eligibility',
          'Compliance',
          'Readiness',
          'Bid',
          'Commercial',
          'Activity',
        ].map((name) => (
          <button
            role="tab"
            aria-selected={tab === name}
            key={name}
            className={`rounded-lg px-3 py-2 text-sm ${tab === name ? 'bg-indigo-600 text-white' : 'bg-white'}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === 'Overview' && (
        <Card className="space-y-5 p-6">
          <p>{t.relevanceReason}</p>
          <RecordForm
            disabled={
              !['ADMIN', 'MANAGER', 'BD_EXECUTIVE'].includes(
                user?.role ?? '',
              ) ||
              locked ||
              busy
            }
            key={t.id + t.title}
            initial={{
              title: t.title,
              bidNumber: t.bidNumber,
              description: t.description,
              scopeOfWork: t.scopeOfWork,
              buyerName: t.buyerName,
              ministry: t.ministry,
              department: t.department,
              state: t.state,
              locationText: t.locationText,
              serviceCategory: t.serviceCategory,
              estimatedValue: t.estimatedValue,
              emdAmount: t.emdAmount,
              closesAt: t.closesAt,
              contractDuration: t.contractDuration,
              sourceUrl: t.sourceUrl,
            }}
            fields={[
              { name: 'title', required: true },
              { name: 'bidNumber' },
              { name: 'buyerName' },
              { name: 'ministry' },
              { name: 'department' },
              { name: 'state' },
              { name: 'locationText' },
              { name: 'serviceCategory' },
              { name: 'estimatedValue', type: 'number' },
              { name: 'emdAmount', type: 'number' },
              { name: 'closesAt', type: 'datetime-local' },
              { name: 'contractDuration' },
              { name: 'sourceUrl', type: 'url' },
              { name: 'description', type: 'textarea' },
              { name: 'scopeOfWork', type: 'textarea' },
            ]}
            onSave={(v) => action(`/tenders/${id}`, 'PATCH', v)}
          />
        </Card>
      )}
      {tab === 'Documents' && (
        <div className="space-y-4">
          {t.documents.map((d) => (
            <Card key={d.id} className="space-y-2 p-4">
              <h3 className="font-medium">{d.name}</h3>
              <p>
                {d.documentType} · {d.processingStatus}
              </p>
              {d.processingError && (
                <p className="text-red-700">{d.processingError}</p>
              )}
              <a
                href={`${apiBase}/tenders/${id}/documents/${d.id}/download`}
                className="text-indigo-700"
              >
                Download original
              </a>
              {writer && !locked && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    click(`/tenders/${id}/documents/${d.id}/process`)
                  }
                >
                  Retry extraction
                </Button>
              )}
              {manager && !locked && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    click(`/tenders/${id}/documents/${d.id}`, 'DELETE')
                  }
                >
                  Remove
                </Button>
              )}
            </Card>
          ))}
          {!t.documents.length && <p>No tender documents uploaded.</p>}
          {writer && !locked && (
            <Card className="space-y-4 p-5">
              <LabeledField label="Document type">
                <Select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                >
                  {[
                    'BID_DOCUMENT',
                    'ATC',
                    'BOQ',
                    'SCOPE_OF_WORK',
                    'TECHNICAL_SPECIFICATION',
                    'CORRIGENDUM',
                    'ANNEXURE',
                    'OTHER',
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </LabeledField>
              <Upload
                disabled={busy}
                onUpload={async (file) => {
                  const form = new FormData();
                  form.set('file', file);
                  form.set('documentType', documentType);
                  await action(`/tenders/${id}/documents/upload`, 'POST', form);
                }}
              />
              <p className="text-xs text-slate-500">
                PDF, DOC, DOCX, XLS, XLSX and CSV text extraction. Scanned files
                require OCR or a text-based copy.
              </p>
              <RecordForm
                submit="Fetch public document"
                fields={[
                  {
                    name: 'url',
                    label: 'Public document URL',
                    type: 'url',
                    required: true,
                  },
                  {
                    name: 'name',
                    label: 'Filename including extension',
                    required: true,
                  },
                ]}
                onSave={(v) =>
                  action(`/tenders/${id}/documents/fetch`, 'POST', {
                    ...v,
                    documentType,
                  })
                }
              />
            </Card>
          )}
        </div>
      )}
      {tab === 'Intelligence' && (
        <Card className="p-6">
          {t.analysis ? (
            <Intelligence value={t.analysis.rawStructuredResult} />
          ) : (
            <p>Upload tender evidence and click Analyze tender.</p>
          )}
        </Card>
      )}
      {tab === 'Eligibility' && (
        <div className="space-y-4">
          {!t.eligibility.length && (
            <p>
              No extracted eligibility requirements. Analyze source evidence
              first.
            </p>
          )}
          {t.eligibility.map((i) => (
            <ReviewItem
              key={i.id}
              item={i}
              kind="eligibility"
              docs={docs}
              disabled={(!reviewer && !finance) || locked || busy}
              save={(v) =>
                action(`/tenders/${id}/eligibility/${i.id}`, 'PATCH', v)
              }
            />
          ))}
        </div>
      )}
      {tab === 'Compliance' && (
        <div className="space-y-4">
          {!t.compliance.length && (
            <p>No compliance items yet. Analyze source evidence first.</p>
          )}
          {t.compliance.map((i) => (
            <ReviewItem
              key={i.id}
              item={i}
              kind="compliance"
              docs={docs}
              disabled={!reviewer || locked || busy}
              save={(v) =>
                action(`/tenders/${id}/compliance/${i.id}`, 'PATCH', v)
              }
            />
          ))}
        </div>
      )}
      {tab === 'Readiness' && (
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">Company document readiness</h2>
          {!ready?.analyzed && (
            <p>Analyze the tender to identify required documents.</p>
          )}
          {ready?.items.map((r, i) => (
            <div key={i} className="border-b pb-3">
              <p className="font-medium">
                {r.description}: {r.available} of {r.count} · {r.status}
              </p>
              <p className="text-xs text-slate-500">{r.verification}</p>
              {r.documents.map((d) => (
                <p key={d.id}>{d.name}</p>
              ))}
            </div>
          ))}
          <a className="text-indigo-700" href="/company">
            Manage company documents
          </a>
        </Card>
      )}
      {tab === 'Bid' &&
        (workspace ? (
          <div className="space-y-5">
            <Card className="space-y-3 p-4">
              <p className="font-semibold">{workspace.status}</p>
              <p>
                Technical: {workspace.technicalApprovalStatus} · Documents:{' '}
                {workspace.documentApprovalStatus} · Commercial:{' '}
                {workspace.commercialApprovalStatus}
              </p>
              <div className="flex flex-wrap gap-2">
                {writer && !locked && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      click(`/tenders/${id}/generate-technical-bid`)
                    }
                  >
                    Generate technical bid
                  </Button>
                )}
                {manager && !locked && (
                  <>
                    {['technical', 'documents'].map((area) => (
                      <Button
                        key={area}
                        disabled={busy}
                        onClick={() =>
                          click(
                            `/bid-workspaces/${workspace.id}/approve-${area}`,
                          )
                        }
                      >
                        Approve {area}
                      </Button>
                    ))}
                    <Button
                      disabled={busy}
                      onClick={() =>
                        click(`/bid-workspaces/${workspace.id}`, 'PATCH', {
                          status: 'READY_FOR_SUBMISSION',
                        })
                      }
                    >
                      Mark ready for submission
                    </Button>
                  </>
                )}
                {manager &&
                  workspace.status === 'SUBMITTED_MANUALLY' &&
                  ['WON', 'LOST'].map((status) => (
                    <Button
                      key={status}
                      onClick={() =>
                        click(`/bid-workspaces/${workspace.id}`, 'PATCH', {
                          status,
                        })
                      }
                    >
                      Mark {status.toLowerCase()}
                    </Button>
                  ))}
              </div>
            </Card>
            <div className="grid gap-5 xl:grid-cols-[200px_1fr_240px]">
              <Card className="p-3">
                <nav aria-label="Bid sections">
                  {workspace.sections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s.id)}
                      className={`block w-full rounded p-2 text-left text-sm ${section?.id === s.id ? 'bg-indigo-50 text-indigo-700' : ''}`}
                    >
                      {label(s.sectionType)}
                    </button>
                  ))}
                </nav>
              </Card>
              <Card className="p-5">
                {section ? (
                  <SectionEditor
                    key={section.id + section.version}
                    section={section}
                    disabled={!writer || locked || busy}
                    save={async (text) => {
                      await action(
                        `/bid-workspaces/${workspace.id}/sections/${section.id}`,
                        'PATCH',
                        { editedContent: text, version: section.version },
                      );
                    }}
                    regenerate={async () => {
                      await action(
                        `/tenders/${id}/generate-technical-bid`,
                        'POST',
                        { sectionType: section.sectionType },
                      );
                    }}
                  />
                ) : (
                  <p>Generate technical sections to begin drafting.</p>
                )}
              </Card>
              <Card className="space-y-3 p-4">
                <h3 className="font-semibold">Tender references</h3>
                <p className="text-sm">
                  {t.scopeOfWork ?? t.description ?? 'No scope provided'}
                </p>
                <p className="text-sm text-amber-800">
                  {
                    t.compliance.filter(
                      (c) =>
                        !['COMPLIANT', 'NOT_APPLICABLE'].includes(
                          c.complianceStatus ?? '',
                        ),
                    ).length
                  }{' '}
                  compliance items require review.
                </p>
                <p className="text-xs">
                  Generated content is a draft. Verify all commitments against
                  company evidence.
                </p>
              </Card>
            </div>
            {manager && workspace.status === 'READY_FOR_SUBMISSION' && (
              <Card className="p-5">
                <h3 className="mb-4 font-semibold">
                  Record completed manual portal submission
                </h3>
                <RecordForm
                  submit="Record submission"
                  fields={[
                    {
                      name: 'submittedAt',
                      type: 'datetime-local',
                      required: true,
                    },
                    { name: 'portalReference', required: true },
                    { name: 'submissionNotes', type: 'textarea' },
                  ]}
                  onSave={(v) =>
                    action(
                      `/bid-workspaces/${workspace.id}/mark-submitted`,
                      'POST',
                      v,
                    )
                  }
                />
              </Card>
            )}
            {workspace.portalReference && (
              <p>
                Portal reference: {workspace.portalReference} ·{' '}
                {dateLabel(workspace.submittedAt)}
              </p>
            )}
          </div>
        ) : (
          <p>Create a bid workspace first.</p>
        ))}
      {tab === 'Commercial' &&
        (finance ? (
          workspace ? (
            <Card className="space-y-4 p-6">
              <h2 className="font-semibold">
                Internal commercial worksheet · {t.currency}
              </h2>
              <p className="text-sm text-slate-500">
                Estimates and approvals stay internal. No prices are submitted
                to the portal.
              </p>
              <RecordForm
                key={workspace.id + String(commercial.updatedAt ?? '')}
                disabled={locked || busy}
                initial={commercial}
                fields={[
                  { name: 'effortEstimate' },
                  ...[
                    'developmentCost',
                    'implementationCost',
                    'cloudCost',
                    'travelCost',
                    'supportCost',
                    'amcCost',
                    'internalMargin',
                    'approvedQuote',
                  ].map((name) => ({ name, type: 'number' })),
                  { name: 'taxAssumptions' },
                  { name: 'recommendedInternalRange' },
                  { name: 'notes', type: 'textarea' },
                ]}
                onSave={(v) =>
                  action(`/bid-workspaces/${workspace.id}/commercial`, 'PUT', v)
                }
              />
              <Button
                disabled={locked || busy}
                onClick={() =>
                  click(`/bid-workspaces/${workspace.id}/approve-commercial`)
                }
              >
                Approve commercial
              </Button>
            </Card>
          ) : (
            <p>Create a bid workspace first.</p>
          )
        ) : (
          <p>
            Commercial worksheets are available to Finance, Managers and
            Administrators.
          </p>
        ))}
      {tab === 'Activity' && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold">Revisions</h2>
            {t.revisions.map((r) => (
              <div className="border-b py-3" key={r.id}>
                <p>
                  {r.fieldName}: {r.oldValue ?? 'Unknown'} →{' '}
                  {r.newValue ?? 'Unknown'}
                </p>
                <p className="text-xs">{dateLabel(r.createdAt)}</p>
              </div>
            ))}
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Audit activity</h2>
            {t.activities.map((a) => (
              <div className="border-b py-3" key={a.id}>
                <p>{label(a.action)}</p>
                <p className="text-xs">
                  {dateLabel(a.createdAt)} · User {a.actorUserId}
                </p>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
