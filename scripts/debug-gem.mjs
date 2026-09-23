import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const url = 'https://bidplus.gem.gov.in/all-bids';

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

  console.log('Opening:', url);

  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  console.log('HTTP status:', response?.status());
  console.log('Current URL:', page.url());

  // Give the JS-rendered bid listing time to load.
  await page.waitForTimeout(8000);

  const bodyText = await page.locator('body').innerText();

  if (/captcha/i.test(bodyText)) {
    console.log('CAPTCHA detected. Stop automatic discovery.');
    process.exitCode = 2;
  }

  if (/verify you are human/i.test(bodyText)) {
    console.log('Human verification detected. Stop automatic discovery.');
    process.exitCode = 2;
  }

  console.log('\n--- PAGE TEXT SAMPLE ---\n');
  console.log(bodyText.slice(0, 5000));

  // Find rendered text that looks like GeM bid numbers.
  const bidNumberMatches =
    bodyText.match(/GEM\/\d{4}\/[A-Z]+\/\d+/g) ?? [];

  const uniqueBidNumbers = [...new Set(bidNumberMatches)];

  console.log('\nBid numbers found:', uniqueBidNumbers.length);
  console.log(uniqueBidNumbers.slice(0, 30));

  // Inspect all links that contain a GeM bid number.
  const links = await page.locator('a').evaluateAll((anchors) =>
    anchors
      .map((a) => ({
        text: (a.textContent ?? '').trim(),
        href: a.href,
      }))
      .filter((a) => /GEM\/\d{4}\/[A-Z]+\/\d+/i.test(a.text)),
  );

  console.log('\nBid links found:', links.length);
  console.log(links.slice(0, 20));

  await page.screenshot({
    path: 'gem-debug.png',
    fullPage: true,
  });

  const html = await page.content();

  await fs.writeFile(
    'gem-debug.html',
    html,
    'utf8',
  );

  console.log('\nSaved:');
  console.log('gem-debug.png');
  console.log('gem-debug.html');
} catch (error) {
  console.error('GeM debug failed:', error);
  process.exitCode = 1;
} finally {
  await browser.close();
}