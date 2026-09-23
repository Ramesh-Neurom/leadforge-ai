# Security Findings

## Verified Loopholes Found In Code

### SEC-01 Missing tenant/company isolation

- Severity: Critical
- Evidence: No tenant/company model or foreign keys in `apps/backend/prisma/schema.prisma:10-226`; global lead reads use an empty `where` object in `apps/backend/src/modules/leads/leads.service.ts:61-89`; proposals return all rows in `apps/backend/src/modules/proposals/proposals.service.ts:54-58`.
- Current behavior: Authenticated users operate on one global dataset.
- Failure or attack scenario: If the product is used by more than one company or business unit, a user can list or mutate another company's leads, proposals, CRM data, invoices, and messages.
- Business impact: Cross-customer data exposure and unauthorized sales activity.
- Recommended solution: Keep modular monolith, add `Company`/`Membership` or equivalent ownership fields, scope every query and mutation by `companyId`, and enforce composite unique constraints per company.
- Complexity: High.
- Blocks production: Yes, for multi-company or external customer use. For single-company internal-only use, document that scope explicitly.

### SEC-02 RBAC is incomplete outside user management

- Severity: High
- Evidence: User routes use `JwtAuthGuard, RolesGuard` and `@Roles(Role.ADMIN)` at `apps/backend/src/modules/users/users.controller.ts:8-10`; lead, source, proposal, quotation, invoice, follow-up, conversation, and CRM controllers generally use only `JwtAuthGuard`, e.g. `apps/backend/src/modules/leads/leads.controller.ts:19-20`, `apps/backend/src/modules/lead-sources/lead-sources.controller.ts:13-14`, `apps/backend/src/modules/quotations/quotations.controller.ts:14-15`, `apps/backend/src/modules/invoices/invoices.controller.ts:14-15`.
- Current behavior: Most authenticated users can create/update/delete core business records. Some manager checks exist only inside specific service methods.
- Failure or attack scenario: A BD user can create invoices, send quotation emails, approve proposals, sync sources, or delete leads if they know endpoint URLs.
- Business impact: Unauthorized client communication, bad invoicing, data tampering, and loss of platform trust.
- Recommended solution: Apply `RolesGuard` and explicit role decorators per controller method; keep business checks in services too for defense in depth.
- Complexity: Medium.
- Blocks production: Yes.

### SEC-03 Cookie auth is CSRF-exposed in production

- Severity: High
- Evidence: Production cookie uses `sameSite: 'none'`, `secure: true`, `httpOnly: true` at `apps/backend/src/modules/auth/auth.controller.ts:8-13`; guard accepts cookies at `apps/backend/src/modules/auth/jwt-auth.guard.ts:20-44`; CORS enables credentials at `apps/backend/src/main.ts:9-12`; frontend sends `credentials: 'include'` at `apps/frontend/src/lib/leads.ts:199-208`.
- Current behavior: Mutating endpoints accept cookie-authenticated requests without CSRF token validation.
- Failure or attack scenario: A malicious site can trigger state-changing requests from a logged-in user's browser if CORS/browser behavior permits the request path.
- Business impact: Unauthorized proposal sends, lead deletion, invoice changes, or CRM stage updates.
- Recommended solution: Add CSRF token/header validation for cookie auth or move API writes to bearer-token auth with strict origin checks. Add logout.
- Complexity: Medium.
- Blocks production: Yes.

### SEC-04 JWT secret has unsafe default

- Severity: Critical
- Evidence: JWT module falls back to `change-me` at `apps/backend/src/modules/auth/auth.module.ts:12-15`; backend env example also sets `JWT_SECRET=change-me` at `apps/backend/.env.example:6`.
- Current behavior: If production env omits `JWT_SECRET`, all JWTs are signed with a public default.
- Failure or attack scenario: Attacker forges admin tokens.
- Business impact: Full application compromise.
- Recommended solution: Fail startup in production if `JWT_SECRET` is missing or weak; require a high-entropy secret from secret manager.
- Complexity: Low.
- Blocks production: Yes.

### SEC-05 Seed script creates known default passwords

- Severity: Critical
- Evidence: Seed hashes `Admin@123` once and assigns it to all seeded users at `apps/backend/prisma/seed.ts:7-23`.
- Current behavior: Running seed creates predictable credentials.
- Failure or attack scenario: Seeded production or staging deployment is accessible with known emails and password.
- Business impact: Full account takeover.
- Recommended solution: Do not seed real users with fixed passwords; generate one-time reset tokens or require operator-provided passwords.
- Complexity: Low.
- Blocks production: Yes if seed is used outside local dev.

### SEC-06 Plain-text connector secrets can be stored in `LeadSource.configJson`

- Severity: High
- Evidence: `LeadSource.configJson` is a generic JSON field at `apps/backend/prisma/schema.prisma:30`; create/update write it directly at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:65-72` and `apps/backend/src/modules/lead-sources/lead-sources.service.ts:79-90`; Freelancer placeholder expects `apiKey` or `clientId` inside config at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:254-258`.
- Current behavior: Platform/API credentials can live in plaintext application rows.
- Failure or attack scenario: DB dump or broad read access exposes platform API keys.
- Business impact: Marketplace/API account compromise.
- Recommended solution: Store connector secrets in a secret manager or encrypted credential table; keep only secret references in `configJson`.
- Complexity: Medium.
- Blocks production: Yes for live connectors.

### SEC-07 Local `.env` contains real-looking secret material in comments

- Severity: Medium
- Evidence: `apps/backend/.env` exists locally with redacted variables at lines `1-13` and secret-looking commented values at `apps/backend/.env:15-17`; `.gitignore` excludes `.env` at `.gitignore:5`.
- Current behavior: Not tracked by git, but sensitive material is present in a workspace file.
- Failure or attack scenario: Accidental copy, screenshot, support upload, or future commit leaks tokens.
- Business impact: Credential exposure.
- Recommended solution: Remove secrets from comments, rotate any real token, and keep `.env` generated from a secure vault.
- Complexity: Low.
- Blocks production: No, but rotate before real use.

## Likely Risks Requiring Runtime Verification

- Whether production serves the backend behind HTTPS and a trusted reverse proxy.
- Whether any real secrets in local `.env` are active and need revocation.
- Whether production database access is private and least-privileged.
- Whether CORS `FRONTEND_URL` is strict in deployed environments.

## Missing Information

- No deployment manifests, Dockerfiles, Nginx config, TLS config, backup config, or production secret-management docs were found.
- No policy matrix defining allowed actions by role.
- No tenant/company scope decision document.

## Existing Implementation Already Correct

- Passwords are hashed with bcrypt cost 12 in user creation/update and seed: `apps/backend/src/modules/users/users.service.ts:38-43`, `apps/backend/prisma/seed.ts:7`.
- User management controller is admin-only: `apps/backend/src/modules/users/users.controller.ts:8-10`.
- Direct scraping for restricted sources is blocked by code: `apps/backend/src/modules/lead-sources/lead-sources.service.ts:18-27` and `apps/backend/src/modules/lead-sources/lead-sources.service.ts:245-251`.
- `.env` files are ignored by git: `.gitignore:5-7`.

