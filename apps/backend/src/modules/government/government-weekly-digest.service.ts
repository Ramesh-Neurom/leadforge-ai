import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { EmailProvider } from '../email/email.provider';
import { GovernmentService } from './government.service';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const CHECK_MS = 15 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ROWS = 50;

export type DigestTender = {
  id: string;
  bidNumber: string | null;
  title: string;
  buyerName: string | null;
  department: string | null;
  ministry: string | null;
  closesAt: Date | null;
  relevanceReason: string | null;
  sourceUrl: string | null;
};

export function istNow(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** YYYY-MM-DD of this week's Monday in India. */
export function weekMondayKey(date = new Date()) {
  const ist = istNow(date);
  const daysFromMonday = (ist.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(
      ist.getUTCFullYear(),
      ist.getUTCMonth(),
      ist.getUTCDate() - daysFromMonday,
    ),
  );
  return monday.toISOString().slice(0, 10);
}

/** True from Monday 08:00 IST through Sunday (covers a missed 8am run). */
export function digestWindowOpen(date = new Date()) {
  const ist = istNow(date);
  if (ist.getUTCDay() === 1) return ist.getUTCHours() >= 8;
  return true;
}

export function parseRecipients(value: string | undefined) {
  return (value ?? '')
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.includes('@'));
}

export function formatDigestText(
  weekKey: string,
  tenders: DigestTender[],
  syncNotes: string[],
) {
  const lines = [
    `Weekly government tenders matching our services (week of ${weekKey} IST).`,
    'If a bid looks useful, open the official link or search the bid number on GeM, read the PDF, then bid there yourself.',
    '',
  ];
  if (syncNotes.length) {
    lines.push('Source sync:', ...syncNotes.map((note) => `- ${note}`), '');
  }
  if (!tenders.length) {
    lines.push('No new matching tenders this week.');
    return lines.join('\n');
  }
  lines.push(`New matching tenders: ${tenders.length}`, '');
  tenders.forEach((tender, index) => {
    const buyer =
      tender.buyerName || tender.department || tender.ministry || 'Not listed';
    const closes = tender.closesAt
      ? tender.closesAt.toISOString().slice(0, 10)
      : 'Not listed';
    lines.push(
      `${index + 1}. Bid number: ${tender.bidNumber || 'Not listed'}`,
      `   Title: ${tender.title}`,
      `   Buyer: ${buyer}`,
      `   Last date: ${closes}`,
      `   Match: ${tender.relevanceReason || 'Configured services'}`,
      `   Official page: ${tender.sourceUrl || 'Search this bid number on GeM'}`,
      '',
    );
  });
  return lines.join('\n');
}

@Injectable()
export class GovernmentWeeklyDigestService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly logger = new Logger(GovernmentWeeklyDigestService.name);

  constructor(
    private db: PrismaService,
    private government: GovernmentService,
    private email: EmailProvider,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick().catch((error) =>
        this.logger.error(
          error instanceof Error ? error.message : 'Weekly digest failed',
        ),
      );
    }, CHECK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  enabled() {
    return this.config.get<string>('GOVT_DIGEST_ENABLED') === 'true';
  }

  async tick() {
    if (!this.enabled() || !digestWindowOpen() || this.running) return;
    await this.run(false);
  }

  async run(force: boolean) {
    if (this.running) return { sent: false, reason: 'already-running' };
    const recipients = parseRecipients(
      this.config.get<string>('GOVT_DIGEST_TO'),
    );
    if (!recipients.length) {
      this.logger.warn('GOVT_DIGEST_TO is empty; weekly digest skipped');
      return { sent: false, reason: 'no-recipients' };
    }

    const weekKey = weekMondayKey();
    const digestKey = `weekly-digest:${weekKey}`;
    if (!force) {
      const existing = await this.db.governmentNotification.findUnique({
        where: { key: digestKey },
      });
      if (existing) return { sent: false, reason: 'already-sent', weekKey };
    }

    this.running = true;
    try {
      const syncNotes = await this.syncSources();
      const since = new Date(Date.now() - WEEK_MS);
      const mailed = await this.db.governmentNotification.findMany({
        where: { key: { startsWith: 'digest-mailed:' } },
        select: { tenderId: true },
      });
      const mailedIds = mailed
        .map((row) => row.tenderId)
        .filter((id): id is string => Boolean(id));

      const tenders = await this.db.tender.findMany({
        where: {
          relevance: 'RELEVANT',
          createdAt: { gte: since },
          id: mailedIds.length ? { notIn: mailedIds } : undefined,
        },
        orderBy: [{ closesAt: 'asc' }, { createdAt: 'desc' }],
        take: MAX_ROWS,
        select: {
          id: true,
          bidNumber: true,
          title: true,
          buyerName: true,
          department: true,
          ministry: true,
          closesAt: true,
          relevanceReason: true,
          sourceUrl: true,
        },
      });

      const text = formatDigestText(weekKey, tenders, syncNotes);
      await this.email.send({
        to: recipients,
        subject: `Weekly government tenders — ${weekKey}`,
        text,
      });

      await this.db.governmentNotification.upsert({
        where: { key: digestKey },
        update: { message: text },
        create: { key: digestKey, message: text },
      });
      for (const tender of tenders) {
        const key = `digest-mailed:${tender.id}`;
        await this.db.governmentNotification.upsert({
          where: { key },
          update: {},
          create: {
            key,
            tenderId: tender.id,
            message: `Included in weekly digest ${weekKey}`,
          },
        });
      }

      this.logger.log(
        `Weekly digest sent to ${recipients.length} recipient(s); ${tenders.length} tender(s)`,
      );
      return { sent: true, weekKey, count: tenders.length };
    } finally {
      this.running = false;
    }
  }

  private async syncSources() {
    if (this.config.get<string>('GOVT_TENDER_SYNC_ENABLED') !== 'true') {
      return ['Automatic source sync is off; listing uses tenders already stored.'];
    }
    const sources = await this.db.tenderSource.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    const notes: string[] = [];
    for (const source of sources) {
      try {
        const result = await this.government.syncSource(source.id);
        notes.push(`${source.name}: ${result.message}`);
      } catch (error) {
        notes.push(
          `${source.name}: ${error instanceof Error ? error.message : 'sync failed'}`,
        );
      }
    }
    return notes;
  }
}
