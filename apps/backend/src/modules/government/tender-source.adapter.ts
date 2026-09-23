import {
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TenderIntegration } from '@prisma/client';
import { chromium, type Page } from 'playwright';
import { z } from 'zod';

import {
  sourceConfig,
  tenderInput,
} from './government.schemas';

/**
 * Full tender input used by the application when persisting.
 *
 * Note:
 * tenderSourceId belongs to our LeadForge database source,
 * not to GeM itself.
 */
export type TenderCandidate = z.infer<typeof tenderInput>;

export type SourceConfig = z.infer<typeof sourceConfig>;

/**
 * A remote adapter should discover tender information,
 * but it should NOT know our internal TenderSource database ID.
 *
 * The sync service will attach tenderSourceId before persisting.
 */
export type DiscoveredTender = Omit<
  TenderCandidate,
  'tenderSourceId'
>;

export interface TenderSourceAdapter {
  test(
    config: SourceConfig,
  ): Promise<{
    ok: boolean;
    automaticDiscovery: boolean;
    message: string;
  }>;

  search(
    config: SourceConfig,
  ): Promise<DiscoveredTender[]>;

  getTenderDetails(
    externalId: string,
    config: SourceConfig,
  ): Promise<DiscoveredTender>;

  getDocuments(
    externalId: string,
    config: SourceConfig,
  ): Promise<
    {
      name: string;
      url: string;
    }[]
  >;
}

/**
 * Shape extracted from one public GeM bid card.
 */
type GemCardData = {
  bidNumber: string;
  href: string;
  title: string;
  description: string;
  ministry: string | null;
  department: string | null;
  quantity: string | null;
  startDate: string;
  endDate: string;
};

/**
 * GeM displays dates in:
 *
 * 23-09-2026 3:00 PM
 *
 * GeM is an Indian portal, so interpret these values as IST.
 */
function parseGemDate(
  value: string | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  const match = normalized.match(
    /^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i,
  );

  if (!match) {
    return null;
  }

  const [
    ,
    day,
    month,
    year,
    rawHour,
    minute,
    period,
  ] = match;

  let hour = Number(rawHour);

  if (
    period.toUpperCase() === 'PM' &&
    hour !== 12
  ) {
    hour += 12;
  }

  if (
    period.toUpperCase() === 'AM' &&
    hour === 12
  ) {
    hour = 0;
  }

  const hourText = String(hour).padStart(2, '0');

  const iso =
    `${year}-${month}-${day}` +
    `T${hourText}:${minute}:00+05:30`;

  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function positiveIntegerEnv(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.max(
    min,
    Math.min(max, parsed),
  );
}

/**
 * Manual source stays exactly that:
 * user enters tender information or uploads documents.
 */
export class ManualTenderSourceAdapter
  implements TenderSourceAdapter
{
  async test(
    _config: SourceConfig,
  ): Promise<{
    ok: boolean;
    automaticDiscovery: boolean;
    message: string;
  }> {
    return {
      ok: true,
      automaticDiscovery: false,
      message:
        'Manual intake available. Enter a bid number, URL or title, then upload tender documents.',
    };
  }

  async search(
    _config: SourceConfig,
  ): Promise<DiscoveredTender[]> {
    throw new ServiceUnavailableException(
      'This source accepts manual imports; it does not discover remote listings.',
    );
  }

  async getTenderDetails(
    _id: string,
    _config: SourceConfig,
  ): Promise<DiscoveredTender> {
    throw new ServiceUnavailableException(
      'Enter tender details manually.',
    );
  }

  async getDocuments(
    _id: string,
    _config: SourceConfig,
  ): Promise<
    {
      name: string;
      url: string;
    }[]
  > {
    throw new ServiceUnavailableException(
      'Upload documents or provide an authorized public document URL.',
    );
  }
}

/**
 * GeM public BidPlus collector.
 *
 * Important:
 *
 * - Uses only the public unauthenticated BidPlus webpage.
 * - Does not log in.
 * - Does not bypass CAPTCHA.
 * - Does not bypass 403/429.
 * - Does not use seller credentials.
 * - Does not submit bids.
 * - Does not directly reproduce/private-call GeM's internal AJAX API.
 *
 * Playwright renders the normal public page and we read the
 * publicly displayed bid cards.
 */
export class GemTenderSourceAdapter
  implements TenderSourceAdapter
{
  private readonly listingUrl =
    'https://bidplus.gem.gov.in/all-bids';

  private readonly baseUrl =
    'https://bidplus.gem.gov.in';

  /**
   * Check whether GeM has presented any access-control condition.
   */
  private async assertPublicAccess(
    page: Page,
  ): Promise<void> {
    const currentUrl = page.url();

    if (
      currentUrl.includes('/oauth/login') ||
      currentUrl.includes('/doLogin') ||
      currentUrl.includes('sso.gem.gov.in')
    ) {
      throw new ServiceUnavailableException(
        'GeM redirected the public listing to authentication. Automatic discovery stopped.',
      );
    }

    const bodyText = await page
      .locator('body')
      .innerText()
      .catch(() => '');

    if (
      /captcha/i.test(bodyText) ||
      /verify\s+you\s+are\s+human/i.test(
        bodyText,
      ) ||
      /human\s+verification/i.test(
        bodyText,
      )
    ) {
      throw new ServiceUnavailableException(
        'GeM requires human verification. Automatic discovery stopped.',
      );
    }
  }

  /**
   * Wait until the public bid cards are rendered.
   */
  private async waitForBidCards(
    page: Page,
  ): Promise<void> {
    await page
      .locator('#bidCard')
      .waitFor({
        state: 'visible',
        timeout: 30_000,
      });

    await page
      .locator('#bidCard .card')
      .first()
      .waitFor({
        state: 'visible',
        timeout: 30_000,
      });
  }

  /**
   * GeM refreshes listings through page-side JavaScript.
   *
   * We do not call that endpoint ourselves.
   * We only wait for the normal public page action to finish.
   */
  private async waitForListingRefresh(
    page: Page,
    action: () => Promise<void>,
  ): Promise<void> {
    const previousBid = await page
      .locator(
        '#bidCard .card a.bid_no_hover',
      )
      .first()
      .textContent()
      .catch(() => null);

    const ajaxPromise = page
      .waitForResponse(
        (response) =>
          response
            .url()
            .includes('/all-bids-data') &&
          response.request().method() ===
            'POST',
        {
          timeout: 20_000,
        },
      )
      .catch(() => null);

    await action();

    await ajaxPromise;

    await page
      .locator('#bidCard')
      .waitFor({
        state: 'visible',
        timeout: 30_000,
      });

    await page
      .locator('#bidCard .card')
      .first()
      .waitFor({
        state: 'visible',
        timeout: 30_000,
      });

    /**
     * Wait briefly for the actual card text to change.
     *
     * This is best-effort only because the same bid can
     * theoretically remain first after a filter change.
     */
    if (previousBid) {
      await page
        .waitForFunction(
          (oldBid) => {
            const element =
              document.querySelector(
                '#bidCard .card a.bid_no_hover',
              );

            const current =
              element?.textContent?.trim();

            return (
              Boolean(current) &&
              current !== oldBid
            );
          },
          previousBid.trim(),
          {
            timeout: 5_000,
          },
        )
        .catch(() => undefined);
    }
  }

  /**
   * Convert rendered GeM cards into plain JS objects.
   */
  private async extractCards(
    page: Page,
  ): Promise<GemCardData[]> {
    const result = await page
      .locator('#bidCard .card')
      .evaluateAll((cards) => {
        return cards.map((card) => {
          const bidLink =
            card.querySelector<HTMLAnchorElement>(
              'a.bid_no_hover',
            );

          const itemColumn =
            card.querySelector<HTMLElement>(
              '.card-body .col-md-4',
            );

          const itemRows =
            itemColumn?.querySelectorAll<HTMLElement>(
              '.row',
            );

          const itemRow =
            itemRows?.[0] ?? null;

          const quantityRow =
            itemRows?.[1] ?? null;

          const itemAnchor =
            itemRow?.querySelector<HTMLElement>(
              'a[data-content]',
            );

          const fullItems =
            itemAnchor
              ?.getAttribute('data-content')
              ?.trim() ||
            itemRow?.innerText
              .replace(/^Items:\s*/i, '')
              .trim() ||
            '';

          const boqTitle =
            itemAnchor
              ?.getAttribute(
                'data-original-title',
              )
              ?.trim() || '';

          const title =
            boqTitle ||
            fullItems ||
            bidLink?.innerText.trim() ||
            'GeM Tender';

          let description = fullItems;

          if (
            boqTitle &&
            fullItems &&
            boqTitle !== fullItems
          ) {
            description =
              `${boqTitle}\n\nItems: ${fullItems}`;
          }

          if (!description) {
            description = title;
          }

          const quantity =
            quantityRow?.innerText
              .replace(/^Quantity:\s*/i, '')
              .trim() || null;

          const organizationColumn =
            card.querySelector<HTMLElement>(
              '.card-body .col-md-5',
            );

          const organizationRows =
            organizationColumn?.querySelectorAll<HTMLElement>(
              '.row',
            );

          const organizationText =
            organizationRows?.[1]?.innerText ??
            '';

          const organizationLines =
            organizationText
              .split('\n')
              .map((value) =>
                value.trim(),
              )
              .filter(Boolean);

          const ministry =
            organizationLines[0] ?? null;

          const department =
            organizationLines
              .slice(1)
              .join(' ')
              .trim() || null;

          const startDate =
            card.querySelector<HTMLElement>(
              '.start_date',
            )?.innerText ?? '';

          const endDate =
            card.querySelector<HTMLElement>(
              '.end_date',
            )?.innerText ?? '';

          return {
            bidNumber:
              bidLink?.innerText.trim() ?? '',
            href: bidLink?.href ?? '',
            title,
            description,
            ministry,
            department,
            quantity,
            startDate,
            endDate,
          };
        });
      });

    return result as GemCardData[];
  }

  /**
   * Convert one GeM public card into the LeadForge
   * normalized tender format.
   */
  private normalizeCard(
    row: GemCardData,
    tenderType: string | null = 'SERVICE',
  ): DiscoveredTender {
    const extraDescription = row.quantity
      ? `${row.description}\n\nQuantity: ${row.quantity}`
      : row.description;

    return {
      /**
       * GeM bid number is stable and is the correct
       * remote identifier for deduplication.
       */
      externalId: row.bidNumber,

      bidNumber: row.bidNumber,

      title: row.title,

      description: extraDescription,

      buyerName:
        row.department ??
        row.ministry ??
        null,

      ministry: row.ministry,

      department: row.department,

      state: null,

      locationText: null,

      serviceCategory:
        tenderType === 'SERVICE'
          ? 'GeM Service Bid'
          : null,

      tenderType,

      estimatedValue: null,

      currency: 'INR',

      publishedAt: parseGemDate(
        row.startDate,
      ),

      closesAt: parseGemDate(
        row.endDate,
      ),

      emdAmount: null,

      emdRequired: null,

      msePreference: null,

      startupPreference: null,

      contractDuration: null,

      scopeOfWork: row.description,

      sourceUrl:
        row.href.startsWith('https://')
          ? row.href
          : `${this.baseUrl}${row.href}`,
    };
  }

  /**
   * Apply the public "Service Bid/RAs" filter.
   */
  private async enableServiceFilter(
    page: Page,
  ): Promise<void> {
    const serviceCheckbox =
      page.locator('#service');

    if (
      (await serviceCheckbox.count()) === 0
    ) {
      return;
    }

    const checked =
      await serviceCheckbox.isChecked();

    if (checked) {
      return;
    }

    await this.waitForListingRefresh(
      page,
      async () => {
        await serviceCheckbox.click();
      },
    );
  }

  /**
   * Prefer latest-created/start-date bids.
   *
   * Otherwise GeM defaults to oldest closing first,
   * which is not ideal for opportunity discovery.
   */
  private async sortLatestFirst(
    page: Page,
  ): Promise<void> {
    const latestOption = page.locator(
      '#Bid-Start-Date-Latest',
    );

    if (
      (await latestOption.count()) === 0
    ) {
      return;
    }

    await this.waitForListingRefresh(
      page,
      async () => {
        const sortButton = page.locator('#currentSort');
        if (
          (await sortButton.count()) > 0 &&
          (await sortButton.isVisible())
        ) {
          await sortButton.click();
          await page.waitForTimeout(300);
        }

        if (await latestOption.isVisible()) {
          await latestOption.click();
        } else {
          await page.evaluate(() => {
            const link = document.getElementById(
              'Bid-Start-Date-Latest',
            );
            if (link) {
              link.click();
            } else if (
              typeof (window as any).sort ===
              'function'
            ) {
              (window as any).sort(
                'Bid-Start-Date-Latest',
              );
            }
          });
        }
      },
    );
  }

  /**
   * Test that the public rendered listing can actually
   * be discovered.
   */
  async test(
    _config: SourceConfig,
  ): Promise<{
    ok: boolean;
    automaticDiscovery: boolean;
    message: string;
  }> {
    if (
      process.env.GEM_SYNC_ENABLED !==
      'true'
    ) {
      return {
        ok: true,
        automaticDiscovery: false,
        message:
          'GeM automatic discovery disabled. Manual intake remains available.',
      };
    }

    const browser = await chromium.launch({
      headless: true,
    });

    try {
      const page = await browser.newPage({
        viewport: {
          width: 1440,
          height: 1200,
        },
      });

      const response = await page.goto(
        this.listingUrl,
        {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        },
      );

      if (!response) {
        return {
          ok: false,
          automaticDiscovery: false,
          message:
            'GeM returned no HTTP response.',
        };
      }

      if (
        response.status() === 403 ||
        response.status() === 429
      ) {
        return {
          ok: false,
          automaticDiscovery: false,
          message:
            `GeM public listing returned HTTP ${response.status()}.`,
        };
      }

      if (!response.ok()) {
        return {
          ok: false,
          automaticDiscovery: false,
          message:
            `GeM public listing returned HTTP ${response.status()}.`,
        };
      }

      await this.assertPublicAccess(page);

      await this.waitForBidCards(page);

      await this.enableServiceFilter(page);

      await this.assertPublicAccess(page);

      const count = await page
        .locator('#bidCard .card')
        .count();

      if (count === 0) {
        return {
          ok: false,
          automaticDiscovery: false,
          message:
            'GeM public listing loaded, but no bid cards were discovered.',
        };
      }

      return {
        ok: true,
        automaticDiscovery: true,
        message:
          `GeM public discovery available. ` +
          `Found ${count} service bids on the current page.`,
      };
    } catch (error) {
      return {
        ok: false,
        automaticDiscovery: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to read GeM public listing.',
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Discover public GeM service tenders.
   */
  async search(
    _config: SourceConfig,
  ): Promise<DiscoveredTender[]> {
    if (
      process.env.GEM_SYNC_ENABLED !==
      'true'
    ) {
      throw new ServiceUnavailableException(
        'GeM automatic discovery is disabled.',
      );
    }

    const maxPages =
      positiveIntegerEnv(
        process.env
          .GEM_MAX_PAGES_PER_SYNC,
        5,
        1,
        25,
      );

    const requestDelayMs =
      positiveIntegerEnv(
        process.env
          .GEM_REQUEST_DELAY_MS,
        3000,
        1000,
        60_000,
      );

    const browser = await chromium.launch({
      headless: true,
    });

    /**
     * Map prevents the same GeM bid from being returned twice.
     */
    const discovered = new Map<
      string,
      DiscoveredTender
    >();

    try {
      const page = await browser.newPage({
        viewport: {
          width: 1440,
          height: 1200,
        },
      });

      const response = await page.goto(
        this.listingUrl,
        {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        },
      );

      if (!response) {
        throw new ServiceUnavailableException(
          'GeM returned no HTTP response.',
        );
      }

      if (
        response.status() === 403 ||
        response.status() === 429
      ) {
        throw new ServiceUnavailableException(
          `GeM public listing returned HTTP ${response.status()}. Automatic discovery stopped.`,
        );
      }

      if (!response.ok()) {
        throw new ServiceUnavailableException(
          `GeM public listing returned HTTP ${response.status()}.`,
        );
      }

      await this.assertPublicAccess(page);

      await this.waitForBidCards(page);

      /**
       * We are a software/service company,
       * so reduce irrelevant product procurement first.
       */
      await this.enableServiceFilter(page);

      /**
       * Fetch newer opportunities first.
       */
      await this.sortLatestFirst(page);

      for (
        let pageIndex = 1;
        pageIndex <= maxPages;
        pageIndex += 1
      ) {
        await this.assertPublicAccess(page);

        await this.waitForBidCards(page);

        const rows =
          await this.extractCards(page);

        for (const row of rows) {
          if (!row.bidNumber) {
            continue;
          }

          const tender =
            this.normalizeCard(
              row,
              'SERVICE',
            );

          discovered.set(
            row.bidNumber,
            tender,
          );
        }

        /**
         * Stop after configured number of pages.
         */
        if (pageIndex >= maxPages) {
          break;
        }

        /**
         * Use GeM's normal public pagination.
         */
        const nextLink = page
          .locator(
            '#light-pagination a.page-link.next',
          )
          .first();

        if (
          (await nextLink.count()) === 0
        ) {
          break;
        }

        const isVisible =
          await nextLink.isVisible();

        if (!isVisible) {
          break;
        }

        await this.waitForListingRefresh(
          page,
          async () => {
            await nextLink.click();
          },
        );

        await page.waitForTimeout(
          requestDelayMs,
        );
      }

      return Array.from(
        discovered.values(),
      );
    } finally {
      await browser.close();
    }
  }

  /**
   * Search the public page by GeM bid number.
   *
   * This returns the public summary record.
   */
  async getTenderDetails(
    externalId: string,
    _config: SourceConfig,
  ): Promise<DiscoveredTender> {
    if (
      process.env.GEM_SYNC_ENABLED !==
      'true'
    ) {
      throw new ServiceUnavailableException(
        'GeM automatic discovery is disabled.',
      );
    }

    const browser = await chromium.launch({
      headless: true,
    });

    try {
      const page = await browser.newPage({
        viewport: {
          width: 1440,
          height: 1200,
        },
      });

      const response = await page.goto(
        this.listingUrl,
        {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        },
      );

      if (!response) {
        throw new ServiceUnavailableException(
          'GeM returned no HTTP response.',
        );
      }

      if (
        response.status() === 403 ||
        response.status() === 429
      ) {
        throw new ServiceUnavailableException(
          `GeM returned HTTP ${response.status()}.`,
        );
      }

      await this.assertPublicAccess(page);

      await this.waitForBidCards(page);

      const searchInput =
        page.locator('#searchBid');

      const searchButton =
        page.locator('#searchBidRA');

      if (
        (await searchInput.count()) ===
          0 ||
        (await searchButton.count()) ===
          0
      ) {
        throw new ServiceUnavailableException(
          'GeM public bid search controls were not found.',
        );
      }

      await searchInput.fill(externalId);

      await this.waitForListingRefresh(
        page,
        async () => {
          await searchButton.click();
        },
      );

      await this.assertPublicAccess(page);

      const rows =
        await this.extractCards(page);

      const exact = rows.find(
        (row) =>
          row.bidNumber
            .trim()
            .toLowerCase() ===
          externalId
            .trim()
            .toLowerCase(),
      );

      if (!exact) {
        throw new NotFoundException(
          `GeM bid ${externalId} was not found in the public listing.`,
        );
      }

      return this.normalizeCard(
        exact,
        null,
      );
    } finally {
      await browser.close();
    }
  }

  /**
   * GeM's public bid number link is the public bid document/details URL.
   *
   * We expose it to the existing TenderDocument ingestion flow.
   */
  async getDocuments(
    externalId: string,
    config: SourceConfig,
  ): Promise<
    {
      name: string;
      url: string;
    }[]
  > {
    const tender =
      await this.getTenderDetails(
        externalId,
        config,
      );

    if (!tender.sourceUrl) {
      return [];
    }

    return [
      {
        name:
          `${externalId} - GeM Bid Document`,
        url: tender.sourceUrl,
      },
    ];
  }
}

/**
 * Adapter resolver.
 */
export function adapterFor(
  type: TenderIntegration,
): TenderSourceAdapter {
  return type ===
    TenderIntegration.GEM_BIDPLUS
    ? new GemTenderSourceAdapter()
    : new ManualTenderSourceAdapter();
}

/**
 * Existing LeadForge relevance engine.
 *
 * Keep this source-agnostic.
 */
export function relevance(
  text: string,
  config: SourceConfig,
  capabilities: {
    name: string;
    keywords: string[];
  }[],
) {
  const lower = text.toLowerCase();

  const includes = (
    value: string,
  ) =>
    lower.includes(
      value.toLowerCase(),
    );

  const software = [
    ...config.keywords,

    ...capabilities.flatMap(
      (capability) => [
        capability.name,
        ...capability.keywords,
      ],
    ),
  ].filter(includes);

  const hardware =
    config.hardwareKeywords.filter(
      includes,
    );

  const excluded =
    config.excludeKeywords.filter(
      includes,
    );

  if (
    software.length &&
    (hardware.length ||
      excluded.length)
  ) {
    return {
      relevance:
        'POSSIBLY_RELEVANT',

      relevanceReason:
        `Software scope (${software.join(
          ', ',
        )}) with supply/exclusion terms (` +
        `${[
          ...hardware,
          ...excluded,
        ].join(
          ', ',
        )}). Review separability.`,
    };
  }

  if (software.length) {
    return {
      relevance: 'RELEVANT',

      relevanceReason:
        `Matched configured services: ${software.join(
          ', ',
        )}`,
    };
  }

  if (
    hardware.length ||
    excluded.length
  ) {
    return {
      relevance:
        'NOT_RELEVANT',

      relevanceReason:
        `Product/exclusion terms without configured software scope: ${[
          ...hardware,
          ...excluded,
        ].join(', ')}`,
    };
  }

  return {
    relevance:
      'POSSIBLY_RELEVANT',

    relevanceReason:
      'Insufficient configured evidence; requires scope review.',
  };
}