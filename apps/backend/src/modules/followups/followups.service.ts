import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FollowupStatus, LeadStatus, ProposalStatus } from '@prisma/client';
import { AiFollowupGeneratorService } from '../ai-agents/ai-followup-generator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowupPayload } from './followups.controller';

const followupInclude = {
  lead: {
    select: {
      id: true,
      title: true,
      clientName: true,
      sourceName: true,
      status: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      analysis: true,
    },
  },
} as const;

@Injectable()
export class FollowupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiFollowupGenerator: AiFollowupGeneratorService,
  ) {}

  async findAll(filters: { leadId?: string } = {}) {
    await this.ensureSecondFollowups();

    return this.prisma.followup.findMany({
      where: {
        leadId: filters.leadId,
      },
      include: followupInclude,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(input: FollowupPayload) {
    if (
      !input.leadId ||
      !input.followupType ||
      !input.message ||
      !input.scheduledAt
    ) {
      throw new BadRequestException(
        'leadId, followupType, message and scheduledAt are required',
      );
    }

    await this.ensureLead(input.leadId);

    return this.prisma.followup.create({
      data: {
        leadId: input.leadId,
        followupType: input.followupType,
        message: input.message,
        scheduledAt: parseDate(input.scheduledAt),
        status: input.status ?? FollowupStatus.PENDING,
      },
      include: followupInclude,
    });
  }

  async update(id: string, input: FollowupPayload) {
    await this.findOne(id);

    return this.prisma.followup.update({
      where: { id },
      data: {
        followupType: input.followupType,
        message: input.message,
        scheduledAt: input.scheduledAt
          ? parseDate(input.scheduledAt)
          : undefined,
        status: input.status,
        completedAt:
          input.status === FollowupStatus.COMPLETED ? new Date() : undefined,
      },
      include: followupInclude,
    });
  }

  async complete(id: string) {
    await this.findOne(id);

    return this.prisma.followup.update({
      where: { id },
      data: {
        status: FollowupStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: followupInclude,
    });
  }

  async generateForLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        proposals: { orderBy: { createdAt: 'desc' }, take: 1 },
        conversations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const result = await this.aiFollowupGenerator.generate({
      leadTitle: lead.title,
      clientName: lead.clientName,
      proposalText: lead.proposals[0]?.proposalText,
      lastMessage: lead.conversations[0]?.messages[0]?.messageText,
      followupType: 'AI_GENERATED',
    });

    return this.prisma.followup.create({
      data: {
        leadId,
        followupType: `AI_GENERATED_${Date.now()}`,
        message: result.message,
        scheduledAt: new Date(),
        status: FollowupStatus.PENDING,
      },
      include: followupInclude,
    });
  }

  async scheduleAfterProposalSent(leadId: string, sentAt = new Date()) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { title: true, clientName: true },
    });
    if (!lead) {
      return;
    }

    await this.prisma.followup.upsert({
      where: {
        leadId_followupType: {
          leadId,
          followupType: 'FIRST_AFTER_PROPOSAL_SENT',
        },
      },
      update: {},
      create: {
        leadId,
        followupType: 'FIRST_AFTER_PROPOSAL_SENT',
        message: defaultFollowupMessage(lead.clientName, lead.title),
        scheduledAt: addDays(sentAt, 2),
      },
    });
  }

  async ensureSecondFollowups() {
    const cutoff = addDays(new Date(), -5);
    const leads = await this.prisma.lead.findMany({
      where: {
        status: { not: LeadStatus.CLIENT_REPLIED },
        proposals: {
          some: {
            status: ProposalStatus.SENT,
            sentAt: { lte: cutoff },
          },
        },
        followups: {
          none: {
            followupType: 'SECOND_NO_REPLY',
          },
        },
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        proposals: {
          where: {
            status: ProposalStatus.SENT,
            sentAt: { lte: cutoff },
          },
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
      },
    });

    await Promise.all(
      leads.map((lead) =>
        this.prisma.followup.create({
          data: {
            leadId: lead.id,
            followupType: 'SECOND_NO_REPLY',
            message: secondFollowupMessage(lead.clientName, lead.title),
            scheduledAt: new Date(),
          },
        }),
      ),
    );
  }

  cancelPendingForLead(leadId: string) {
    return this.prisma.followup.updateMany({
      where: {
        leadId,
        status: FollowupStatus.PENDING,
      },
      data: {
        status: FollowupStatus.CANCELLED,
      },
    });
  }

  private async findOne(id: string) {
    const followup = await this.prisma.followup.findUnique({
      where: { id },
      include: followupInclude,
    });
    if (!followup) {
      throw new NotFoundException('Follow-up not found');
    }

    return followup;
  }

  private async ensureLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
  }
}

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid scheduledAt');
  }

  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function defaultFollowupMessage(clientName: string | null, title: string) {
  return `Hi ${clientName ?? 'there'},\n\nI wanted to follow up on the proposal for ${title}. Please let me know if you have any questions or if you would like to discuss the next steps.\n\nBest regards`;
}

function secondFollowupMessage(clientName: string | null, title: string) {
  return `Hi ${clientName ?? 'there'},\n\nJust checking in once more on the proposal for ${title}. If priorities have changed, no problem. If it is still relevant, I would be happy to clarify scope, timeline, or budget.\n\nBest regards`;
}
