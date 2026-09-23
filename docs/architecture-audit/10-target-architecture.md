# Target Architecture

## Target Shape

Keep LeadForge AI as a modular monolith:

```text
Next.js UI
  -> NestJS API modules
      -> Auth/RBAC/tenant guard
      -> Leads + Lead Sources
      -> AI Orchestration
      -> Proposals + Outbound Messages
      -> CRM + Conversations + Followups
      -> Quotations + Invoices
  -> PostgreSQL
  -> Redis/BullMQ for async jobs only
  -> Gemini / SendGrid through timeout-wrapped provider clients
```

## Core Architecture Changes

1. Add ownership boundary.
   - `Company`, `CompanyMembership`, and `companyId` scoped records if multi-company is required.
   - If this is strictly one internal company, keep the schema simpler and document/deploy it as single-tenant.

2. Add one authorization layer.
   - Use `JwtAuthGuard + RolesGuard`.
   - Add object checks in services for ownership and allowed transitions.
   - Keep role matrix small: Admin, Manager, BD Executive, Finance, Technical Reviewer.

3. Add idempotency where side effects happen.
   - Lead ingestion: DB unique dedupe keys and upsert.
   - Proposal/quotation/invoice send: `OutboundMessage` state table.
   - Follow-up schedule: unique keys and upsert.

4. Add AI safety boundary.
   - Treat lead content as untrusted.
   - Validate output schemas.
   - Whitelist company facts and portfolio links.
   - Record AI request metadata without raw prompt/response logs.

5. Add reliability around dependencies.
   - Fetch timeout for RSS/RemoteOK/Gemini/SendGrid.
   - Retry only where idempotent.
   - Rate limit login, AI generation, source sync, and send endpoints.

6. Add production visibility.
   - Request ID in logs.
   - Structured logs.
   - Metrics for RED signals, dependency latency/errors, AI cost, queue depth, oldest job age, email send failures.
   - `/health` stays liveness; add `/ready` for DB/Redis readiness.

## Suggested Tables To Add

Only add these if their production scope is real:

- `Company`, `CompanyMembership` for tenant isolation.
- `AuditLog` for sensitive changes.
- `OutboundMessage` for proposal/quotation/invoice sends.
- `IdempotencyKey` if API clients will retry writes.
- `CompanySkill`, `PortfolioItem`, `TeamAvailability` for grounded AI matching.

## Worker Boundaries

Start with workers inside the backend app/monorepo:

- `lead-source-sync` queue.
- `ai-generation` queue.
- `outbound-email` queue.
- `followup-scheduler` queue.

Use job IDs like `source-sync:{sourceId}:{window}` and `proposal-send:{proposalId}:{channel}` to prevent duplicate processing.

## Production Readiness Scores

- Production readiness: 38/100
- Security: 35/100
- Reliability: 40/100
- AI safety: 42/100
- Data integrity: 45/100
- Scalability: 50/100
- Test coverage confidence: 15/100

## Production Decision

Not production-ready for real client outreach, billing, or multi-company data. It can continue as an internal prototype or single-company demo if seeded credentials are not exposed, secrets are rotated, and outbound sending remains disabled/manual.

