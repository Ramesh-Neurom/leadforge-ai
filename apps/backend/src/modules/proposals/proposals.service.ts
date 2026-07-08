import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeadStatus,
  Prisma,
  ProposalStatus,
  Role,
  SenderType,
} from '@prisma/client';
import { AiProposalGeneratorService } from '../ai-agents/ai-proposal-generator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { EmailProvider } from '../email/email.provider';
import { FollowupsService } from '../followups/followups.service';
import { ProposalPayload } from './proposals.controller';

const proposalInclude = {
  lead: {
    select: {
      id: true,
      title: true,
      clientName: true,
      clientCountry: true,
      sourceName: true,
      status: true,
      clientEmail: true,
    },
  },
  approvedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

const proposalStatuses = new Set<string>(Object.values(ProposalStatus));

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProposalGenerator: AiProposalGeneratorService,
    private readonly conversations: ConversationsService,
    private readonly emailProvider: EmailProvider,
    private readonly followups: FollowupsService,
  ) {}

  findAll() {
    return this.prisma.proposal.findMany({
      include: proposalInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: proposalInclude,
    });
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    return proposal;
  }

  async generateForLead(leadId: string, actorUserId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { analysis: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const result = await this.aiProposalGenerator.generateProposal({
      title: lead.title,
      description: lead.description,
      sourceName: lead.sourceName,
      clientName: lead.clientName,
      clientCountry: lead.clientCountry,
      budgetType: lead.budgetType,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      currency: lead.currency,
      skills: parseStringArray(lead.skillsJson),
      analysis: lead.analysis
        ? {
            leadScore: lead.analysis.leadScore,
            priority: lead.analysis.priority,
            category: lead.analysis.category,
            requiredSkills: parseStringArray(lead.analysis.requiredSkillsJson),
            budgetQuality: lead.analysis.budgetQuality,
            clientSeriousness: lead.analysis.clientSeriousness,
            redFlags: parseStringArray(lead.analysis.redFlagsJson),
            aiSummary: lead.analysis.aiSummary,
            recommendedAction: lead.analysis.recommendedAction,
          }
        : null,
    });

    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.create({
        data: {
          leadId,
          proposalText: result.proposal_text,
          solutionSummary: result.solution_summary,
          timeline: result.timeline,
          budgetRange: result.budget_range,
          questionsJson: result.questions,
          portfolioLinksJson: result.portfolio_links,
          status: ProposalStatus.DRAFT,
        },
        include: proposalInclude,
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.PROPOSAL_DRAFTED },
      });

      if (lead.status !== LeadStatus.PROPOSAL_DRAFTED) {
        await tx.crmActivity.create({
          data: {
            leadId,
            userId: actorUserId,
            activityType: 'STATUS_CHANGE',
            description: statusChangeDescription(
              lead.status,
              LeadStatus.PROPOSAL_DRAFTED,
            ),
            metadataJson: {
              fromStatus: lead.status,
              toStatus: LeadStatus.PROPOSAL_DRAFTED,
              source: 'PROPOSAL_GENERATION',
              proposalId: proposal.id,
            },
          },
        });
      }

      return proposal;
    });
  }

  async update(id: string, input: ProposalPayload) {
    await this.findOne(id);

    return this.prisma.proposal.update({
      where: { id },
      data: {
        proposalText: input.proposalText,
        solutionSummary: emptyToNull(input.solutionSummary),
        timeline: emptyToNull(input.timeline),
        budgetRange: emptyToNull(input.budgetRange),
        questionsJson: normalizeArrayJson(input.questionsJson, input.questions),
        portfolioLinksJson: normalizeArrayJson(
          input.portfolioLinksJson,
          input.portfolioLinks,
        ),
        status: input.status ? parseProposalStatus(input.status) : undefined,
        sentMethod: emptyToNull(input.sentMethod),
      },
      include: proposalInclude,
    });
  }

  async approve(id: string, approvedById: string) {
    await this.findOne(id);

    return this.prisma.proposal.update({
      where: { id },
      data: {
        status: ProposalStatus.APPROVED,
        approvedById,
        approvedAt: new Date(),
      },
      include: proposalInclude,
    });
  }

  async reject(id: string) {
    await this.findOne(id);

    return this.prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatus.REJECTED },
      include: proposalInclude,
    });
  }

  async markSent(
    id: string,
    actorUserId: string,
    sentMethod?: string,
    actorRole?: Role,
  ) {
    if (actorRole) {
      assertManager(actorRole);
    }

    const proposal = await this.findOne(id);
    if (
      proposal.status !== ProposalStatus.APPROVED &&
      proposal.status !== ProposalStatus.SENT
    ) {
      throw new BadRequestException('Proposal must be approved before sending');
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: proposal.lead.id },
      select: { status: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.proposal.update({
        where: { id },
        data: {
          status: ProposalStatus.SENT,
          sentMethod: sentMethod?.trim() || 'Manual',
          sentAt: new Date(),
        },
        include: proposalInclude,
      });

      await tx.lead.update({
        where: { id: proposal.lead.id },
        data: { status: LeadStatus.PROPOSAL_SENT },
      });

      if (lead.status !== LeadStatus.PROPOSAL_SENT) {
        await tx.crmActivity.create({
          data: {
            leadId: proposal.lead.id,
            userId: actorUserId,
            activityType: 'STATUS_CHANGE',
            description: statusChangeDescription(
              lead.status,
              LeadStatus.PROPOSAL_SENT,
            ),
            metadataJson: {
              fromStatus: lead.status,
              toStatus: LeadStatus.PROPOSAL_SENT,
              source: 'PROPOSAL_MARK_SENT',
              proposalId: id,
            },
          },
        });
      }

      return updated;
    });

    await this.followups.scheduleAfterProposalSent(
      updated.lead.id,
      updated.sentAt ?? new Date(),
    );

    return updated;
  }

  async sendEmail(
    id: string,
    actorUserId: string,
    actorRole: Role,
    input: { messageText?: string; subject?: string },
  ) {
    assertManager(actorRole);
    const proposal = await this.getApprovedProposalForSending(id);
    if (!proposal.lead.clientEmail) {
      throw new BadRequestException(
        'Client email is missing. Use manual copy workflow.',
      );
    }

    const messageText = input.messageText?.trim() || proposal.proposalText;
    const subject = input.subject?.trim() || `Proposal: ${proposal.lead.title}`;

    await this.emailProvider.send({
      to: proposal.lead.clientEmail,
      subject,
      text: messageText,
    });

    const updatedProposal = await this.markSent(id, actorUserId, 'Email');
    const conversation = await this.conversations.addMessageForLead(
      proposal.lead.id,
      {
        senderType: SenderType.MANAGER,
        messageText,
        messageChannel: 'EMAIL',
        aiSummary: 'Proposal sent by email.',
      },
    );

    return { proposal: updatedProposal, conversation };
  }

  async copyManualSend(
    id: string,
    actorUserId: string,
    actorRole: Role,
    messageText?: string,
  ) {
    assertManager(actorRole);
    const proposal = await this.getApprovedProposalForSending(id);
    const text = messageText?.trim() || proposal.proposalText;
    const updatedProposal = await this.markSent(id, actorUserId, 'Manual Copy');
    const conversation = await this.conversations.addMessageForLead(
      proposal.lead.id,
      {
        senderType: SenderType.MANAGER,
        messageText: text,
        messageChannel: 'MANUAL_COPY',
        aiSummary: 'Proposal copied for manual sending.',
      },
    );

    return { proposal: updatedProposal, conversation, messageText: text };
  }

  private async getApprovedProposalForSending(id: string) {
    const proposal = await this.findOne(id);
    if (proposal.status !== ProposalStatus.APPROVED) {
      throw new BadRequestException('Proposal must be approved before sending');
    }

    return proposal;
  }
}

function emptyToNull(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeArrayJson(jsonValue: unknown, value?: string[] | string) {
  if (jsonValue !== undefined) {
    return jsonValue as Prisma.InputJsonValue;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}

function parseProposalStatus(status: ProposalStatus) {
  if (!proposalStatuses.has(status)) {
    throw new BadRequestException('Invalid proposal status');
  }

  return status;
}

function parseStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function statusChangeDescription(fromStatus: LeadStatus, toStatus: LeadStatus) {
  return `Lead moved from ${formatStatus(fromStatus)} to ${formatStatus(toStatus)}`;
}

function formatStatus(status: LeadStatus) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function assertManager(role: Role) {
  if (role !== Role.ADMIN && role !== Role.MANAGER) {
    throw new BadRequestException('Only a manager can send proposals');
  }
}
