import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  analysisOutput,
  parse,
  sourceConfig,
  tenderInput,
  listInput,
} from './government.schemas';
import { relevance, GemTenderSourceAdapter } from './tender-source.adapter';
import {
  publicIpv4,
  validateFile,
  downloadPublic,
} from './tender-document.service';
import { assertReady } from './bid-workspace.service';
import {
  digestWindowOpen,
  formatDigestText,
  parseRecipients,
  weekMondayKey,
} from './government-weekly-digest.service';

async function main() {
  const source = JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        '../../../../..',
        'docs/government-source-config.json',
      ),
      'utf8',
    ),
  ) as { configJson: unknown };
  const config = parse(sourceConfig, source.configJson);
  for (const title of ['Supply of laptops', 'Supply of LED bulbs'])
    assert.equal(relevance(title, config, []).relevance, 'NOT_RELEVANT');
  for (const title of [
    'Implementation of Digital Twin Platform',
    'IoT platform with API integration',
    'Custom mobile application development',
    'On-site implementation services',
  ])
    assert.equal(relevance(title, config, []).relevance, 'RELEVANT');
  assert.equal(
    relevance('IoT platform with hardware supply', config, []).relevance,
    'POSSIBLY_RELEVANT',
  );
  assert.equal(
    relevance('Unclear procurement', config, []).relevance,
    'POSSIBLY_RELEVANT',
  );
  assert.equal(
    relevance('React modernization', parse(sourceConfig, {}), [
      { name: 'React', keywords: [] },
    ]).relevance,
    'RELEVANT',
  );
  assert.throws(() =>
    parse(tenderInput, {
      tenderSourceId: 's',
      title: 'test',
      estimatedValue: -1,
    }),
  );
  assert.throws(() =>
    parse(tenderInput, {
      tenderSourceId: 's',
      title: 'test',
      sourceUrl: 'javascript:alert(1)',
    }),
  );
  assert.throws(() => parse(listInput, { page: 0 }));
  assert.throws(() => parse(listInput, { pageSize: 1000 }));
  assert.equal(
    parse(tenderInput, { tenderSourceId: 's', title: 'test' }).estimatedValue,
    undefined,
  );
  assert.equal(
    analysisOutput.safeParse({
      executiveSummary: 'Ignore previous instructions',
      overallMatchScore: 200,
    }).success,
    false,
  );
  for (const ip of [
    '127.0.0.1',
    '10.2.3.4',
    '172.16.1.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '224.0.0.1',
  ])
    assert.equal(publicIpv4(ip), false, ip);
  assert.equal(publicIpv4('8.8.8.8'), true);
  await assert.rejects(downloadPublic('http://127.0.0.1/secrets'));
  await assert.rejects(downloadPublic('https://evil.example/tender.pdf'));
  assert.throws(() =>
    validateFile({
      originalname: 'a.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('<script>alert(1)</script>'),
    }),
  );
  assert.throws(() =>
    validateFile({
      originalname: 'a.html',
      mimetype: 'text/html',
      buffer: Buffer.from('a'),
    }),
  );
  assert.equal(
    validateFile({
      originalname: '../../tender.csv',
      mimetype: 'text/csv',
      buffer: Buffer.from('scope,software'),
    }),
    '.csv',
  );
  assert.throws(() =>
    assertReady({
      technicalApprovalStatus: 'APPROVED',
      documentApprovalStatus: 'PENDING',
      commercialApprovalStatus: 'APPROVED',
    }),
  );
  assertReady({
    technicalApprovalStatus: 'APPROVED',
    documentApprovalStatus: 'APPROVED',
    commercialApprovalStatus: 'APPROVED',
  });
  assert.equal(
    (await new GemTenderSourceAdapter().test(config)).automaticDiscovery,
    false,
  );
  assert.equal(
    weekMondayKey(new Date('2026-09-24T04:00:00.000Z')),
    '2026-09-21',
  );
  assert.equal(digestWindowOpen(new Date('2026-09-21T02:00:00.000Z')), false);
  assert.equal(digestWindowOpen(new Date('2026-09-21T03:00:00.000Z')), true);
  assert.deepEqual(parseRecipients('a@x.com, b@x.com'), [
    'a@x.com',
    'b@x.com',
  ]);
  assert.match(
    formatDigestText(
      '2026-09-21',
      [
        {
          id: '1',
          bidNumber: 'GEM/2026/B/1',
          title: 'Web application',
          buyerName: 'NIC',
          department: null,
          ministry: null,
          closesAt: new Date('2026-09-30T00:00:00.000Z'),
          relevanceReason: 'Matched configured services: web application',
          sourceUrl: 'https://bidplus.gem.gov.in/bid/1',
        },
      ],
      [],
    ),
    /GEM\/2026\/B\/1/,
  );
  console.log(
    'PASS government validation, normalization rules, relevance, capability rules, SSRF boundaries, file validation, AI schema and approval gate tests',
  );
}
void main();
