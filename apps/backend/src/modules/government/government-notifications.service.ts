import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { openStatuses } from './government.service';
@Injectable()
export class GovernmentNotificationsService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly logger = new Logger(GovernmentNotificationsService.name);
  constructor(private db: PrismaService) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.refresh().catch((e) =>
        this.logger.error(
          e instanceof Error ? e.message : 'Notification refresh failed',
        ),
      );
    }, 3600000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async refresh() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const tenders = await this.db.tender.findMany({
        where: {
          status: { in: openStatuses },
          closesAt: { gte: now, lte: new Date(Date.now() + 7 * 86400000) },
        },
        select: { id: true, title: true, closesAt: true },
      });
      for (const t of tenders) {
        const key = `closing:${t.id}:${t.closesAt!.toISOString()}`;
        await this.db.governmentNotification.upsert({
          where: { key },
          update: {},
          create: {
            key,
            tenderId: t.id,
            message: `Tender closing ${t.closesAt!.toISOString()}: ${t.title}`,
          },
        });
      }
      const docs = await this.db.companyDocument.findMany({
        where: { expiryDate: { lte: new Date(Date.now() + 30 * 86400000) } },
      });
      for (const d of docs) {
        const key = `expiry:${d.id}:${d.expiryDate!.toISOString()}`;
        await this.db.governmentNotification.upsert({
          where: { key },
          update: {},
          create: {
            key,
            message: `Company document expired or expiring: ${d.name} (${d.expiryDate!.toISOString()})`,
          },
        });
      }
    } finally {
      this.running = false;
    }
  }
}
