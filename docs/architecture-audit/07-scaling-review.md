# Scaling Review

## Current Scaling Posture

The application should remain a modular monolith for now. The current workload is CRM-style, relational, and transaction-heavy. Splitting into microservices would add distributed failure modes before the code has strong module boundaries, idempotency, and observability.

## Bottlenecks Verified In Code

- Synchronous source sync and AI calls sit on the API request path: `apps/backend/src/modules/lead-sources/lead-sources.controller.ts:38-40`, `apps/backend/src/modules/lead-sources/lead-sources.service.ts:108-190`, `apps/backend/src/modules/leads/leads.controller.ts:49-61`.
- List endpoints are unpaginated, e.g. leads at `apps/backend/src/modules/leads/leads.service.ts:85-89` and CRM pipeline at `apps/backend/src/modules/crm/crm.service.ts:63-73`.
- Redis/BullMQ is configured globally, but no queues/processors are registered: `apps/backend/src/app.module.ts:21-29`, `apps/backend/src/workers/lead-fetch.worker.ts:13-21`.
- External calls have no timeout, creating API-worker saturation risk: `apps/backend/src/modules/ai-agents/openai.provider.ts:51-87`, `apps/backend/src/modules/email/email.provider.ts:44-56`.
- No cache layer is used for read-heavy dashboard/pipeline pages.

## Smallest Safe Evolution Path

1. Keep one NestJS backend and one Postgres database.
2. Add pagination and indexes before adding caches.
3. Move source sync and AI generation to BullMQ only after adding idempotency keys and DLQ handling.
4. Add one outbound-message table for email sends before scaling email workers.
5. Add Redis rate limiting for login, AI calls, sync, and send endpoints.
6. Add read replicas only when Postgres read load is measured as the bottleneck.

## Parts That Should Remain A Modular Monolith

- Auth and user administration.
- Leads, lead analysis records, proposal approvals, CRM activities.
- Quotations and invoices while transaction volume is modest.
- Configuration and admin settings.

These flows share one relational consistency boundary and benefit from simple DB transactions.

## Parts That May Later Become Workers Or Services

- Lead-source sync worker.
- AI lead analysis/proposal/follow-up generation worker.
- Outbound email worker with provider callbacks/webhooks.
- Follow-up scheduling worker.
- Reporting/analytics jobs.

Extract as workers first inside the same monorepo. Only split into separate services if independent deploy/scale/ownership becomes real.

## Caching

No caching is currently required by evidence. Add cache only after measuring read pressure. Candidate cache targets later:

- Dashboard counts.
- CRM pipeline grouped status view.
- Static company facts used in AI prompts.

## Production Infrastructure Missing From Repo

- Dockerfiles for backend/frontend.
- Nginx/reverse proxy config.
- Health/readiness separation.
- Metrics/logging/tracing stack.
- Deployment manifests.
- Backup/restore strategy.

