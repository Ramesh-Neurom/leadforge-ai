# Reliability Findings

## Verified Loopholes Found In Code

### REL-01 Lead import duplicate check is racy

- Severity: High
- Evidence: Duplicate lookup uses `findFirst` at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:331-347`; lead creation is separate at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:147-164`; schema has only indexes on `Lead.sourceId`, `status`, `postedAt`, and `assignedToId` at `apps/backend/prisma/schema.prisma:74-77`.
- Current behavior: Two concurrent syncs can both see no duplicate and both create the same lead.
- Failure or attack scenario: Double sync imports duplicated opportunities and triggers duplicate analysis/proposals.
- Business impact: Wasted BD effort, duplicate client outreach.
- Recommended solution: Add unique constraints for real dedupe keys, e.g. `(sourceId, externalId)` where supported and unique `projectUrl` where non-null, then use `upsert`/`createMany(skipDuplicates)`.
- Complexity: Medium.
- Blocks production: Yes.

### REL-02 Proposal and financial emails are not idempotent

- Severity: High
- Evidence: Proposal email sends before DB marking at `apps/backend/src/modules/proposals/proposals.service.ts:288-305`; quotation email sends before status update at `apps/backend/src/modules/quotations/quotations.service.ts:134-146`; invoice email sends and returns original invoice without recording sent state at `apps/backend/src/modules/invoices/invoices.service.ts:107-115`.
- Current behavior: A successful email followed by DB failure leaves no durable send record.
- Failure or attack scenario: User retries and sends the same proposal/quotation/invoice twice.
- Business impact: Spam-like client experience, confused billing, platform reputation damage.
- Recommended solution: Add `OutboundMessage` or `SendAttempt` table with idempotency key, state machine, and provider message id. Mark intent before send; complete after provider success.
- Complexity: Medium.
- Blocks production: Yes.

### REL-03 External calls have no timeouts

- Severity: High
- Evidence: RSS fetch has no timeout at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:270-281`; RemoteOK fetch has no timeout at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:284-295`; Gemini fetch has no timeout at `apps/backend/src/modules/ai-agents/openai.provider.ts:51-87`; SendGrid fetch has no timeout at `apps/backend/src/modules/email/email.provider.ts:44-56`.
- Current behavior: Slow dependencies can hold request handlers indefinitely.
- Failure or attack scenario: External provider stalls and backend request concurrency is exhausted.
- Business impact: API outage from one slow dependency.
- Recommended solution: Wrap fetches with `AbortController` timeout and bounded retry only for idempotent calls.
- Complexity: Low.
- Blocks production: Yes.

### REL-04 BullMQ/scheduled jobs are not actually wired

- Severity: Medium
- Evidence: Bull root connection exists at `apps/backend/src/app.module.ts:21-29`; no `BullModule.registerQueue`, `@Processor`, attempts, backoff, DLQ, or worker registration is present per search; worker file says "Wire this to BullMQ when scheduled source syncs are added" at `apps/backend/src/workers/lead-fetch.worker.ts:13-21`.
- Current behavior: Lead sync and AI work run synchronously; scheduled fetching is not implemented.
- Failure or attack scenario: Manual sync blocks API request path; no retry/DLQ for failed imports.
- Business impact: Poor reliability under slow sources and no recovery workflow.
- Recommended solution: Keep monolith; add one BullMQ queue for source sync with attempts, backoff, unique job ids per source/time, and DLQ monitoring.
- Complexity: Medium.
- Blocks production: No for manual MVP, yes for scheduled imports.

### REL-05 `GET /followups` mutates data and can race

- Severity: Medium
- Evidence: `findAll` calls `ensureSecondFollowups` before reading at `apps/backend/src/modules/followups/followups.service.ts:39-48`; creation happens with `Promise.all(...followup.create...)` at `apps/backend/src/modules/followups/followups.service.ts:203-214`; uniqueness is `@@unique([leadId, followupType])` at `apps/backend/prisma/schema.prisma:182`.
- Current behavior: Reading follow-ups creates second follow-up rows.
- Failure or attack scenario: Two users load the page concurrently; both try to create `SECOND_NO_REPLY`, one request fails on unique constraint.
- Business impact: Flaky UI and missed follow-up visibility.
- Recommended solution: Move this to a scheduled job or use `upsert` in a transaction.
- Complexity: Low.
- Blocks production: No, but fix before active sales usage.

### REL-06 Client reply cancellation is outside the status transaction

- Severity: Medium
- Evidence: Lead status update transaction ends at `apps/backend/src/modules/leads/leads.service.ts:234-258`; cancellation runs afterward at `apps/backend/src/modules/leads/leads.service.ts:260-262`; CRM path similarly updates then cancels at `apps/backend/src/modules/crm/crm.service.ts:128-140`.
- Current behavior: Lead can become `CLIENT_REPLIED` while pending follow-ups remain if cancellation fails.
- Failure or attack scenario: Pending reminder remains after a client replied and gets acted on later.
- Business impact: Awkward duplicate outreach.
- Recommended solution: Include follow-up cancellation in the same transaction as the status change.
- Complexity: Low.
- Blocks production: No.

### REL-07 List endpoints are unpaginated

- Severity: Medium
- Evidence: Leads `findMany` has no `take`/cursor at `apps/backend/src/modules/leads/leads.service.ts:85-89`; CRM pipeline loads all pipeline leads at `apps/backend/src/modules/crm/crm.service.ts:63-73`; proposals, quotations, invoices, activities, and follow-ups also use unbounded `findMany` at `apps/backend/src/modules/proposals/proposals.service.ts:54-58`, `apps/backend/src/modules/quotations/quotations.service.ts:42-46`, `apps/backend/src/modules/invoices/invoices.service.ts:30-34`, `apps/backend/src/modules/crm/crm.service.ts:76-88`, `apps/backend/src/modules/followups/followups.service.ts:42-48`.
- Current behavior: Large datasets are loaded into memory and sent in full.
- Failure or attack scenario: A large import or crawler causes slow queries and high memory use.
- Business impact: Degraded API and frontend performance.
- Recommended solution: Add cursor pagination and default/max page sizes to list APIs.
- Complexity: Medium.
- Blocks production: No for small MVP, yes before scale.

## Existing Implementation Already Correct

- Critical lead status/activity updates are transactional in leads and CRM services at `apps/backend/src/modules/leads/leads.service.ts:234-258` and `apps/backend/src/modules/crm/crm.service.ts:154-180`.
- First follow-up after proposal send uses `upsert` and the existing unique constraint at `apps/backend/src/modules/followups/followups.service.ts:154-168`.
- Direct scraping of restricted sources fails closed at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:245-251`.

