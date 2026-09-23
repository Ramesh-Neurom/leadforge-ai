# Database Review

## Schema Strengths

- Relational model is appropriate for CRM-style workflows.
- Referential integrity exists for lead-owned records using Prisma relations and foreign keys, e.g. `LeadAnalysis` cascades on lead delete at `apps/backend/prisma/schema.prisma:93`, proposals cascade at `apps/backend/prisma/schema.prisma:112`, and conversations/messages cascade at `apps/backend/prisma/schema.prisma:147` and `apps/backend/prisma/schema.prisma:163`.
- Useful single-column indexes exist on lead status/source/date/assignee at `apps/backend/prisma/schema.prisma:74-77`, proposal status/lead at `apps/backend/prisma/schema.prisma:116-118`, activities at `apps/backend/prisma/schema.prisma:132-135`, and invoices at `apps/backend/prisma/schema.prisma:223-225`.

## Verified Findings

### DB-01 No durable lead dedupe constraints

- Severity: High
- Evidence: `Lead.externalId` and `Lead.projectUrl` are plain nullable strings at `apps/backend/prisma/schema.prisma:43-50`; no unique constraint exists for `(sourceId, externalId)` or `projectUrl` at `apps/backend/prisma/schema.prisma:74-77`.
- Current behavior: Deduplication is best-effort application logic.
- Failure or attack scenario: Concurrent syncs import duplicates.
- Business impact: Duplicate proposal generation and client outreach.
- Recommended solution: Add generated normalized dedupe key or partial unique indexes in migration; use upsert.
- Complexity: Medium.
- Blocks production: Yes.

### DB-02 No tenant/company ownership columns

- Severity: Critical
- Evidence: Every business model in `apps/backend/prisma/schema.prisma:10-226` lacks `companyId`/`tenantId`.
- Current behavior: All records belong to one global application namespace.
- Failure or attack scenario: Multi-company deployment cannot isolate data.
- Business impact: Data exposure.
- Recommended solution: Add company ownership to `User`, `LeadSource`, `Lead`, and derived entities or inherit through lead with scoped joins.
- Complexity: High.
- Blocks production: Yes for multi-company use.

### DB-03 Money values use floating-point numbers

- Severity: Medium
- Evidence: `Lead.budgetMin`/`budgetMax` are `Float` at `apps/backend/prisma/schema.prisma:52-53`; `Quotation.amount` is `Float` at `apps/backend/prisma/schema.prisma:193`; `Invoice.amount` is `Float` at `apps/backend/prisma/schema.prisma:213`.
- Current behavior: Currency values can have binary rounding behavior.
- Failure or attack scenario: Invoice/quotation totals round incorrectly.
- Business impact: Billing disputes.
- Recommended solution: Use `Decimal` or integer minor units plus currency.
- Complexity: Medium.
- Blocks production: No, but fix before real billing.

### DB-04 Invoice number generation can collide

- Severity: Medium
- Evidence: Invoice number defaults to `INV-${Date.now()}` at `apps/backend/src/modules/invoices/invoices.service.ts:61`; DB uniqueness exists at `apps/backend/prisma/schema.prisma:215`.
- Current behavior: Two invoices in the same millisecond can hit a unique constraint.
- Failure or attack scenario: Concurrent finance users get failed invoice creation.
- Business impact: Flaky invoice workflow.
- Recommended solution: Use a database-backed sequence or a per-company yearly counter transaction.
- Complexity: Low to Medium.
- Blocks production: No.

### DB-05 Audit logging is partial

- Severity: Medium
- Evidence: Only `CrmActivity` exists for CRM/status events at `apps/backend/prisma/schema.prisma:121-136`; proposal approve/reject/update and invoice/quotation sends do not create audit rows at `apps/backend/src/modules/proposals/proposals.service.ts:152-196`, `apps/backend/src/modules/quotations/quotations.service.ts:107-146`, `apps/backend/src/modules/invoices/invoices.service.ts:79-123`.
- Current behavior: Many sensitive changes are not audit logged.
- Failure or attack scenario: Unauthorized invoice edit or proposal approval cannot be reconstructed.
- Business impact: Weak accountability and incident response.
- Recommended solution: Add small `AuditLog` table for actor, action, entity, before/after metadata, request id, and timestamp.
- Complexity: Medium.
- Blocks production: Yes for external/customer-facing use.

### DB-06 Connector secret storage is unsafe

- Severity: High
- Evidence: `LeadSource.configJson` can store arbitrary JSON at `apps/backend/prisma/schema.prisma:30`; service directly persists it at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:65-72` and `apps/backend/src/modules/lead-sources/lead-sources.service.ts:79-90`.
- Current behavior: Secrets may be mixed with normal config.
- Failure or attack scenario: Any DB read path exposes API keys.
- Business impact: Connector account compromise.
- Recommended solution: Split non-secret config from secret references.
- Complexity: Medium.
- Blocks production: Yes for live connectors.

### DB-07 Missing composite indexes for primary access paths

- Severity: Medium
- Evidence: Lead lists sort by `postedAt` and `createdAt` with optional status/source filters at `apps/backend/src/modules/leads/leads.service.ts:54-89`, but schema has separate indexes only at `apps/backend/prisma/schema.prisma:74-77`; due follow-up query uses `status`/`scheduledAt` but indexes are separate at `apps/backend/prisma/schema.prisma:183-185`.
- Current behavior: Larger datasets may need sort/filter scans.
- Failure or attack scenario: CRM and follow-up pages slow as rows grow.
- Business impact: Poor operator workflow.
- Recommended solution: Add composite indexes after confirming query plans: `(status, postedAt, createdAt)`, `(sourceId, postedAt, createdAt)`, `(status, scheduledAt)`, and dedupe indexes.
- Complexity: Low.
- Blocks production: No.

## Backup And Restore

No backup, restore, PITR, retention, or migration rollback strategy was found in repo. This requires runtime/deployment verification and should be a P0/P1 production checklist item.

