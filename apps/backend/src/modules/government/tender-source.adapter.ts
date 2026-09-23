import { ServiceUnavailableException } from '@nestjs/common';
import { TenderIntegration } from '@prisma/client';
import { z } from 'zod';
import { sourceConfig, tenderInput } from './government.schemas';

export type TenderCandidate = z.infer<typeof tenderInput>;
export type SourceConfig = z.infer<typeof sourceConfig>;
export interface TenderSourceAdapter {
  test(
    config: SourceConfig,
  ): Promise<{ ok: boolean; automaticDiscovery: boolean; message: string }>;
  search(config: SourceConfig): Promise<TenderCandidate[]>;
  getTenderDetails(
    externalId: string,
    config: SourceConfig,
  ): Promise<TenderCandidate>;
  getDocuments(
    externalId: string,
    config: SourceConfig,
  ): Promise<{ name: string; url: string }[]>;
}
export class ManualTenderSourceAdapter implements TenderSourceAdapter {
  async test(_config: SourceConfig) {
    return {
      ok: true,
      automaticDiscovery: false,
      message:
        'Manual intake available. Enter a bid number, URL or title, then upload tender documents.',
    };
  }
  async search(_config: SourceConfig): Promise<TenderCandidate[]> {
    throw new ServiceUnavailableException(
      'This source accepts manual imports; it does not discover remote listings.',
    );
  }
  async getTenderDetails(
    _id: string,
    _config: SourceConfig,
  ): Promise<TenderCandidate> {
    throw new ServiceUnavailableException('Enter tender details manually.');
  }
  async getDocuments(
    _id: string,
    _config: SourceConfig,
  ): Promise<{ name: string; url: string }[]> {
    throw new ServiceUnavailableException(
      'Upload documents or provide an authorized public document URL.',
    );
  }
}
export class GemTenderSourceAdapter extends ManualTenderSourceAdapter {
  async test(_config: SourceConfig) {
    return {
      ok: true,
      automaticDiscovery: false,
      message:
        process.env.GEM_SYNC_ENABLED === 'true'
          ? 'Automatic discovery unavailable: no supported public interface has been verified. Manual GeM bid, URL and document intake is available.'
          : 'GeM automatic discovery disabled. Manual GeM bid, URL and document intake is available.',
    };
  }
}
export function adapterFor(type: TenderIntegration): TenderSourceAdapter {
  return type === 'GEM_BIDPLUS'
    ? new GemTenderSourceAdapter()
    : new ManualTenderSourceAdapter();
}

export function relevance(
  text: string,
  config: SourceConfig,
  capabilities: { name: string; keywords: string[] }[],
) {
  const lower = text.toLowerCase();
  const includes = (s: string) => lower.includes(s.toLowerCase());
  const software = [
    ...config.keywords,
    ...capabilities.flatMap((c) => [c.name, ...c.keywords]),
  ].filter(includes);
  const hardware = config.hardwareKeywords.filter(includes);
  const excluded = config.excludeKeywords.filter(includes);
  if (software.length && (hardware.length || excluded.length))
    return {
      relevance: 'POSSIBLY_RELEVANT',
      relevanceReason: `Software scope (${software.join(', ')}) with supply/exclusion terms (${[...hardware, ...excluded].join(', ')}). Review separability.`,
    };
  if (software.length)
    return {
      relevance: 'RELEVANT',
      relevanceReason: `Matched configured services: ${software.join(', ')}`,
    };
  if (hardware.length || excluded.length)
    return {
      relevance: 'NOT_RELEVANT',
      relevanceReason: `Product/exclusion terms without configured software scope: ${[...hardware, ...excluded].join(', ')}`,
    };
  return {
    relevance: 'POSSIBLY_RELEVANT',
    relevanceReason: 'Insufficient configured evidence; requires scope review.',
  };
}
