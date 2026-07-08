import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowupsService } from '../followups/followups.service';

export const pipelineStatuses = [
  LeadStatus.NEW,
  LeadStatus.AI_REVIEWED,
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL_DRAFTED,
  LeadStatus.WAITING_APPROVAL,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.CLIENT_REPLIED,
  LeadStatus.FOLLOW_UP_NEEDED,
  LeadStatus.MEETING_SCHEDULED,
  LeadStatus.NEGOTIATION,
  LeadStatus.WON,
  LeadStatus.LOST,
] as const;

const leadCardInclude = {
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  analysis: true,
} as const;

const activityInclude = {
  lead: {
    select: {
      id: true,
      title: true,
      status: true,
      sourceName: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} as const;

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly followups: FollowupsService,
  ) {}

  async pipeline() {
    const leads = await this.prisma.lead.findMany({
      where: { status: { in: [...pipelineStatuses] } },
      include: leadCardInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return pipelineStatuses.map((status) => ({
      status,
      leads: leads.filter((lead) => lead.status === status),
    }));
  }

  findActivities() {
    return this.prisma.crmActivity.findMany({
      include: activityInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findLeadActivities(leadId: string) {
    return this.prisma.crmActivity.findMany({
      where: { leadId },
      include: activityInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async moveStage(
    leadId?: string,
    status?: LeadStatus,
    userId?: string,
    actorRole?: Role,
  ) {
    if (!leadId || !status || !userId) {
      throw new BadRequestException('leadId and status are required');
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { analysis: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const nextStatus = parseLeadStatus(status);
    if (nextStatus === LeadStatus.REJECTED) {
      throw new BadRequestException('REJECTED is not a CRM pipeline stage');
    }

    if (nextStatus === LeadStatus.QUALIFIED) {
      if (actorRole !== Role.ADMIN && actorRole !== Role.MANAGER) {
        throw new BadRequestException(
          'Only a manager can mark a lead as qualified',
        );
      }

      if (lead.analysis?.recommendedAction !== 'APPLY') {
        throw new BadRequestException(
          'Only APPLY recommendations can be marked as qualified',
        );
      }
    }

    const updated = await this.updateLeadStatusWithActivity({
      leadId,
      userId,
      fromStatus: lead.status,
      toStatus: nextStatus,
      activityType: 'STATUS_CHANGE',
      description: `Lead moved from ${formatStatus(lead.status)} to ${formatStatus(nextStatus)}`,
      metadataJson: { source: 'CRM_PIPELINE' },
    });

    if (nextStatus === LeadStatus.CLIENT_REPLIED) {
      await this.followups.cancelPendingForLead(leadId);
    }

    return updated;
  }

  async updateLeadStatusWithActivity(input: {
    leadId: string;
    userId: string;
    fromStatus: LeadStatus;
    toStatus: LeadStatus;
    activityType?: string;
    description?: string;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id: input.leadId },
        data: { status: input.toStatus },
        include: leadCardInclude,
      });

      if (input.fromStatus !== input.toStatus) {
        await tx.crmActivity.create({
          data: {
            leadId: input.leadId,
            userId: input.userId,
            activityType: input.activityType ?? 'STATUS_CHANGE',
            description:
              input.description ??
              `Lead moved from ${formatStatus(input.fromStatus)} to ${formatStatus(input.toStatus)}`,
            metadataJson: {
              fromStatus: input.fromStatus,
              toStatus: input.toStatus,
              ...(isObject(input.metadataJson) ? input.metadataJson : {}),
            },
          },
        });
      }

      return lead;
    });
  }

  createActivity(input: {
    leadId: string;
    userId: string;
    activityType: string;
    description: string;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    return this.prisma.crmActivity.create({
      data: {
        leadId: input.leadId,
        userId: input.userId,
        activityType: input.activityType,
        description: input.description,
        metadataJson: input.metadataJson,
      },
    });
  }
}

function parseLeadStatus(status: LeadStatus) {
  if (!Object.values(LeadStatus).includes(status)) {
    throw new BadRequestException('Invalid lead status');
  }

  return status;
}

function formatStatus(status: LeadStatus) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
