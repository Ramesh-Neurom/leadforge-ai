# Prioritized Remediation Plan

## P0: Security Or Data-loss Issues Blocking Production

1. Replace default JWT secret behavior.
   - Evidence: `apps/backend/src/modules/auth/auth.module.ts:12-15`, `apps/backend/.env.example:6`.
   - Fix: Fail startup in production if secret missing/weak.
   - Complexity: Low.

2. Remove fixed seed passwords.
   - Evidence: `apps/backend/prisma/seed.ts:7-23`.
   - Fix: Dev-only seed or operator-provided one-time passwords.
   - Complexity: Low.

3. Add RBAC to all mutating and sensitive read endpoints.
   - Evidence: controllers using only `JwtAuthGuard`, e.g. `apps/backend/src/modules/invoices/invoices.controller.ts:14-50`, `apps/backend/src/modules/quotations/quotations.controller.ts:14-45`, `apps/backend/src/modules/proposals/proposals.controller.ts:15-85`.
   - Fix: Role matrix plus `RolesGuard` decorators.
   - Complexity: Medium.

4. Add CSRF protection or stop using cookies for API writes.
   - Evidence: `apps/backend/src/modules/auth/auth.controller.ts:8-13`, `apps/backend/src/modules/auth/jwt-auth.guard.ts:20-44`, `apps/backend/src/main.ts:9-12`.
   - Fix: CSRF token/header validation, logout, strict origin.
   - Complexity: Medium.

5. Decide and enforce tenant/company isolation.
   - Evidence: no ownership fields in `apps/backend/prisma/schema.prisma:10-226`.
   - Fix: If single-company only, document and restrict deployment. If multi-company, add `companyId` and scoped queries.
   - Complexity: High.

6. Make lead ingestion idempotent with database constraints.
   - Evidence: `apps/backend/src/modules/lead-sources/lead-sources.service.ts:331-347`, `apps/backend/prisma/schema.prisma:74-77`.
   - Fix: Unique dedupe keys and upsert/createMany skip duplicates.
   - Complexity: Medium.

7. Make outbound sends idempotent.
   - Evidence: `apps/backend/src/modules/proposals/proposals.service.ts:288-305`, `apps/backend/src/modules/quotations/quotations.service.ts:134-146`, `apps/backend/src/modules/invoices/invoices.service.ts:107-115`.
   - Fix: Send intent/state table and idempotency key.
   - Complexity: Medium.

## P1: Correctness And Reliability Issues

1. Add timeouts to Gemini, SendGrid, RSS, RemoteOK.
   - Evidence: `apps/backend/src/modules/ai-agents/openai.provider.ts:51-87`, `apps/backend/src/modules/email/email.provider.ts:44-56`, `apps/backend/src/modules/lead-sources/lead-sources.service.ts:270-295`.
   - Complexity: Low.

2. Validate AI responses with runtime schemas.
   - Evidence: `apps/backend/src/modules/ai-agents/openai.provider.ts:111-120`.
   - Complexity: Low to Medium.

3. Add AI cost/rate limits.
   - Evidence: direct generation endpoints at `apps/backend/src/modules/leads/leads.controller.ts:49-61`.
   - Complexity: Medium.

4. Move `ensureSecondFollowups` out of reads or use upsert.
   - Evidence: `apps/backend/src/modules/followups/followups.service.ts:39-48`, `apps/backend/src/modules/followups/followups.service.ts:171-214`.
   - Complexity: Low.

5. Put client-reply follow-up cancellation in the same transaction.
   - Evidence: `apps/backend/src/modules/leads/leads.service.ts:234-262`, `apps/backend/src/modules/crm/crm.service.ts:128-140`.
   - Complexity: Low.

6. Add audit log for approvals, sends, invoice/quotation edits, source config changes, and auth events.
   - Evidence: only CRM activity table at `apps/backend/prisma/schema.prisma:121-136`.
   - Complexity: Medium.

## P2: Scalability And Maintainability Improvements

1. Add cursor pagination to list endpoints.
2. Add composite indexes for common filters and due follow-up scans.
3. Wire BullMQ for source sync and AI generation, with retry cap, backoff, DLQ, and job idempotency.
4. Replace `Float` money with `Decimal` or integer minor units.
5. Add proper invoice numbering sequence.
6. Add structured logs, request IDs, metrics, and readiness checks.

## P3: Optional Future Improvements

1. Verified company knowledge base: domains, skills, portfolio, team availability.
2. Gmail alert parser and approved platform connectors.
3. Outbound provider webhooks for delivered/bounced/replied status.
4. Dashboard caching after measuring real DB pressure.
5. Analytics/reporting worker.

## Top 10 Fixes Required Before Production

1. Remove unsafe JWT default.
2. Remove fixed seed passwords.
3. Add RBAC across all business endpoints.
4. Add CSRF/logout/session hardening.
5. Enforce tenant/company isolation or single-company deployment contract.
6. Add DB-backed lead dedupe.
7. Add idempotent outbound sending.
8. Add external-call timeouts.
9. Add AI response validation and injection controls.
10. Add minimal security/reliability test suite.

