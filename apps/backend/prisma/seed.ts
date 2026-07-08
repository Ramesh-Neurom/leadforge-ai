import {
  FollowupStatus,
  InvoicePaymentStatus,
  LeadStatus,
  Prisma,
  PrismaClient,
  QuotationStatus,
  ProposalStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'ramesh.avancha@neurom.in' },
    update: {},
    create: {
      email: 'ramesh.avancha@neurom.in',
      name: 'Admin',
      passwordHash: await bcrypt.hash('Admin@123', 12),
      role: Role.ADMIN,
    },
  });

  const upwork = await prisma.leadSource.upsert({
    where: { id: 'seed-source-upwork' },
    update: {
      integrationType: 'UPWORK_GMAIL_ALERTS',
      status: 'DISABLED',
      configJson: {
        futureOnly: true,
        notes:
          'Direct scraping is disabled. Future support should parse manager-approved Gmail alerts only.',
      },
    },
    create: {
      id: 'seed-source-upwork',
      name: 'Upwork',
      type: 'MARKETPLACE',
      integrationType: 'UPWORK_GMAIL_ALERTS',
      status: 'DISABLED',
      configJson: {
        futureOnly: true,
        notes:
          'Direct scraping is disabled. Future support should parse manager-approved Gmail alerts only.',
      },
    },
  });

  const linkedin = await prisma.leadSource.upsert({
    where: { id: 'seed-source-linkedin' },
    update: {
      integrationType: 'LINKEDIN_GMAIL_ALERTS',
      status: 'DISABLED',
      configJson: {
        futureOnly: true,
        notes:
          'Direct scraping is disabled. Future support should parse manager-approved Gmail alerts only.',
      },
    },
    create: {
      id: 'seed-source-linkedin',
      name: 'LinkedIn',
      type: 'SOCIAL',
      integrationType: 'LINKEDIN_GMAIL_ALERTS',
      status: 'DISABLED',
      configJson: {
        futureOnly: true,
        notes:
          'Direct scraping is disabled. Future support should parse manager-approved Gmail alerts only.',
      },
    },
  });

  const manual = await prisma.leadSource.upsert({
    where: { id: 'seed-source-manual' },
    update: {
      integrationType: 'MANUAL',
      status: 'ACTIVE',
      configJson: {
        notes: 'Direct referrals and manually captured opportunities',
        manualLeads: [
          {
            externalId: 'manual-referral-001',
            title: 'Referral lead for internal analytics app',
            description:
              'A referred prospect needs a lightweight analytics app with dashboard views and weekly reports.',
            clientName: 'Referral Prospect',
            clientCountry: 'India',
            projectUrl: 'https://example.com/referral/internal-analytics',
            skills: ['Next.js', 'API Development', 'PostgreSQL'],
            postedAt: '2026-07-08T09:00:00.000Z',
          },
        ],
      },
    },
    create: {
      id: 'seed-source-manual',
      name: 'Manual Entry',
      type: 'DIRECT',
      integrationType: 'MANUAL',
      status: 'ACTIVE',
      configJson: {
        notes: 'Direct referrals and manually captured opportunities',
        manualLeads: [
          {
            externalId: 'manual-referral-001',
            title: 'Referral lead for internal analytics app',
            description:
              'A referred prospect needs a lightweight analytics app with dashboard views and weekly reports.',
            clientName: 'Referral Prospect',
            clientCountry: 'India',
            projectUrl: 'https://example.com/referral/internal-analytics',
            skills: ['Next.js', 'API Development', 'PostgreSQL'],
            postedAt: '2026-07-08T09:00:00.000Z',
          },
        ],
      },
    },
  });

  await prisma.leadSource.upsert({
    where: { id: 'seed-source-remoteok' },
    update: {
      name: 'RemoteOK',
      type: 'JOB_BOARD',
      integrationType: 'REMOTEOK',
      status: 'ACTIVE',
      configJson: { endpoint: 'https://remoteok.com/api' },
    },
    create: {
      id: 'seed-source-remoteok',
      name: 'RemoteOK',
      type: 'JOB_BOARD',
      integrationType: 'REMOTEOK',
      status: 'ACTIVE',
      configJson: { endpoint: 'https://remoteok.com/api' },
    },
  });

  await prisma.leadSource.upsert({
    where: { id: 'seed-source-wwr-rss' },
    update: {
      name: 'We Work Remotely RSS',
      type: 'RSS',
      integrationType: 'WE_WORK_REMOTELY_RSS',
      status: 'ACTIVE',
      configJson: {
        feedUrl:
          'https://weworkremotely.com/categories/remote-programming-jobs.rss',
      },
    },
    create: {
      id: 'seed-source-wwr-rss',
      name: 'We Work Remotely RSS',
      type: 'RSS',
      integrationType: 'WE_WORK_REMOTELY_RSS',
      status: 'ACTIVE',
      configJson: {
        feedUrl:
          'https://weworkremotely.com/categories/remote-programming-jobs.rss',
      },
    },
  });

  await prisma.leadSource.upsert({
    where: { id: 'seed-source-generic-rss' },
    update: {
      name: 'Generic RSS Example',
      type: 'RSS',
      integrationType: 'GENERIC_RSS',
      status: 'ACTIVE',
      configJson: { feedUrl: 'https://remoteok.com/remote-dev-jobs.rss' },
    },
    create: {
      id: 'seed-source-generic-rss',
      name: 'Generic RSS Example',
      type: 'RSS',
      integrationType: 'GENERIC_RSS',
      status: 'ACTIVE',
      configJson: { feedUrl: 'https://remoteok.com/remote-dev-jobs.rss' },
    },
  });

  await prisma.leadSource.upsert({
    where: { id: 'seed-source-freelancer-api' },
    update: {
      name: 'Freelancer API Placeholder',
      type: 'MARKETPLACE',
      integrationType: 'FREELANCER_API',
      status: 'DISABLED',
      configJson: {
        apiKey: 'dummy-freelancer-api-key',
        notes:
          'Configuration placeholder only. Fetching is not implemented yet.',
      },
    },
    create: {
      id: 'seed-source-freelancer-api',
      name: 'Freelancer API Placeholder',
      type: 'MARKETPLACE',
      integrationType: 'FREELANCER_API',
      status: 'DISABLED',
      configJson: {
        apiKey: 'dummy-freelancer-api-key',
        notes:
          'Configuration placeholder only. Fetching is not implemented yet.',
      },
    },
  });

  await seedRestrictedSource(
    'seed-source-fiverr-gmail',
    'Fiverr Gmail Alert Placeholder',
    'FIVERR_GMAIL_ALERTS',
  );
  await seedRestrictedSource(
    'seed-source-indeed-gmail',
    'Indeed Gmail Alert Placeholder',
    'INDEED_GMAIL_ALERTS',
  );

  const inventoryLead = await seedLead({
    sourceId: upwork.id,
    sourceName: upwork.name,
    externalId: 'upwork-erp-001',
    title: 'Build AI-enabled inventory forecasting dashboard',
    description:
      'Client needs a web dashboard for inventory forecasting, sales trend analysis, and replenishment alerts for a retail chain.',
    clientName: 'RetailOps Group',
    clientCountry: 'United States',
    clientProfileUrl: 'https://www.upwork.com/freelancers/~retailops',
    projectUrl: 'https://www.upwork.com/jobs/~inventory-forecasting-dashboard',
    budgetType: 'FIXED',
    budgetMin: 4500,
    budgetMax: 7000,
    currency: 'USD',
    skillsJson: ['Next.js', 'NestJS', 'PostgreSQL', 'Forecasting'],
    postedAt: new Date('2026-07-07T10:30:00.000Z'),
    status: LeadStatus.QUALIFIED,
    assignedToId: admin.id,
    analysis: {
      leadScore: 86,
      priority: 'HIGH',
      category: 'Analytics Dashboard',
      requiredSkillsJson: ['React', 'Node.js', 'Data Visualization'],
      budgetQuality: 'GOOD',
      clientSeriousness: 'HIGH',
      redFlagsJson: [],
      aiSummary: 'Seeded manual analysis placeholder. AI is not connected yet.',
      recommendedAction: 'APPLY',
    },
  });

  const crmLead = await seedLead({
    sourceId: linkedin.id,
    sourceName: linkedin.name,
    externalId: 'linkedin-crm-001',
    title: 'CRM automation for a B2B consulting team',
    description:
      'Founder is looking for lightweight CRM automation, lead reminders, quotation tracking, and email follow-up templates.',
    clientName: 'Northstar Consulting',
    clientCountry: 'India',
    clientEmail: 'ops@northstar.example',
    clientProfileUrl: 'https://www.linkedin.com/company/northstar-consulting',
    budgetType: 'HOURLY',
    budgetMin: 25,
    budgetMax: 45,
    currency: 'USD',
    skillsJson: ['CRM', 'Automation', 'Node.js', 'Email Workflows'],
    postedAt: new Date('2026-07-06T15:00:00.000Z'),
    status: LeadStatus.PROPOSAL_SENT,
    assignedToId: admin.id,
    analysis: {
      leadScore: 78,
      priority: 'MEDIUM',
      category: 'CRM',
      requiredSkillsJson: ['NestJS', 'PostgreSQL', 'Integrations'],
      budgetQuality: 'FAIR',
      clientSeriousness: 'MEDIUM',
      redFlagsJson: ['Scope needs clarification'],
      aiSummary: 'Seeded manual analysis placeholder. AI is not connected yet.',
      recommendedAction: 'REVIEW',
    },
  });

  const mobileLead = await seedLead({
    sourceId: manual.id,
    sourceName: manual.name,
    title: 'Mobile app MVP for service booking marketplace',
    description:
      'Referral lead wants a cross-platform MVP with provider profiles, booking calendar, payments, and admin reporting.',
    clientName: 'ServiceLaunch',
    clientCountry: 'United Kingdom',
    clientEmail: 'founder@servicelaunch.example',
    projectUrl: 'https://servicelaunch.example/brief',
    budgetType: 'FIXED',
    budgetMin: 9000,
    budgetMax: 14000,
    currency: 'GBP',
    skillsJson: ['React Native', 'Payments', 'Admin Dashboard'],
    postedAt: new Date('2026-07-05T08:15:00.000Z'),
    status: LeadStatus.NEW,
    analysis: {
      leadScore: 72,
      priority: 'MEDIUM',
      category: 'Mobile App',
      requiredSkillsJson: ['React Native', 'API Design', 'Stripe'],
      budgetQuality: 'GOOD',
      clientSeriousness: 'MEDIUM',
      redFlagsJson: ['MVP scope may be broad'],
      aiSummary: 'Seeded manual analysis placeholder. AI is not connected yet.',
      recommendedAction: 'REVIEW',
    },
  });

  await seedProposal({
    id: 'seed-proposal-inventory',
    leadId: inventoryLead.id,
    proposalText:
      'Hi RetailOps Group,\n\nThanks for sharing the requirement for an inventory forecasting dashboard. Based on the brief, the main need is a practical web dashboard that can help your team review sales trends, forecast replenishment needs, and act on stock alerts without adding unnecessary operational complexity.\n\nI suggest building a secure full-stack dashboard with role-based access, sales and inventory data ingestion, forecasting views, alert rules, and reporting exports. A suitable stack would be Next.js for the frontend, NestJS for APIs, PostgreSQL for structured data, and a forecasting layer that can start with transparent statistical models before moving into advanced ML where the data supports it.\n\nA realistic delivery plan is 4 to 6 weeks after requirements and data sources are confirmed. The estimated budget range is USD 4,500 to 7,000 depending on integrations and reporting depth.\n\nA few questions before finalizing scope:\n1. Which inventory or POS systems should the dashboard integrate with?\n2. Do you already have historical sales and stock data available?\n3. What user roles are needed for store, regional, and admin teams?\n\nIf this direction works, the next step can be a short discovery call to confirm data sources, core dashboards, and the first release scope.',
    solutionSummary:
      'Secure forecasting dashboard with inventory data ingestion, sales trend views, replenishment alerts, and reports.',
    timeline:
      '4 to 6 weeks after data sources and core workflows are confirmed.',
    budgetRange: 'USD 4,500 - 7,000',
    questionsJson: [
      'Which inventory or POS systems should the dashboard integrate with?',
      'Do you already have historical sales and stock data available?',
      'What user roles are needed for store, regional, and admin teams?',
    ],
    portfolioLinksJson: [],
    status: ProposalStatus.DRAFT,
  });

  await seedProposal({
    id: 'seed-proposal-crm',
    leadId: crmLead.id,
    proposalText:
      'Hi Northstar Consulting,\n\nI understand you are looking for lightweight CRM automation to manage lead reminders, quotation tracking, and follow-up templates for a B2B consulting workflow.\n\nA practical solution would be to keep the first version focused on contact and lead tracking, reminder workflows, quotation status visibility, and reusable email follow-up templates. The technical stack can use a Node.js/NestJS backend, PostgreSQL database, and a clean React or Next.js interface, with email integration added after the workflow is confirmed.\n\nFor a lean first version, a realistic timeline is 3 to 5 weeks. The budget can be planned around USD 25 to 45/hour depending on the final scope and integrations.\n\nClarification questions:\n1. Which email provider should the follow-up workflow use?\n2. Do quotations already exist in a template or document format?\n3. How many team members will use the CRM in the first release?\n\nIf this approach is aligned, I can help define the first release scope and turn it into a clear implementation plan.',
    solutionSummary:
      'Lean CRM automation for lead reminders, quotation tracking, and reusable follow-up workflows.',
    timeline: '3 to 5 weeks for a focused first release.',
    budgetRange: 'USD 25 - 45/hour',
    questionsJson: [
      'Which email provider should the follow-up workflow use?',
      'Do quotations already exist in a template or document format?',
      'How many team members will use the CRM in the first release?',
    ],
    portfolioLinksJson: [],
    status: ProposalStatus.SENT,
    approvedById: admin.id,
    approvedAt: new Date('2026-07-06T18:00:00.000Z'),
    sentMethod: 'Email',
    sentAt: new Date('2026-07-06T18:30:00.000Z'),
  });

  await seedProposal({
    id: 'seed-proposal-mobile',
    leadId: mobileLead.id,
    proposalText:
      'Hi ServiceLaunch,\n\nThanks for the brief for the service booking marketplace MVP. The requirement appears to include provider profiles, booking calendar, payment flow, and an admin reporting area.\n\nA sensible MVP approach would be to first define the smallest booking workflow, then build customer and provider flows around that. React Native can be used for the mobile app, with a Node.js backend, PostgreSQL, and Stripe integration if online payments are required in the first version.\n\nA realistic MVP timeline is 8 to 12 weeks depending on payment, notification, and admin reporting depth. The initial budget range can be GBP 9,000 to 14,000 after scope confirmation.\n\nQuestions:\n1. Should providers manage availability themselves?\n2. Is payment required before booking confirmation?\n3. Which reports are required for the admin team in the MVP?\n\nIf this is the right direction, the next step is to confirm the first-release workflow and split it into milestones.',
    solutionSummary:
      'Cross-platform marketplace MVP with booking workflow, provider profiles, payments, and admin reporting.',
    timeline: '8 to 12 weeks depending on payment and reporting scope.',
    budgetRange: 'GBP 9,000 - 14,000',
    questionsJson: [
      'Should providers manage availability themselves?',
      'Is payment required before booking confirmation?',
      'Which reports are required for the admin team in the MVP?',
    ],
    portfolioLinksJson: [],
    status: ProposalStatus.WAITING_APPROVAL,
  });

  await seedActivity({
    id: 'seed-activity-inventory-qualified',
    leadId: inventoryLead.id,
    userId: admin.id,
    activityType: 'STATUS_CHANGE',
    description: 'Lead moved from AI Reviewed to Qualified',
    metadataJson: {
      fromStatus: LeadStatus.AI_REVIEWED,
      toStatus: LeadStatus.QUALIFIED,
      source: 'SEED',
    },
  });

  await seedActivity({
    id: 'seed-activity-crm-proposal-sent',
    leadId: crmLead.id,
    userId: admin.id,
    activityType: 'STATUS_CHANGE',
    description: 'Lead moved from Proposal Drafted to Proposal Sent',
    metadataJson: {
      fromStatus: LeadStatus.PROPOSAL_DRAFTED,
      toStatus: LeadStatus.PROPOSAL_SENT,
      source: 'SEED',
    },
  });

  await seedActivity({
    id: 'seed-activity-mobile-new',
    leadId: mobileLead.id,
    userId: admin.id,
    activityType: 'STATUS_CHANGE',
    description: 'Lead captured in CRM pipeline',
    metadataJson: {
      fromStatus: null,
      toStatus: LeadStatus.NEW,
      source: 'SEED',
    },
  });

  await seedFollowup({
    id: 'seed-followup-inventory-first',
    leadId: inventoryLead.id,
    followupType: 'FIRST_AFTER_PROPOSAL_SENT',
    message:
      'Hi RetailOps Group,\n\nI wanted to follow up on the inventory forecasting dashboard proposal. Please let me know if you have any questions or if you would like to discuss next steps.\n\nBest regards',
    scheduledAt: new Date('2026-07-09T10:00:00.000Z'),
    status: FollowupStatus.PENDING,
  });

  await seedFollowup({
    id: 'seed-followup-crm-completed',
    leadId: crmLead.id,
    followupType: 'FIRST_AFTER_PROPOSAL_SENT',
    message:
      'Hi Northstar Consulting,\n\nFollowing up on the CRM automation proposal. Happy to clarify scope, timeline, or email workflow details if helpful.\n\nBest regards',
    scheduledAt: new Date('2026-07-08T10:00:00.000Z'),
    status: FollowupStatus.COMPLETED,
    completedAt: new Date('2026-07-08T12:00:00.000Z'),
  });

  await seedQuotation({
    id: 'seed-quotation-inventory',
    leadId: inventoryLead.id,
    proposalId: 'seed-proposal-inventory',
    scopeSummary:
      'Inventory forecasting dashboard with sales trend views, replenishment alerts, and role-based reporting.',
    amount: 6500,
    currency: 'USD',
    timeline: '4 to 6 weeks',
    paymentTerms: '50% advance, 50% on delivery',
    status: QuotationStatus.DRAFT,
    pdfUrl: '/quotations/seed-quotation-inventory/preview',
  });

  await seedQuotation({
    id: 'seed-quotation-crm',
    leadId: crmLead.id,
    proposalId: 'seed-proposal-crm',
    scopeSummary:
      'CRM automation for lead reminders, quotation tracking, and reusable follow-up workflows.',
    amount: 3600,
    currency: 'USD',
    timeline: '3 to 5 weeks',
    paymentTerms: 'Monthly milestone billing',
    status: QuotationStatus.SENT,
    pdfUrl: '/quotations/seed-quotation-crm/preview',
  });

  await seedInvoice({
    id: 'seed-invoice-crm',
    leadId: crmLead.id,
    clientName: 'Northstar Consulting',
    amount: 1800,
    currency: 'USD',
    invoiceNumber: 'INV-2026-0001',
    invoicePdfUrl: '/invoices/INV-2026-0001/preview',
    paymentStatus: InvoicePaymentStatus.UNPAID,
    dueDate: new Date('2026-07-20T00:00:00.000Z'),
  });
}

async function seedLead(input: {
  sourceId: string;
  sourceName: string;
  externalId?: string;
  title: string;
  description: string;
  clientName?: string;
  clientCountry?: string;
  clientEmail?: string;
  clientProfileUrl?: string;
  projectUrl?: string;
  budgetType?: string;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  skillsJson: string[];
  postedAt: Date;
  status: LeadStatus;
  assignedToId?: string;
  analysis: {
    leadScore: number;
    priority: string;
    category: string;
    requiredSkillsJson: string[];
    budgetQuality: string;
    clientSeriousness: string;
    redFlagsJson: string[];
    aiSummary: string;
    recommendedAction: string;
  };
}) {
  const existing = input.externalId
    ? await prisma.lead.findFirst({
        where: { sourceId: input.sourceId, externalId: input.externalId },
      })
    : await prisma.lead.findFirst({
        where: { sourceId: input.sourceId, title: input.title },
      });

  const lead = existing
    ? await prisma.lead.update({
        where: { id: existing.id },
        data: {
          sourceName: input.sourceName,
          title: input.title,
          description: input.description,
          clientName: input.clientName,
          clientCountry: input.clientCountry,
          clientEmail: input.clientEmail,
          clientProfileUrl: input.clientProfileUrl,
          projectUrl: input.projectUrl,
          budgetType: input.budgetType,
          budgetMin: input.budgetMin,
          budgetMax: input.budgetMax,
          currency: input.currency,
          skillsJson: input.skillsJson,
          postedAt: input.postedAt,
          status: input.status,
          assignedToId: input.assignedToId,
        },
      })
    : await prisma.lead.create({
        data: {
          sourceId: input.sourceId,
          sourceName: input.sourceName,
          externalId: input.externalId,
          title: input.title,
          description: input.description,
          clientName: input.clientName,
          clientCountry: input.clientCountry,
          clientEmail: input.clientEmail,
          clientProfileUrl: input.clientProfileUrl,
          projectUrl: input.projectUrl,
          budgetType: input.budgetType,
          budgetMin: input.budgetMin,
          budgetMax: input.budgetMax,
          currency: input.currency,
          skillsJson: input.skillsJson,
          postedAt: input.postedAt,
          status: input.status,
          assignedToId: input.assignedToId,
        },
      });

  await prisma.leadAnalysis.upsert({
    where: { leadId: lead.id },
    update: input.analysis,
    create: {
      leadId: lead.id,
      ...input.analysis,
    },
  });

  return lead;
}

async function seedProposal(input: {
  id: string;
  leadId: string;
  proposalText: string;
  solutionSummary: string;
  timeline: string;
  budgetRange: string;
  questionsJson: string[];
  portfolioLinksJson: string[];
  status: ProposalStatus;
  approvedById?: string;
  approvedAt?: Date;
  sentMethod?: string;
  sentAt?: Date;
}) {
  await prisma.proposal.upsert({
    where: { id: input.id },
    update: {
      proposalText: input.proposalText,
      solutionSummary: input.solutionSummary,
      timeline: input.timeline,
      budgetRange: input.budgetRange,
      questionsJson: input.questionsJson,
      portfolioLinksJson: input.portfolioLinksJson,
      status: input.status,
      approvedById: input.approvedById,
      approvedAt: input.approvedAt,
      sentMethod: input.sentMethod,
      sentAt: input.sentAt,
    },
    create: input,
  });
}

async function seedActivity(input: {
  id: string;
  leadId: string;
  userId: string;
  activityType: string;
  description: string;
  metadataJson: Prisma.InputJsonObject;
}) {
  await prisma.crmActivity.upsert({
    where: { id: input.id },
    update: {
      activityType: input.activityType,
      description: input.description,
      metadataJson: input.metadataJson,
    },
    create: {
      id: input.id,
      activityType: input.activityType,
      description: input.description,
      metadataJson: input.metadataJson,
      lead: { connect: { id: input.leadId } },
      user: { connect: { id: input.userId } },
    },
  });
}

async function seedFollowup(input: {
  id: string;
  leadId: string;
  followupType: string;
  message: string;
  scheduledAt: Date;
  status: FollowupStatus;
  completedAt?: Date;
}) {
  await prisma.followup.upsert({
    where: { id: input.id },
    update: {
      followupType: input.followupType,
      message: input.message,
      scheduledAt: input.scheduledAt,
      status: input.status,
      completedAt: input.completedAt,
    },
    create: input,
  });
}

async function seedQuotation(input: {
  id: string;
  leadId: string;
  proposalId?: string;
  scopeSummary: string;
  amount: number;
  currency: string;
  timeline?: string;
  paymentTerms?: string;
  status: QuotationStatus;
  pdfUrl?: string;
}) {
  await prisma.quotation.upsert({
    where: { id: input.id },
    update: {
      scopeSummary: input.scopeSummary,
      amount: input.amount,
      currency: input.currency,
      timeline: input.timeline,
      paymentTerms: input.paymentTerms,
      status: input.status,
      pdfUrl: input.pdfUrl,
    },
    create: input,
  });
}

async function seedInvoice(input: {
  id: string;
  leadId: string;
  clientName?: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  invoicePdfUrl?: string;
  paymentStatus: InvoicePaymentStatus;
  dueDate?: Date;
}) {
  await prisma.invoice.upsert({
    where: { id: input.id },
    update: {
      clientName: input.clientName,
      amount: input.amount,
      currency: input.currency,
      invoiceNumber: input.invoiceNumber,
      invoicePdfUrl: input.invoicePdfUrl,
      paymentStatus: input.paymentStatus,
      dueDate: input.dueDate,
    },
    create: input,
  });
}

async function seedRestrictedSource(
  id: string,
  name: string,
  integrationType: string,
) {
  await prisma.leadSource.upsert({
    where: { id },
    update: {
      name,
      type: 'MARKETPLACE',
      integrationType,
      status: 'DISABLED',
      configJson: {
        futureOnly: true,
        notes:
          'Direct scraping is disabled. Future support should parse manager-approved Gmail alerts only.',
      },
    },
    create: {
      id,
      name,
      type: 'MARKETPLACE',
      integrationType,
      status: 'DISABLED',
      configJson: {
        futureOnly: true,
        notes:
          'Direct scraping is disabled. Future support should parse manager-approved Gmail alerts only.',
      },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
