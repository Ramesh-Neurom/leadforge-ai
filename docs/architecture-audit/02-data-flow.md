# Data Flow

## A. Lead Ingestion To Database

Flow:

1. User calls `POST /api/lead-sources/:id/sync` at `apps/backend/src/modules/lead-sources/lead-sources.controller.ts:38-40`.
2. `LeadSourcesService.sync` loads source config, fetches source data, classifies each item, checks for duplicates, then creates `Lead` rows at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:108-190`.
3. RSS and RemoteOK use direct `fetch` calls at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:264-287`.
4. Normalization maps source payloads into `NormalizedLead` at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:490-535`.
5. Duplicate detection checks `sourceName + externalId`, `projectUrl`, or `sourceName + title` at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:331-347`.
6. Create happens separately at `apps/backend/src/modules/lead-sources/lead-sources.service.ts:147-164`.

Verified gaps:

- Duplicate check and create are not protected by a unique constraint or transaction.
- External fetches have no timeout.
- Sync is synchronous request work, not queued.

## B. Lead Analysis And Matching

Flow:

1. User calls `POST /api/leads/:id/analyze` at `apps/backend/src/modules/leads/leads.controller.ts:49-51`.
2. Service loads the lead and sends title, description, source, budget, client info, and skills to AI at `apps/backend/src/modules/leads/leads.service.ts:286-299`.
3. AI compares against hardcoded `companySkills` at `apps/backend/src/modules/ai-agents/ai-lead-analysis.service.ts:29-66`.
4. Result is upserted into `LeadAnalysis`; lead status becomes `AI_REVIEWED`; CRM activity is created in a transaction at `apps/backend/src/modules/leads/leads.service.ts:301-355`.

Verified gaps:

- No team availability, portfolio, company domain, or verified skill catalog tables.
- The AI result is parsed but not schema-validated before persistence.

## C. Lead Approval To Proposal Generation

Flow:

1. Manager/admin qualification is enforced only when setting `QUALIFIED`, at `apps/backend/src/modules/leads/leads.service.ts:215-228`.
2. Proposal generation can be called directly at `POST /api/leads/:id/generate-proposal`, `apps/backend/src/modules/leads/leads.controller.ts:54-56`.
3. `ProposalsService.generateForLead` loads the lead and analysis, calls AI, creates a `Proposal`, updates lead status to `PROPOSAL_DRAFTED`, and writes a CRM activity in one DB transaction at `apps/backend/src/modules/proposals/proposals.service.ts:73-149`.

Verified gaps:

- Proposal generation does not require the lead to be `QUALIFIED`.
- Any authenticated role can generate proposal drafts.

## D. Proposal Approval To Sending

Flow:

1. Any authenticated user can call approve at `apps/backend/src/modules/proposals/proposals.controller.ts:35-37`; the service sets status `APPROVED` at `apps/backend/src/modules/proposals/proposals.service.ts:174-185`.
2. Sending is manager/admin-gated in service code at `apps/backend/src/modules/proposals/proposals.service.ts:277-278` and `apps/backend/src/modules/proposals/proposals.service.ts:398-401`.
3. Email is sent first at `apps/backend/src/modules/proposals/proposals.service.ts:288-292`.
4. DB status update happens afterward through `markSent` at `apps/backend/src/modules/proposals/proposals.service.ts:294-305`.
5. Follow-up scheduling happens after the status transaction at `apps/backend/src/modules/proposals/proposals.service.ts:263-266`.

Verified gaps:

- No idempotency key or send-attempt record exists.
- Successful email followed by DB failure can leave proposal `APPROVED` and sendable again.

## E. Client Reply To CRM Stage Update

Flow:

1. Conversations can add messages at `POST /api/conversations/:leadId/messages`, `apps/backend/src/modules/conversations/conversations.controller.ts:16-32`.
2. Adding a message creates or finds a conversation and adds `Message`, then updates `lastMessageAt` at `apps/backend/src/modules/conversations/conversations.service.ts:56-86`.
3. CRM stage update to `CLIENT_REPLIED` is separate through lead status or CRM move-stage at `apps/backend/src/modules/leads/leads.service.ts:260-262` and `apps/backend/src/modules/crm/crm.service.ts:138-140`.

Verified gaps:

- Adding a client message does not automatically move the lead to `CLIENT_REPLIED`.
- Message creation and conversation timestamp update are not in one transaction.

## F. Follow-up Scheduling

Flow:

1. After proposal sent, first follow-up is upserted by `scheduleAfterProposalSent` at `apps/backend/src/modules/followups/followups.service.ts:145-168`.
2. Second follow-ups are created opportunistically on reads: `findAll` calls `ensureSecondFollowups` at `apps/backend/src/modules/followups/followups.service.ts:39-48`, which scans sent proposals and creates missing follow-ups at `apps/backend/src/modules/followups/followups.service.ts:171-214`.
3. Pending follow-ups are cancelled when status becomes `CLIENT_REPLIED` at `apps/backend/src/modules/followups/followups.service.ts:217-226`.

Verified gaps:

- Read endpoint mutates data.
- Concurrent reads can race on the `Followup_leadId_followupType_key`.
- No actual scheduled worker sends or processes due reminders.

## G. Quotation And Invoice Generation

Flow:

1. Quotation generation loads lead and latest proposal, picks amount from input or lead budget, and creates a quotation at `apps/backend/src/modules/quotations/quotations.service.ts:61-104`.
2. Quotation email sends through SendGrid and then updates status to `SENT` at `apps/backend/src/modules/quotations/quotations.service.ts:125-146`.
3. Invoice creation generates `INV-${Date.now()}` if no number is provided at `apps/backend/src/modules/invoices/invoices.service.ts:61-76`.
4. Invoice email sends but does not update send status at `apps/backend/src/modules/invoices/invoices.service.ts:98-115`.

Verified gaps:

- Quotation and invoice endpoints lack finance/manager RBAC.
- Invoice number generation can collide under concurrent requests.
- Invoice sending is not recorded as a state transition.

## H. Authentication And Session Refresh

Flow:

1. `POST /api/auth/login` returns user and sets `access_token` cookie at `apps/backend/src/modules/auth/auth.controller.ts:20-27`.
2. JWT secret defaults to `change-me`; token expiry is one day at `apps/backend/src/modules/auth/auth.module.ts:12-15`.
3. Guard accepts bearer token or cookie token at `apps/backend/src/modules/auth/jwt-auth.guard.ts:18-27`.
4. Frontend sends credentials with API calls at `apps/frontend/src/lib/leads.ts:199-208` and similar module-local `apiFetch` functions.

Verified gaps:

- No refresh token endpoint.
- No logout endpoint.
- No CSRF token or origin check on mutating endpoints.

