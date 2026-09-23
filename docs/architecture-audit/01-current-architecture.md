# Current Architecture

## Scope

Read-only audit of the LeadForge AI monorepo as of 2026-07-21. Application code was not modified. Evidence is limited to repository files and line numbers; runtime-only claims are separated in later reports.

## Application Shape

LeadForge AI is a modular monolith:

- Frontend: Next.js app in `apps/frontend`.
- Backend: NestJS API in `apps/backend`.
- Shared package: `packages/shared`.
- Data store: PostgreSQL through Prisma.
- Cache/job dependency: Redis/BullMQ dependencies are present, but jobs are not wired.
- AI provider: Gemini-compatible HTTP call inside `OpenAiProvider`.
- Email provider: SendGrid HTTP API.

Evidence:

- Root README describes frontend, backend, shared package, Postgres, Redis/BullMQ-ready setup, and JWT-ready dependencies at `README.md:5-9`.
- Backend module imports all business modules into one Nest application at `apps/backend/src/app.module.ts:18-43`.
- Prisma uses one PostgreSQL datasource at `apps/backend/prisma/schema.prisma:5-8`.
- BullMQ root connection is configured at `apps/backend/src/app.module.ts:21-29`, but no queue is registered; `apps/backend/src/workers/lead-fetch.worker.ts:13-21` is a placeholder.

## Main Modules

- Auth/users: login, JWT cookie, admin user management.
- Lead sources: manual, RSS, RemoteOK, We Work Remotely, restricted placeholders for unsafe sources.
- Leads: CRUD, AI analysis, assignment, CRM status changes.
- AI agents: lead analysis, proposal generation, follow-up generation.
- Proposals: draft/edit/approve/reject/send/copy.
- Conversations: one conversation per lead in practice, messages tracked manually.
- CRM: pipeline and activities.
- Follow-ups: manual and generated reminders.
- Quotations/invoices: draft/send/payment status.

## Current Data Model

Core tables are `User`, `LeadSource`, `Lead`, `LeadAnalysis`, `Proposal`, `CrmActivity`, `Conversation`, `Message`, `Followup`, `Quotation`, and `Invoice`.

Important verified constraints:

- `User.email` is unique at `apps/backend/prisma/schema.prisma:12`.
- `LeadAnalysis.leadId` is unique at `apps/backend/prisma/schema.prisma:82`.
- `Followup` has `@@unique([leadId, followupType])` at `apps/backend/prisma/schema.prisma:182`.
- `Invoice.invoiceNumber` is unique at `apps/backend/prisma/schema.prisma:215`.

Important missing model concepts:

- No `Company`, `Tenant`, or `Organization` model is present in `apps/backend/prisma/schema.prisma:10-226`.
- No verified company portfolio, skill catalog, domain catalog, or team availability model is present; the only company skills are a hardcoded array in `apps/backend/src/modules/ai-agents/ai-lead-analysis.service.ts:29-47`.

## Production Readiness Summary

The application is a good early modular monolith, but it is not production-ready for real customer, credential, or outbound-email use. Primary blockers are missing tenant isolation, incomplete RBAC, CSRF exposure with cookie auth, weak/default secret handling, non-idempotent sends, duplicate import races, insufficient AI response validation, missing timeouts/rate limits, and very thin tests.

