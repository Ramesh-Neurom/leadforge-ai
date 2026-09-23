# Government Procurement

Government procurement is a separate business domain from private opportunities. It shares authentication, roles, AI infrastructure, company evidence, storage, notifications, and UI components. It does not reuse private `Lead`, `Proposal`, or CRM entities.

## Workflow

1. Configure a Manual Government Tender or GeM source.
2. Import a bid number, official URL, and known tender facts.
3. Upload PDF, DOC, DOCX, XLS, XLSX, or CSV tender documents. Public URL download is restricted to configured HTTPS government hosts.
4. Confirm text extraction completed, then run tender analysis.
5. Review every eligibility and compliance item against actual company evidence.
6. Create a bid workspace and generate relevant technical sections.
7. Replace `[NEEDS COMPANY INPUT]`, edit, and approve technical content.
8. Approve document readiness and the internal commercial worksheet.
9. Mark the workspace ready, submit manually on the official portal, and record the portal reference.
10. Mark the submitted bid won or lost when the outcome is known.

Any tender, company evidence, commercial, or bid-section change invalidates affected approvals. Submitted records are locked.

## GeM boundary

`GEM_BIDPLUS` is implemented as a source adapter with manual intake. Automatic public discovery reports `MANUAL_REQUIRED`; it does not fabricate an API, automate login, bypass CAPTCHA or anti-bot controls, or submit bids. Enable automatic discovery only after implementing and testing an officially documented or explicitly permitted mechanism.

## Document safety

- Files are size limited, extension/MIME checked, signature checked, hashed, and stored under generated keys.
- Extraction runs in a memory- and time-limited child process.
- Remote downloads enforce HTTPS, an explicit hostname allow-list, redirect validation, public IPv4 resolution, timeouts, and download limits.
- Tender text is untrusted data. AI output is schema validated and requirement evidence must match supplied source text.
- Scanned PDFs require OCR or a text-based copy.

## Setup

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed:government
```

The seed adds configurable GeM and manual source records and an empty company profile. It does not invent capabilities, financial facts, certifications, experience, team details, or company documents.

Copy the source configuration in `docs/government-source-config.json` when creating or revising discovery rules.

## Environment variables

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GOVT_TENDER_SYNC_ENABLED`
- `GEM_SYNC_ENABLED`
- `TENDER_DOC_MAX_BYTES`
- `TENDER_DOC_ALLOWED_HOSTS`
- `TENDER_STORAGE_DIR`

## Routes

Frontend pages:

- `/government`
- `/government/sources`
- `/government/tenders`
- `/government/tenders/:id`
- `/government/bids`
- `/company`

Backend route groups:

- `/api/tender-sources`
- `/api/tenders`
- `/api/bid-workspaces`
- `/api/company-profile`
- `/api/company-capabilities`
- `/api/company-documents`
- `/api/government/dashboard`

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
```

Integration tests use a disposable PostgreSQL schema, mocked AI responses, local fixture documents, and no outbound email or government portal submission.
