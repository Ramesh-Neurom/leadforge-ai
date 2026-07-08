'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchLeads, Lead } from '@/lib/leads';
import { fetchProposals, Proposal } from '@/lib/proposals';
import {
  Quotation,
  fetchQuotations,
  formatQuotationStatus,
  generateQuotation,
  sendQuotationEmail,
  updateQuotation,
} from '@/lib/quotations';

export default function QuotationsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paymentTerms, setPaymentTerms] = useState(
    '50% advance, 50% on delivery',
  );
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(
    null,
  );
  const [emailText, setEmailText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchLeads(), fetchProposals(), fetchQuotations()])
      .then(([nextLeads, nextProposals, nextQuotations]) => {
        setLeads(nextLeads);
        setProposals(nextProposals);
        setQuotations(nextQuotations);
        setSelectedLeadId(nextLeads[0]?.id ?? '');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const leadProposals = useMemo(
    () => proposals.filter((proposal) => proposal.leadId === selectedLeadId),
    [proposals, selectedLeadId],
  );

  async function handleGenerate() {
    setSaving(true);
    setError(null);
    try {
      const quotation = await generateQuotation({
        leadId: selectedLeadId,
        proposalId: selectedProposalId || undefined,
        amount,
        currency,
        paymentTerms,
      });
      setSelectedQuotation(quotation);
      setEmailText(defaultQuotationEmail(quotation));
      setQuotations(await fetchQuotations());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate quotation',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(id: string, status: Quotation['status']) {
    await updateQuotation(id, { status });
    setQuotations(await fetchQuotations());
  }

  async function handleSend() {
    if (!selectedQuotation) return;
    setSaving(true);
    setError(null);
    try {
      await sendQuotationEmail(selectedQuotation.id, {
        messageText: emailText,
      });
      setQuotations(await fetchQuotations());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to send quotation email',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quotations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Generate quotations from leads and proposals, then send or export
          them.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border bg-white p-4">
          <h2 className="font-semibold">Quotation generator</h2>
          <div className="mt-4 grid gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Lead</span>
              <select
                value={selectedLeadId}
                onChange={(event) => {
                  setSelectedLeadId(event.target.value);
                  setSelectedProposalId('');
                }}
                className="w-full rounded-md border px-3 py-2"
              >
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Proposal</span>
              <select
                value={selectedProposalId}
                onChange={(event) => setSelectedProposalId(event.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">Latest proposal or lead brief</option>
                {leadProposals.map((proposal) => (
                  <option key={proposal.id} value={proposal.id}>
                    {proposal.solutionSummary ||
                      proposal.proposalText.slice(0, 80)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Amount" value={amount} onChange={setAmount} />
              <Field label="Currency" value={currency} onChange={setCurrency} />
            </div>
            <Field
              label="Payment terms"
              value={paymentTerms}
              onChange={setPaymentTerms}
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={saving || !selectedLeadId}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
            >
              {saving ? 'Generating...' : 'Generate quotation'}
            </button>
          </div>
        </div>

        <div className="rounded-md border bg-white p-4">
          <h2 className="font-semibold">PDF preview/export</h2>
          {selectedQuotation ? (
            <div className="mt-4 space-y-4">
              <PrintableQuotation quotation={selectedQuotation} />
              <textarea
                value={emailText}
                onChange={(event) => setEmailText(event.target.value)}
                className="min-h-32 w-full rounded-md border px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={saving || !selectedQuotation.lead?.clientEmail}
                  className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  Send Email
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-md border px-4 py-2 text-sm font-medium"
                >
                  Print / Save PDF
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Generate or select a quotation to preview it.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-white p-4">
        <h2 className="font-semibold">All quotations</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading quotations...</p>
          ) : (
            quotations.map((quotation) => (
              <article key={quotation.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedQuotation(quotation);
                        setEmailText(defaultQuotationEmail(quotation));
                      }}
                      className="font-medium hover:underline"
                    >
                      {quotation.lead?.title ?? 'Quotation'}
                    </button>
                    <p className="mt-1 text-sm text-slate-600">
                      {quotation.scopeSummary}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {quotation.currency} {quotation.amount.toLocaleString()} •{' '}
                      {formatQuotationStatus(quotation.status)}
                    </p>
                  </div>
                  <select
                    value={quotation.status}
                    onChange={(event) =>
                      handleStatus(
                        quotation.id,
                        event.target.value as Quotation['status'],
                      )
                    }
                    className="rounded-md border px-2 py-1 text-sm"
                  >
                    {['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}

function PrintableQuotation({ quotation }: { quotation: Quotation }) {
  return (
    <div className="rounded-md border p-4 text-sm">
      <h3 className="text-lg font-semibold">Quotation</h3>
      <p className="mt-2 font-medium">
        {quotation.lead?.clientName ?? 'Client'}
      </p>
      <p className="mt-3">{quotation.scopeSummary}</p>
      <p className="mt-3">
        Amount: {quotation.currency} {quotation.amount.toLocaleString()}
      </p>
      <p>Timeline: {quotation.timeline ?? '-'}</p>
      <p>Payment terms: {quotation.paymentTerms ?? '-'}</p>
    </div>
  );
}

function defaultQuotationEmail(quotation: Quotation) {
  return `Hi ${quotation.lead?.clientName ?? 'there'},\n\nPlease find the quotation for ${quotation.lead?.title ?? 'the project'}.\n\nAmount: ${quotation.currency} ${quotation.amount.toLocaleString()}\nTimeline: ${quotation.timeline ?? '-'}\nPayment terms: ${quotation.paymentTerms ?? '-'}\n\nPlease let me know if you have any questions.`;
}
