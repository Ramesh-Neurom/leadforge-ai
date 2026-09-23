# Test Gap Analysis

## Current Test Evidence

Only one assert-based spec was found:

- `apps/backend/src/modules/lead-sources/lead-opportunity-filter.service.spec.ts:1-39` tests keyword classification cases.

No Jest/Vitest/Playwright/Supertest scripts are defined in backend/frontend package files:

- Backend scripts at `apps/backend/package.json:5-12` include build/start/lint/prisma/seed, not test.
- Frontend scripts at `apps/frontend/package.json:5-9` include dev/build/start/lint, not test.

## Verified Gaps

### TEST-01 Auth and RBAC tests missing

- Severity: High
- Evidence: No test scripts in `apps/backend/package.json:5-12`; only one spec file exists and it targets lead filtering.
- Current behavior: Role restrictions can regress silently.
- Failure scenario: BD user can approve/send/create invoices unnoticed.
- Business impact: Unauthorized business actions.
- Recommended solution: Add minimal controller/service tests for role matrix and auth failures.
- Complexity: Medium.
- Blocks production: Yes.

### TEST-02 Object authorization and tenant isolation tests missing

- Severity: Critical
- Evidence: No tenant model exists in `apps/backend/prisma/schema.prisma:10-226`; no tests assert scoped access.
- Current behavior: Not testable because isolation is not implemented.
- Failure scenario: Cross-company data access after future tenant addition.
- Business impact: Data breach.
- Recommended solution: Implement tenant ownership then add cross-tenant deny tests for every entity.
- Complexity: High.
- Blocks production: Yes for multi-company.

### TEST-03 Lead ingestion idempotency tests missing

- Severity: High
- Evidence: Duplicate detection is app logic at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:331-347`; no DB unique constraint at `apps/backend/prisma/schema.prisma:74-77`; no ingestion tests found.
- Current behavior: Concurrent duplicate import not covered.
- Failure scenario: Duplicate leads and duplicate proposals.
- Business impact: Duplicate client outreach.
- Recommended solution: Add a DB-backed test for duplicate sync/upsert behavior.
- Complexity: Medium.
- Blocks production: Yes.

### TEST-04 AI safety tests missing

- Severity: High
- Evidence: AI provider only parses JSON at `apps/backend/src/modules/ai-agents/openai.provider.ts:111-120`; no tests cover malformed JSON, schema violations, injection, hallucinated portfolio, or huge payloads.
- Current behavior: Model regressions are invisible until runtime.
- Failure scenario: Bad proposal content reaches approval workflow.
- Business impact: Client trust loss.
- Recommended solution: Stub provider and test validators/prompts with malicious lead descriptions and invalid model responses.
- Complexity: Medium.
- Blocks production: Yes.

### TEST-05 Sending idempotency tests missing

- Severity: High
- Evidence: Proposal email sends before DB update at `apps/backend/src/modules/proposals/proposals.service.ts:288-305`; no tests assert single-send behavior.
- Current behavior: Retry behavior is untested and unsafe.
- Failure scenario: Email sent twice.
- Business impact: Spam and billing confusion.
- Recommended solution: Add tests around send state machine after implementing idempotency.
- Complexity: Medium.
- Blocks production: Yes.

### TEST-06 End-to-end workflow tests missing

- Severity: Medium
- Evidence: No frontend/backend e2e tooling in package scripts.
- Current behavior: Full flows A-H are manually verified at best.
- Failure scenario: UI/API mismatch breaks approval, follow-up, or invoice flow.
- Business impact: Sales workflow stalls.
- Recommended solution: Add a tiny happy-path e2e or API integration suite covering ingestion -> analysis stub -> proposal -> approval -> send mark -> follow-up.
- Complexity: Medium.
- Blocks production: No for prototype, yes for production.

## Test Coverage Confidence

Very low. Confidence score: 15/100.

