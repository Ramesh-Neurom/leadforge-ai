'use client';

import { useEffect, useState } from 'react';
import { fetchLeads, Lead } from '@/lib/leads';
import {
  Invoice,
  createInvoice,
  fetchInvoices,
  formatInvoiceStatus,
  markInvoicePaid,
  sendInvoiceEmail,
  updateInvoice,
} from '@/lib/invoices';

export default function InvoicesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [emailText, setEmailText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchLeads(), fetchInvoices()])
      .then(([nextLeads, nextInvoices]) => {
        setLeads(nextLeads);
        setInvoices(nextInvoices);
        setSelectedLeadId(nextLeads[0]?.id ?? '');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const invoice = await createInvoice({
        leadId: selectedLeadId,
        amount,
        currency,
        dueDate,
      });
      setSelectedInvoice(invoice);
      setEmailText(defaultInvoiceEmail(invoice));
      setInvoices(await fetchInvoices());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create invoice');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(
    id: string,
    paymentStatus: Invoice['paymentStatus'],
  ) {
    await updateInvoice(id, { paymentStatus });
    setInvoices(await fetchInvoices());
  }

  async function handlePaid(id: string) {
    await markInvoicePaid(id);
    setInvoices(await fetchInvoices());
  }

  async function handleSend() {
    if (!selectedInvoice) return;
    setSaving(true);
    setError(null);
    try {
      await sendInvoiceEmail(selectedInvoice.id, { messageText: emailText });
      setInvoices(await fetchInvoices());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to send invoice email',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create invoices, track payment status, and send payment emails.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="font-semibold">Invoice creator</h2>
          <div className="mt-4 grid gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Lead</span>
              <select
                value={selectedLeadId}
                onChange={(event) => setSelectedLeadId(event.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Amount" value={amount} onChange={setAmount} />
              <Field label="Currency" value={currency} onChange={setCurrency} />
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-md border px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !selectedLeadId || !amount}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
            >
              {saving ? 'Creating...' : 'Create invoice'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="font-semibold">Payment email and PDF preview</h2>
          {selectedInvoice ? (
            <div className="mt-4 space-y-4">
              <PrintableInvoice invoice={selectedInvoice} />
              <textarea
                value={emailText}
                onChange={(event) => setEmailText(event.target.value)}
                className="min-h-32 w-full rounded-md border px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={saving || !selectedInvoice.lead?.clientEmail}
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
              Create or select an invoice to preview it.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="font-semibold">All invoices</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading invoices...</p>
          ) : (
            invoices.map((invoice) => (
              <article key={invoice.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setEmailText(defaultInvoiceEmail(invoice));
                      }}
                      className="font-medium hover:underline"
                    >
                      {invoice.invoiceNumber} •{' '}
                      {invoice.lead?.title ?? 'Invoice'}
                    </button>
                    <p className="mt-1 text-sm text-slate-600">
                      {invoice.currency} {invoice.amount.toLocaleString()} •{' '}
                      {formatInvoiceStatus(invoice.paymentStatus)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Due{' '}
                      {invoice.dueDate
                        ? new Date(invoice.dueDate).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={invoice.paymentStatus}
                      onChange={(event) =>
                        handleStatus(
                          invoice.id,
                          event.target.value as Invoice['paymentStatus'],
                        )
                      }
                      className="rounded-md border px-2 py-1 text-sm"
                    >
                      {[
                        'UNPAID',
                        'PARTIALLY_PAID',
                        'PAID',
                        'OVERDUE',
                        'CANCELLED',
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handlePaid(invoice.id)}
                      className="rounded-md border px-3 py-1 text-sm"
                    >
                      Mark paid
                    </button>
                  </div>
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

function PrintableInvoice({ invoice }: { invoice: Invoice }) {
  return (
    <div className="rounded-md border p-4 text-sm">
      <h3 className="text-lg font-semibold">Invoice {invoice.invoiceNumber}</h3>
      <p className="mt-2 font-medium">
        {invoice.clientName ?? invoice.lead?.clientName ?? 'Client'}
      </p>
      <p className="mt-3">Project: {invoice.lead?.title ?? '-'}</p>
      <p>
        Amount: {invoice.currency} {invoice.amount.toLocaleString()}
      </p>
      <p>
        Due date:{' '}
        {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}
      </p>
      <p>Status: {formatInvoiceStatus(invoice.paymentStatus)}</p>
    </div>
  );
}

function defaultInvoiceEmail(invoice: Invoice) {
  return `Hi ${invoice.clientName ?? invoice.lead?.clientName ?? 'there'},\n\nPlease find invoice ${invoice.invoiceNumber} for ${invoice.lead?.title ?? 'the project'}.\n\nAmount: ${invoice.currency} ${invoice.amount.toLocaleString()}\nDue date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}\n\nPlease let me know if you need any changes.`;
}
