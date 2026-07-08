import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiLeadAnalysisService } from '../ai-agents/ai-lead-analysis.service';
import { CrmService } from '../crm/crm.service';
import { FollowupsService } from '../followups/followups.service';
import { LeadPayload } from './leads.controller';

const leadInclude = {
  source: true,
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  analysis: true,
  proposals: {
    orderBy: { createdAt: 'desc' },
    include: {
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  },
} as const;

const leadStatuses = new Set<string>(Object.values(LeadStatus));

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiLeadAnalysis: AiLeadAnalysisService,
    private readonly crm: CrmService,
    private readonly followups: FollowupsService,
  ) {}

  findSources() {
    return this.prisma.leadSource.findMany({ orderBy: { name: 'asc' } });
  }

  findAll(filters: {
    sourceId?: string;
    status?: LeadStatus;
    minScore?: string;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.LeadWhereInput = {};

    if (filters.sourceId) {
      where.sourceId = filters.sourceId;
    }

    if (filters.status) {
      where.status = this.parseStatus(filters.status);
    }

    const minScore = parseFilterNumber(filters.minScore);
    if (minScore !== undefined) {
      where.analysis = { leadScore: { gte: minScore } };
    }

    const from = parseFilterDate(filters.from);
    const to = parseFilterDate(filters.to);
    if (from || to) {
      where.postedAt = {
        gte: from,
        lte: to,
      };
    }

    return this.prisma.lead.findMany({
      where,
      include: leadInclude,
      orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async create(input: LeadPayload) {
    if (!input.sourceId || !input.title || !input.description) {
      throw new BadRequestException(
        'sourceId, title and description are required',
      );
    }

    const source = await this.prisma.leadSource.findUnique({
      where: { id: input.sourceId },
    });
    if (!source) {
      throw new BadRequestException('Lead source not found');
    }

    return this.prisma.lead.create({
      data: {
        sourceId: source.id,
        sourceName: source.name,
        externalId: emptyToNull(input.externalId),
        title: input.title,
        description: input.description,
        clientName: emptyToNull(input.clientName),
        clientCountry: emptyToNull(input.clientCountry),
        clientEmail: emptyToNull(input.clientEmail),
        clientProfileUrl: emptyToNull(input.clientProfileUrl),
        projectUrl: emptyToNull(input.projectUrl),
        budgetType: emptyToNull(input.budgetType),
        budgetMin: parseOptionalNumber(input.budgetMin),
        budgetMax: parseOptionalNumber(input.budgetMax),
        currency: emptyToNull(input.currency),
        skillsJson: normalizeSkills(input),
        postedAt: parseOptionalDate(input.postedAt),
        assignedToId: input.assignedToId,
        status: input.status ? this.parseStatus(input.status) : LeadStatus.NEW,
      },
      include: leadInclude,
    });
  }

  async update(id: string, input: LeadPayload, actorUserId?: string) {
    const lead = await this.findOne(id);

    const data = this.toLeadData(input);
    if (input.sourceId) {
      const source = await this.prisma.leadSource.findUnique({
        where: { id: input.sourceId },
      });
      if (!source) {
        throw new BadRequestException('Lead source not found');
      }

      data.sourceId = source.id;
      data.sourceName = source.name;
    }

    let nextStatus: LeadStatus | undefined;
    if (input.status) {
      nextStatus = this.parseStatus(input.status);
      data.status = nextStatus;
    }

    if (nextStatus && actorUserId && nextStatus !== lead.status) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.lead.update({
          where: { id },
          data,
          include: leadInclude,
        });

        await tx.crmActivity.create({
          data: {
            leadId: id,
            userId: actorUserId,
            activityType: 'STATUS_CHANGE',
            description: statusChangeDescription(lead.status, nextStatus),
            metadataJson: {
              fromStatus: lead.status,
              toStatus: nextStatus,
              source: 'LEAD_UPDATE',
            },
          },
        });

        return updated;
      });

      if (nextStatus === LeadStatus.CLIENT_REPLIED) {
        await this.followups.cancelPendingForLead(id);
      }

      return updated;
    }

    return this.prisma.lead.update({
      where: { id },
      data,
      include: leadInclude,
    });
  }

  async updateStatus(
    id: string,
    status?: LeadStatus,
    actorRole?: Role,
    actorUserId?: string,
  ) {
    const lead = await this.findOne(id);
    if (!status) {
      throw new BadRequestException('status is required');
    }

    const parsedStatus = this.parseStatus(status);
    if (parsedStatus === LeadStatus.QUALIFIED) {
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

    if (!actorUserId) {
      throw new BadRequestException('Authenticated user is required');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: { status: parsedStatus },
        include: leadInclude,
      });

      if (lead.status !== parsedStatus) {
        await tx.crmActivity.create({
          data: {
            leadId: id,
            userId: actorUserId,
            activityType: 'STATUS_CHANGE',
            description: statusChangeDescription(lead.status, parsedStatus),
            metadataJson: {
              fromStatus: lead.status,
              toStatus: parsedStatus,
              source: 'LEAD_STATUS_ENDPOINT',
            },
          },
        });
      }

      return updated;
    });

    if (parsedStatus === LeadStatus.CLIENT_REPLIED) {
      await this.followups.cancelPendingForLead(id);
    }

    return updated;
  }

  async assign(id: string, assignedToId?: string | null) {
    await this.findOne(id);

    if (assignedToId) {
      const user = await this.prisma.user.findUnique({
        where: { id: assignedToId },
      });
      if (!user) {
        throw new BadRequestException('Assigned user not found');
      }
    }

    return this.prisma.lead.update({
      where: { id },
      data: { assignedToId: assignedToId ?? null },
      include: leadInclude,
    });
  }

  async analyze(id: string, actorUserId: string) {
    const lead = await this.findOne(id);
    const result = await this.aiLeadAnalysis.analyzeLead({
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
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.leadAnalysis.upsert({
        where: { leadId: id },
        update: {
          leadScore: result.lead_score,
          priority: result.priority,
          category: result.category,
          requiredSkillsJson: result.required_skills,
          budgetQuality: result.budget_quality,
          clientSeriousness: result.client_seriousness,
          redFlagsJson: result.red_flags,
          aiSummary: result.ai_summary,
          recommendedAction: result.recommended_action,
        },
        create: {
          leadId: id,
          leadScore: result.lead_score,
          priority: result.priority,
          category: result.category,
          requiredSkillsJson: result.required_skills,
          budgetQuality: result.budget_quality,
          clientSeriousness: result.client_seriousness,
          redFlagsJson: result.red_flags,
          aiSummary: result.ai_summary,
          recommendedAction: result.recommended_action,
        },
      });

      const updated = await tx.lead.update({
        where: { id },
        data: { status: LeadStatus.AI_REVIEWED },
        include: leadInclude,
      });

      if (lead.status !== LeadStatus.AI_REVIEWED) {
        await tx.crmActivity.create({
          data: {
            leadId: id,
            userId: actorUserId,
            activityType: 'STATUS_CHANGE',
            description: statusChangeDescription(
              lead.status,
              LeadStatus.AI_REVIEWED,
            ),
            metadataJson: {
              fromStatus: lead.status,
              toStatus: LeadStatus.AI_REVIEWED,
              source: 'AI_LEAD_ANALYSIS',
            },
          },
        });
      }

      return updated;
    });
  }

  findActivities(id: string) {
    return this.crm.findLeadActivities(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.lead.delete({ where: { id } });
    return { deleted: true };
  }

  private toLeadData(input: LeadPayload): Prisma.LeadUncheckedUpdateInput {
    return {
      externalId: emptyToNull(input.externalId),
      title: input.title,
      description: input.description,
      clientName: emptyToNull(input.clientName),
      clientCountry: emptyToNull(input.clientCountry),
      clientEmail: emptyToNull(input.clientEmail),
      clientProfileUrl: emptyToNull(input.clientProfileUrl),
      projectUrl: emptyToNull(input.projectUrl),
      budgetType: emptyToNull(input.budgetType),
      budgetMin: parseOptionalNumber(input.budgetMin),
      budgetMax: parseOptionalNumber(input.budgetMax),
      currency: emptyToNull(input.currency),
      skillsJson: normalizeSkills(input),
      postedAt: parseOptionalDate(input.postedAt),
      assignedToId:
        input.assignedToId === undefined ? undefined : input.assignedToId,
    };
  }

  private parseStatus(status: LeadStatus) {
    if (!leadStatuses.has(status)) {
      throw new BadRequestException('Invalid lead status');
    }

    return status;
  }
}

function emptyToNull(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalNumber(value?: number | string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new BadRequestException('Invalid number value');
  }

  return parsed;
}

function parseFilterNumber(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new BadRequestException('Invalid number value');
  }

  return parsed;
}

function parseOptionalDate(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid date value');
  }

  return parsed;
}

function parseFilterDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid date value');
  }

  return parsed;
}

function normalizeSkills(input: LeadPayload) {
  if (input.skillsJson !== undefined) {
    return input.skillsJson as Prisma.InputJsonValue;
  }

  if (Array.isArray(input.skills)) {
    return input.skills;
  }

  if (typeof input.skills === 'string') {
    return input.skills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);
  }

  return undefined;
}

function parseStringArray(value: Prisma.JsonValue) {
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
