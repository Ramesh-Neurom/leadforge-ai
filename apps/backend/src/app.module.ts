import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { CrmModule } from './modules/crm/crm.module';
import { EmailModule } from './modules/email/email.module';
import { FollowupsModule } from './modules/followups/followups.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { LeadSourcesModule } from './modules/lead-sources/lead-sources.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number(config.get<string>('REDIS_PORT') ?? 6379),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    ConversationsModule,
    CrmModule,
    EmailModule,
    FollowupsModule,
    InvoicesModule,
    LeadSourcesModule,
    LeadsModule,
    ProposalsModule,
    QuotationsModule,
    UsersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
