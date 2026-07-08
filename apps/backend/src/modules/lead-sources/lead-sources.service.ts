import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadSource, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const REMOTEOK_API_URL = 'https://remoteok.com/api';
const WWR_PROGRAMMING_RSS =
  'https://weworkremotely.com/categories/remote-programming-jobs.rss';

const restrictedSources = new Set([
  'UPWORK',
  'LINKEDIN',
  'FIVERR',
  'INDEED',
  'UPWORK_GMAIL_ALERTS',
  'LINKEDIN_GMAIL_ALERTS',
  'FIVERR_GMAIL_ALERTS',
  'INDEED_GMAIL_ALERTS',
]);

export interface LeadSourcePayload {
  name?: string;
  type?: string;
  integrationType?: string;
  status?: string;
  configJson?: unknown;
}

export interface NormalizedLead {
  externalId?: string | null;
  title: string;
  description: string;
  clientName?: string | null;
  clientCountry?: string | null;
  projectUrl?: string | null;
  skillsJson?: string[];
  postedAt?: Date | null;
}

@Injectable()
export class LeadSourcesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.leadSource.findMany({ orderBy: { name: 'asc' } });
  }

  create(input: LeadSourcePayload) {
    if (!input.name || !input.integrationType) {
      throw new BadRequestException('name and integrationType are required');
    }

    return this.prisma.leadSource.create({
      data: {
        name: input.name.trim(),
        type: normalizeText(input.type) ?? defaultType(input.integrationType),
        integrationType: input.integrationType.trim().toUpperCase(),
        status: normalizeText(input.status) ?? 'ACTIVE',
        configJson: toInputJson(input.configJson),
      },
    });
  }

  async update(id: string, input: LeadSourcePayload) {
    await this.findSource(id);

    return this.prisma.leadSource.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        type: normalizeText(input.type),
        integrationType: input.integrationType?.trim().toUpperCase(),
        status: normalizeText(input.status),
        configJson:
          input.configJson === undefined
            ? undefined
            : toInputJson(input.configJson),
      },
    });
  }

  async test(id: string) {
    const source = await this.findSource(id);
    const fetched = await this.fetchFromSource(source, 5);
    const message = `Connection ok. Found ${fetched.length} candidate leads.`;

    await this.updateSyncState(source.id, 'TEST_OK', message);

    return {
      ok: true,
      message,
      sample: fetched.slice(0, 3),
    };
  }

  async sync(id: string) {
    const source = await this.findSource(id);

    try {
      const fetched = await this.fetchFromSource(source);
      let imported = 0;
      let skipped = 0;
      const leads = [];

      for (const item of fetched) {
        const duplicate = await this.findDuplicate(source.name, item);
        if (duplicate) {
          skipped += 1;
          continue;
        }

        const lead = await this.prisma.lead.create({
          data: {
            sourceId: source.id,
            sourceName: source.name,
            externalId: item.externalId ?? null,
            title: item.title,
            description: item.description,
            clientName: item.clientName ?? null,
            clientCountry: item.clientCountry ?? null,
            projectUrl: item.projectUrl ?? null,
            skillsJson: item.skillsJson ?? [],
            postedAt: item.postedAt ?? null,
            status: LeadStatus.NEW,
          },
        });

        imported += 1;
        leads.push(lead);
      }

      const message = `Imported ${imported}, skipped ${skipped}, checked ${fetched.length}.`;
      await this.updateSyncState(source.id, 'SYNC_OK', message);

      return {
        imported,
        skipped,
        total: fetched.length,
        queuedForAnalysis: false,
        message,
        leads,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Lead source sync failed';
      await this.updateSyncState(source.id, 'SYNC_FAILED', message);
      throw error;
    }
  }

  private async findSource(id: string) {
    const source = await this.prisma.leadSource.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundException('Lead source not found');
    }

    return source;
  }

  private async fetchFromSource(
    source: LeadSource,
    limit?: number,
  ): Promise<NormalizedLead[]> {
    const integrationType = source.integrationType.toUpperCase();
    const config = configObject(source.configJson);

    if (restrictedSources.has(integrationType)) {
      return this.fetchRestrictedPlaceholder(source.name, integrationType);
    }

    switch (integrationType) {
      case 'MANUAL':
        return parseManualLeads(config).slice(0, limit);
      case 'GENERIC_RSS':
        return this.fetchRssFeed(
          source.name,
          requiredString(config, 'feedUrl'),
          limit,
        );
      case 'REMOTEOK':
        return this.fetchRemoteOk(limit);
      case 'WE_WORK_REMOTELY_RSS':
        return this.fetchRssFeed(
          source.name,
          optionalString(config.feedUrl) ?? WWR_PROGRAMMING_RSS,
          limit,
        );
      case 'FREELANCER_API':
        return this.fetchFreelancerPlaceholder(config);
      default:
        throw new BadRequestException(
          `Unsupported integrationType: ${source.integrationType}`,
        );
    }
  }

  private fetchRestrictedPlaceholder(
    sourceName: string,
    integrationType: string,
  ): never {
    throw new BadRequestException(
      `${sourceName} direct scraping is not supported. Configure a future Gmail alert parser source instead (${integrationType}).`,
    );
  }

  private fetchFreelancerPlaceholder(config: SourceConfig) {
    if (!optionalString(config.apiKey) && !optionalString(config.clientId)) {
      throw new BadRequestException(
        'Freelancer API placeholder requires apiKey or clientId in configJson.',
      );
    }

    return [];
  }

  private async fetchRssFeed(
    sourceName: string,
    feedUrl: string,
    limit?: number,
  ) {
    assertHttpUrl(feedUrl);
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'AIProjectHunter/1.0 lead-source-rss' },
    });

    if (!response.ok) {
      throw new BadRequestException(
        `RSS request failed with ${response.status} ${response.statusText}`,
      );
    }

    const xml = await response.text();
    return parseFeedItems(xml, sourceName).slice(0, limit);
  }

  private async fetchRemoteOk(limit?: number) {
    const response = await fetch(REMOTEOK_API_URL, {
      headers: { 'User-Agent': 'AIProjectHunter/1.0 lead-source-remoteok' },
    });

    if (!response.ok) {
      throw new BadRequestException(
        `RemoteOK request failed with ${response.status} ${response.statusText}`,
      );
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      throw new BadRequestException('RemoteOK response format is invalid');
    }

    return payload
      .filter(isObject)
      .filter(
        (item) => optionalString(item.position) || optionalString(item.title),
      )
      .map((item): NormalizedLead => {
        const id = optionalString(item.id) ?? optionalString(item.slug);
        const title =
          optionalString(item.position) ??
          optionalString(item.title) ??
          'RemoteOK job';
        const url =
          optionalString(item.url) ??
          (id ? `https://remoteok.com/remote-jobs/${id}` : undefined);

        return {
          externalId: id ?? url ?? title,
          title,
          description:
            stripHtml(optionalString(item.description) ?? '') ||
            'RemoteOK job lead imported from public API.',
          clientName: optionalString(item.company),
          clientCountry: optionalString(item.location),
          projectUrl: url,
          skillsJson: parseTags(item.tags),
          postedAt: parseDate(optionalString(item.date)),
        };
      })
      .slice(0, limit);
  }

  private async findDuplicate(sourceName: string, item: NormalizedLead) {
    const clauses: Prisma.LeadWhereInput[] = [];

    if (item.externalId) {
      clauses.push({ sourceName, externalId: item.externalId });
    }

    if (item.projectUrl) {
      clauses.push({ projectUrl: item.projectUrl });
    }

    if (!clauses.length) {
      clauses.push({ sourceName, title: item.title });
    }

    return this.prisma.lead.findFirst({ where: { OR: clauses } });
  }

  private updateSyncState(id: string, status: string, message: string) {
    return this.prisma.leadSource.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncMessage: message,
      },
    });
  }
}

type SourceConfig = Record<string, unknown>;

function configObject(
  value: Prisma.JsonValue | null | undefined,
): SourceConfig {
  return isObject(value) ? value : {};
}

function toInputJson(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function defaultType(integrationType: string) {
  const normalized = integrationType.trim().toUpperCase();
  if (normalized.includes('RSS')) {
    return 'RSS';
  }

  if (normalized === 'REMOTEOK' || normalized === 'FREELANCER_API') {
    return 'JOB_BOARD';
  }

  return 'DIRECT';
}

function normalizeText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function requiredString(config: SourceConfig, key: string) {
  const value = optionalString(config[key]);
  if (!value) {
    throw new BadRequestException(`${key} is required in configJson`);
  }

  return value;
}

function optionalString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
}

function parseManualLeads(config: SourceConfig) {
  const leads = Array.isArray(config.manualLeads) ? config.manualLeads : [];
  return leads.filter(isObject).map((item): NormalizedLead => {
    const title = optionalString(item.title);
    const description = optionalString(item.description);
    if (!title || !description) {
      throw new BadRequestException(
        'Manual source leads require title and description.',
      );
    }

    return {
      externalId: optionalString(item.externalId),
      title,
      description,
      clientName: optionalString(item.clientName),
      clientCountry: optionalString(item.clientCountry),
      projectUrl: optionalString(item.projectUrl),
      skillsJson: parseTags(item.skills),
      postedAt: parseDate(optionalString(item.postedAt)),
    };
  });
}

function parseFeedItems(xml: string, sourceName: string) {
  const itemMatches = Array.from(
    xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi),
  ).map((match) => match[0]);

  return itemMatches.map((item, index): NormalizedLead => {
    const title =
      firstTag(item, ['title']) ?? `${sourceName} lead ${index + 1}`;
    const link = firstLink(item);
    const description =
      stripHtml(firstTag(item, ['description', 'summary', 'content']) ?? '') ||
      'Lead imported from RSS feed.';

    return {
      externalId: firstTag(item, ['guid', 'id']) ?? link ?? title,
      title,
      description,
      clientName: sourceName,
      projectUrl: link,
      skillsJson: inferSkills(`${title} ${description}`),
      postedAt: parseDate(firstTag(item, ['pubDate', 'published', 'updated'])),
    };
  });
}

function firstTag(xml: string, names: string[]) {
  for (const name of names) {
    const match = xml.match(
      new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'),
    );
    if (match?.[1]) {
      return decodeXml(stripCdata(match[1])).trim() || undefined;
    }
  }

  return undefined;
}

function firstLink(xml: string) {
  const href = xml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1];
  if (href) {
    return decodeXml(href).trim();
  }

  return firstTag(xml, ['link']);
}

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value: string) {
  return decodeXml(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => optionalString(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function inferSkills(text: string) {
  const skillKeywords = [
    'React',
    'Next.js',
    'Node.js',
    'NestJS',
    'TypeScript',
    'JavaScript',
    'Python',
    'AI',
    'Machine Learning',
    'React Native',
    'Flutter',
    'Kotlin',
    'Swift',
    'DevOps',
    'AWS',
    'API',
  ];
  const lower = text.toLowerCase();
  return skillKeywords.filter((skill) => lower.includes(skill.toLowerCase()));
}

function assertHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new BadRequestException('A valid http(s) feedUrl is required');
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
