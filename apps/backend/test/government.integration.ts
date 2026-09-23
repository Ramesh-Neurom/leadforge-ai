import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { rm } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { OpenAiProvider } from '../src/modules/ai-agents/openai.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { analysisOutput } from '../src/modules/government/government.schemas';
import { z } from 'zod';
import { INestApplication } from '@nestjs/common';
import * as XLSX from 'xlsx';

type Row = { id: string; [key: string]: unknown };
const schema = 'procurement_test_' + randomUUID().replace(/-/g, '');
const storage = resolve('storage', schema);
const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) throw new Error('DATABASE_URL is required');
const url = new URL(originalUrl);
url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
process.env.TENDER_STORAGE_DIR = storage;
let app: INestApplication | undefined;
let analysisCalls = 0;
const fit = {
  rating: 'NEEDS_VERIFICATION' as const,
  explanation: 'Verify actual evidence',
};
const analysis: z.infer<typeof analysisOutput> = {
  executiveSummary: 'Prepare a digital twin software platform.',
  serviceClassification: 'DIGITAL_TWIN',
  overallMatchScore: 80,
  matchClassification: 'POSSIBLE_MATCH',
  buyerWants: 'Software platform',
  scope: 'Digital twin platform',
  deliverables: ['Web application'],
  exclusions: [],
  technicalFit: fit,
  serviceFit: fit,
  domainFit: fit,
  experienceFit: fit,
  eligibilityFit: fit,
  teamFit: fit,
  certificationFit: fit,
  turnoverFit: fit,
  timelineFit: fit,
  documentationFit: fit,
  commercialRisk: fit,
  keyRisks: ['Evidence needs verification'],
  disqualificationRisks: [],
  clarifications: [],
  recommendedInternalActions: ['Verify documents'],
  extractedTerms: {
    emd: null,
    deadline: null,
    exemptions: null,
    preferences: null,
    paymentTerms: null,
    penalties: null,
    performanceSecurity: null,
    evaluationCriteria: null,
    sla: null,
    supportPeriod: null,
    technologies: null,
    team: null,
  },
  requirements: [
    {
      requirementType: 'TECHNICAL',
      requirement: 'Deliver a digital twin platform',
      requiredValue: 'Digital twin platform',
      sourceDocumentId: null,
      sourcePage: null,
      clauseReference: null,
      evidenceQuote: 'Deliver a digital twin platform',
    },
  ],
  requiredDocuments: [
    { documentType: 'GST', description: 'GST registration', count: 1 },
  ],
};
const mock = {
  async createStrictJsonCompletion(input: { jsonSchema: { name: string } }) {
    switch (input.jsonSchema.name) {
      case 'government_tender_intelligence':
        analysisCalls++;
        return structuredClone(analysis);
      case 'government_technical_bid':
        return {
          sections: [
            {
              sectionType: 'SOLUTION',
              content: 'Proposed digital twin platform. [NEEDS COMPANY INPUT]',
            },
          ],
        };
      case 'lead_analysis':
        return {
          lead_score: 90,
          priority: 'HIGH',
          category: 'Software',
          required_skills: ['React'],
          budget_quality: 'GOOD',
          client_seriousness: 'HIGH',
          red_flags: [],
          ai_summary: 'Qualified software project',
          recommended_action: 'APPLY',
        };
      case 'proposal_generation':
      case 'proposal':
        return {
          proposal_text: 'Proposed software implementation',
          solution_summary: 'Build application',
          timeline: 'Confirm schedule',
          budget_range: 'Confirm budget',
          questions: [],
          portfolio_links: [],
        };
      case 'followup_message':
        return { message: 'Please review the proposal.' };
      default:
        throw new Error('Unexpected AI schema: ' + input.jsonSchema.name);
    }
  },
};
async function main() {
  const migration = spawnSync(
    process.execPath,
    [resolve('../../node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    { env: process.env, encoding: 'utf8' },
  );
  assert.equal(migration.status, 0, migration.stderr);
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OpenAiProvider)
    .useValue(mock)
    .compile();
  app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const db = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const tokens: Record<string, string> = {};
  for (const role of [
    'ADMIN',
    'MANAGER',
    'BD_EXECUTIVE',
    'FINANCE',
    'TECH_REVIEWER',
  ] as const) {
    const user = await db.user.create({
      data: {
        email: `${role}@integration.invalid`,
        name: role,
        role,
        passwordHash: 'test-only-unusable',
      },
    });
    tokens[role] = await jwt.signAsync({
      sub: user.id,
      email: user.email,
      role,
    });
  }
  async function request<T = Row>(
    path: string,
    method = 'GET',
    body?: unknown,
    role = 'ADMIN',
    expected?: number,
  ): Promise<T> {
    const response = await fetch(base + '/api' + path, {
      method,
      headers: {
        ...(role ? { Authorization: 'Bearer ' + tokens[role] } : {}),
        ...(body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    const result = await response.json();
    if (expected) {
      assert.equal(
        response.status,
        expected,
        `${method} ${path}: ${JSON.stringify(result)}`,
      );
    } else
      assert.ok(
        response.ok,
        `${method} ${path}: ${response.status} ${JSON.stringify(result)}`,
      );
    return result as T;
  }
  await request('/tenders', 'GET', undefined, '', 401);
  await request('/tender-sources', 'POST', {}, 'BD_EXECUTIVE', 403);
  const source = await request('/tender-sources', 'POST', {
    name: 'Integration manual',
    integrationType: 'MANUAL_GOVT_TENDER',
    configJson: {
      keywords: ['digital twin'],
      hardwareKeywords: ['laptops'],
      excludeKeywords: [],
    },
  });
  const intake = {
    tenderSourceId: source.id,
    bidNumber: 'GEM/2026/B/1234567',
    title: 'Development and Maintenance of Smart City Digital Twin Platform',
    description: 'Deliver a digital twin platform',
    buyerName: 'Government Department',
    closesAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
  const tender = await request('/tenders/manual', 'POST', intake);
  const duplicate = await request('/tenders/manual', 'POST', intake);
  assert.equal(tender.id, duplicate.id);
  assert.equal(await db.tender.count(), 1);
  await request(`/tenders/${tender.id}`, 'PATCH', { emdAmount: 400000 });
  assert.equal(
    await db.tenderRevision.count({
      where: { tenderId: tender.id, fieldName: 'emdAmount' },
    }),
    1,
  );
  await request(`/tenders/${tender.id}`, 'PATCH', { emdAmount: 400000 });
  assert.equal(
    await db.tenderRevision.count({
      where: { tenderId: tender.id, fieldName: 'emdAmount' },
    }),
    1,
  );
  const form = new FormData();
  form.set(
    'file',
    new Blob(['requirement\nDeliver a digital twin platform'], {
      type: 'text/csv',
    }),
    'tender.csv',
  );
  const doc = await request(
    `/tenders/${tender.id}/documents/upload`,
    'POST',
    form,
  );
  assert.equal(doc.processingStatus, 'PROCESSED');
  await request(`/tenders/${tender.id}/documents/upload`, 'POST', form);
  assert.equal(await db.tenderDocument.count(), 1);
  const malformed = new FormData();
  const stream =
    'BT /F1 12 Tf 72 720 Td (Deliver a digital twin platform) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf +=
    'xref\n0 6\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const pdfForm = new FormData();
  pdfForm.set(
    'file',
    new Blob([pdf], { type: 'application/pdf' }),
    'tender.pdf',
  );
  const pdfDoc = await request(
    `/tenders/${tender.id}/documents/upload`,
    'POST',
    pdfForm,
  );
  assert.equal(
    pdfDoc.processingStatus,
    'PROCESSED',
    String(pdfDoc.processingError),
  );
  assert.match(
    (await db.tenderDocument.findUniqueOrThrow({ where: { id: pdfDoc.id } }))
      .extractedText ?? '',
    /digital twin/,
  );
  for (const bookType of ['xls', 'xlsx'] as const) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ['requirement'],
        ['Deliver a digital twin platform'],
      ]),
      'Scope',
    );
    const buffer: Buffer = XLSX.write(book, { type: 'buffer', bookType });
    const spreadsheet = new FormData();
    spreadsheet.set(
      'file',
      new Blob([new Uint8Array(buffer)], {
        type:
          bookType === 'xls'
            ? 'application/vnd.ms-excel'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `scope.${bookType}`,
    );
    const sheetDoc = await request(
      `/tenders/${tender.id}/documents/upload`,
      'POST',
      spreadsheet,
    );
    assert.equal(
      sheetDoc.processingStatus,
      'PROCESSED',
      String(sheetDoc.processingError),
    );
  }
  malformed.set(
    'file',
    new Blob(['not a PDF'], { type: 'application/pdf' }),
    'malformed.pdf',
  );
  await request(
    `/tenders/${tender.id}/documents/upload`,
    'POST',
    malformed,
    'ADMIN',
    400,
  );
  await request('/company-profile', 'PUT', {
    legalName: 'Integration Test Company',
  });
  await request('/company-capabilities', 'POST', {
    name: 'Digital Twin',
    category: 'DIGITAL_TWIN',
    keywords: ['digital twin'],
    active: true,
  });
  const companyDoc = await request('/company-documents', 'POST', {
    name: 'GST evidence',
    documentType: 'GST',
  });
  const evidenceForm = new FormData();
  evidenceForm.set(
    'file',
    new Blob(['GST evidence fixture'], { type: 'text/csv' }),
    'gst.csv',
  );
  await request(
    `/company-documents/${companyDoc.id}/upload`,
    'POST',
    evidenceForm,
  );
  await request(`/company-documents/${companyDoc.id}`, 'PATCH', {
    name: 'GST evidence',
    documentType: 'GST',
    status: 'AVAILABLE',
  });
  await request(`/tenders/${tender.id}/analyze`, 'POST', {});
  await request(`/tenders/${tender.id}/analyze`, 'POST', {});
  assert.equal(
    analysisCalls,
    1,
    'Analysis cache should avoid repeated AI calls',
  );
  const workspace = await request(
    `/tenders/${tender.id}/bid-workspace`,
    'POST',
    {},
  );
  assert.equal(
    (await request(`/tenders/${tender.id}/bid-workspace`, 'POST', {})).id,
    workspace.id,
  );
  await request(
    `/bid-workspaces/${workspace.id}`,
    'PATCH',
    { status: 'READY_FOR_SUBMISSION' },
    'ADMIN',
    400,
  );
  await request(
    `/bid-workspaces/${workspace.id}/approve-technical`,
    'POST',
    {},
    'BD_EXECUTIVE',
    403,
  );
  await request(
    `/bid-workspaces/${workspace.id}/commercial`,
    'GET',
    undefined,
    'BD_EXECUTIVE',
    403,
  );
  await request(`/tenders/${tender.id}/generate-technical-bid`, 'POST', {});
  await request(
    `/bid-workspaces/${workspace.id}/approve-technical`,
    'POST',
    {},
    'ADMIN',
    400,
  );
  let section = await db.bidSection.findFirstOrThrow({
    where: { bidWorkspaceId: workspace.id },
  });
  await request(
    `/bid-workspaces/${workspace.id}/sections/${section.id}`,
    'PATCH',
    {
      editedContent: 'Reviewed proposal to deliver the digital twin platform.',
      version: section.version,
    },
  );
  await request(
    `/bid-workspaces/${workspace.id}/sections/${section.id}`,
    'PATCH',
    { editedContent: 'Stale edit', version: section.version },
    'ADMIN',
    409,
  );
  await request(`/tenders/${tender.id}/generate-technical-bid`, 'POST', {});
  section = await db.bidSection.findUniqueOrThrow({
    where: { id: section.id },
  });
  assert.equal(
    section.editedContent,
    'Reviewed proposal to deliver the digital twin platform.',
  );
  await request(
    `/bid-workspaces/${workspace.id}/approve-documents`,
    'POST',
    {},
    'ADMIN',
    400,
  );
  const eligibility = await db.tenderEligibility.findFirstOrThrow({
    where: { tenderId: tender.id },
  });
  const compliance = await db.tenderComplianceItem.findFirstOrThrow({
    where: { tenderId: tender.id },
  });
  await request(
    `/tenders/${tender.id}/eligibility/${eligibility.id}`,
    'PATCH',
    { status: 'COMPLIANT', evidence: 'Manager reviewed capability record' },
  );
  await request(`/tenders/${tender.id}/compliance/${compliance.id}`, 'PATCH', {
    complianceStatus: 'COMPLIANT',
    evidence: 'Manager verified actual capability',
    companyDocumentId: companyDoc.id,
  });
  await request(
    `/bid-workspaces/${workspace.id}/commercial`,
    'PUT',
    { developmentCost: 100000, approvedQuote: 120000 },
    'FINANCE',
  );
  for (const area of ['technical', 'documents', 'commercial'])
    await request(
      `/bid-workspaces/${workspace.id}/approve-${area}`,
      'POST',
      {},
    );
  await request(`/bid-workspaces/${workspace.id}`, 'PATCH', {
    status: 'READY_FOR_SUBMISSION',
  });
  await request(
    `/bid-workspaces/${workspace.id}/commercial`,
    'PUT',
    { approvedQuote: 125000 },
    'FINANCE',
  );
  assert.equal(
    (await db.bidWorkspace.findUniqueOrThrow({ where: { id: workspace.id } }))
      .status,
    'IN_PREPARATION',
  );
  await request(
    `/bid-workspaces/${workspace.id}/approve-commercial`,
    'POST',
    {},
    'FINANCE',
  );
  await request(`/bid-workspaces/${workspace.id}`, 'PATCH', {
    status: 'READY_FOR_SUBMISSION',
  });
  await request(`/bid-workspaces/${workspace.id}/mark-submitted`, 'POST', {
    submittedAt: new Date().toISOString(),
    portalReference: 'TEST-ONLY-REF',
  });
  assert.equal(
    (await db.tender.findUniqueOrThrow({ where: { id: tender.id } })).status,
    'SUBMITTED',
  );
  await request(
    `/tenders/${tender.id}`,
    'PATCH',
    { title: 'Forbidden edit' },
    'ADMIN',
    409,
  );
  await request(`/bid-workspaces/${workspace.id}`, 'PATCH', { status: 'WON' });
  console.log(
    'PASS government HTTP workflow: intake, deduplication, revisions, upload/extract, cache, company evidence, authorization, compliance, generation, human edit preservation, approvals, invalidation, manual submission, won',
  );
  // Existing private flow: fixture source sync and mocked AI; no email is sent.
  const privateSource = await request('/lead-sources', 'POST', {
    name: 'Regression source',
    integrationType: 'MANUAL',
    configJson: {
      manualLeads: [
        {
          externalId: 'regression-project',
          title: 'Need React web application development',
          description:
            'Client project to build a web application with React, fixed budget 20000, delivery in 3 months.',
        },
      ],
    },
  });
  await request(`/lead-sources/${privateSource.id}/sync`, 'POST', {});
  const lead = await db.lead.findFirstOrThrow({
    where: { sourceId: privateSource.id },
  });
  await request(`/leads/${lead.id}/analyze`, 'POST', {});
  await request(`/leads/${lead.id}/status`, 'PATCH', { status: 'QUALIFIED' });
  const proposal = await request(
    `/leads/${lead.id}/generate-proposal`,
    'POST',
    {},
  );
  await request(`/proposals/${proposal.id}/approve`, 'POST', {});
  await request(`/proposals/${proposal.id}/mark-sent`, 'POST', {
    sentMethod: 'Manual test record',
  });
  await request(`/conversations/${lead.id}/messages`, 'POST', {
    senderType: 'CLIENT',
    messageText: 'Please send a quote',
    messageChannel: 'MANUAL_NOTE',
  });
  const followup = await request(
    `/leads/${lead.id}/generate-followup`,
    'POST',
    {},
  );
  await request(`/followups/${followup.id}/complete`, 'POST', {});
  await request('/quotations/generate', 'POST', {
    leadId: lead.id,
    amount: 20000,
    currency: 'INR',
  });
  const invoice = await request('/invoices', 'POST', {
    leadId: lead.id,
    amount: 20000,
    currency: 'INR',
    invoiceNumber: 'TEST-INVOICE',
  });
  await request(`/invoices/${invoice.id}/mark-paid`, 'POST', {});
  await request('/crm/move-stage', 'POST', { leadId: lead.id, status: 'WON' });
  await request('/crm/move-stage', 'POST', { leadId: lead.id, status: 'LOST' });
  console.log(
    'PASS private regression: source sync, lead, AI analysis, proposal, approval, manual sent record, conversation, follow-up, quotation, invoice, CRM won/lost',
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (app) await app.close();
    const cleanup = new PrismaClient({
      datasources: { db: { url: originalUrl } },
    });
    try {
      assert.match(schema, /^procurement_test_[a-f0-9]{32}$/);
      await cleanup.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
      );
    } finally {
      await cleanup.$disconnect();
      await rm(storage, { recursive: true, force: true });
    }
  });
