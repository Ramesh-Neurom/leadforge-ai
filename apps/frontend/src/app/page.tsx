import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="space-y-4">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Project setup</p>
      <h1 className="text-3xl font-semibold">AI Project Hunter</h1>
      <p className="max-w-2xl text-slate-600">
        Foundation for lead collection, proposals, CRM, conversations, follow-ups, quotations,
        invoices, portfolio, users, and settings.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Open dashboard
      </Link>
    </section>
  );
}
