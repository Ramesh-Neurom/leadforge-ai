import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SenderType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get(':leadId')
  findByLead(@Param('leadId') leadId: string) {
    return this.conversations.findOrCreateByLead(leadId);
  }

  @Post(':leadId/messages')
  addMessage(
    @Param('leadId') leadId: string,
    @Body()
    body: {
      senderType?: SenderType;
      messageText?: string;
      messageChannel?: string;
      aiSummary?: string;
    },
  ) {
    return this.conversations.addMessageForLead(leadId, {
      senderType: body.senderType,
      messageText: body.messageText,
      messageChannel: body.messageChannel,
      aiSummary: body.aiSummary,
    });
  }
}
