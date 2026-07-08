import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SenderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const conversationInclude = {
  lead: {
    select: {
      id: true,
      title: true,
      clientName: true,
      clientEmail: true,
      sourceName: true,
    },
  },
  messages: {
    orderBy: { createdAt: 'asc' },
  },
} as const;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByLead(leadId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { leadId },
      include: conversationInclude,
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return existing;
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, clientName: true, sourceName: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.prisma.conversation.create({
      data: {
        leadId,
        clientName: lead.clientName,
        source: lead.sourceName,
      },
      include: conversationInclude,
    });
  }

  async addMessageForLead(
    leadId: string,
    input: {
      senderType?: SenderType;
      messageText?: string;
      messageChannel?: string;
      aiSummary?: string;
    },
  ) {
    if (!input.messageText?.trim()) {
      throw new BadRequestException('messageText is required');
    }

    const conversation = await this.findOrCreateByLead(leadId);
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: input.senderType ?? SenderType.MANAGER,
        messageText: input.messageText.trim(),
        messageChannel: input.messageChannel?.trim() || 'MANUAL_NOTE',
        aiSummary: input.aiSummary?.trim() || undefined,
      },
    });

    return this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
      include: conversationInclude,
    });
  }
}
