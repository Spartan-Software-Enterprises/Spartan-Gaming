#!/usr/bin/env node
import { createRequire } from 'node:module';
import { createFrontendServer } from '../frontend/serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function inspectDashboard(page, viewport, origin) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${origin}/dashboard/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-cards] .card', { timeout: 10000 });
  check((await page.title()).includes('Spartan Gaming'), `${viewport.name}: wrong page title`);
  check(
    (await page.locator('h1').innerText()).includes('Your game space'),
    `${viewport.name}: dashboard heading missing`,
  );
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    `${viewport.name}: horizontal overflow`,
  );

  const consoleToggle = page.locator('[data-console-mode-toggle]');
  check((await consoleToggle.count()) === 1, `${viewport.name}: console mode toggle missing`);
  const consoleInitiallyOn = await consoleToggle.getAttribute('aria-pressed');
  await consoleToggle.click();
  await page.waitForTimeout(80);
  check(
    (await consoleToggle.getAttribute('aria-pressed')) !== consoleInitiallyOn,
    `${viewport.name}: console mode did not toggle`,
  );
  check(
    (await page.locator('body').evaluate((body) => body.classList.contains('console-mode'))) !==
      (consoleInitiallyOn === 'true'),
    `${viewport.name}: console presentation class did not update`,
  );
  check(
    (await page.locator('html').getAttribute('data-spartan-navigation')) === 'remote-controller',
    `${viewport.name}: console mode did not enable controller navigation`,
  );
  await consoleToggle.click();
  await page.waitForTimeout(80);

  const search = page.locator('[data-search]');
  await search.focus();
  check(
    await search.evaluate((element) => document.activeElement === element),
    `${viewport.name}: search did not receive focus`,
  );
  await search.fill('does-not-exist');
  await page.waitForTimeout(80);
  check(
    (await page.locator('[data-cards]').innerText()).includes('No connections match'),
    `${viewport.name}: empty search recovery state missing`,
  );
  await search.fill('Steam');
  await page.waitForTimeout(80);
  check(
    (await page.locator('.results-shelf .card').count()) > 0,
    `${viewport.name}: search results missing`,
  );
  check(
    (await page.locator('[data-result-count]').innerText()).includes('connection'),
    `${viewport.name}: result count missing`,
  );

  const platform = page.locator('[data-discovery-filter="platform"]');
  const platformValue = await platform.locator('option').nth(1).getAttribute('value');
  check(Boolean(platformValue), `${viewport.name}: platform options missing`);
  await search.fill('');
  await platform.selectOption(platformValue);
  await page.waitForTimeout(80);
  check(
    (await page.locator('.results-shelf .card').count()) > 0,
    `${viewport.name}: platform filter removed all expected results`,
  );
  await platform.selectOption('');
  await search.fill('Steam');
  await page.waitForTimeout(80);
  check(
    (await page.locator('.results-shelf .card').count()) > 0,
    `${viewport.name}: search results missing after filter reset`,
  );
  await search.fill('');
  await page.waitForTimeout(80);
  check(
    (await page.locator('[data-shelf]').count()) > 0,
    `${viewport.name}: clearing filters did not restore shelves`,
  );

  const firstFavorite = page.locator('[data-favorite]').first();
  const favoriteBefore = await firstFavorite.getAttribute('aria-pressed');
  await firstFavorite.click();
  await page.waitForTimeout(80);
  const favoriteAfter = await page
    .locator(`[data-favorite="${await firstFavorite.getAttribute('data-favorite')}"]`)
    .first()
    .getAttribute('aria-pressed');
  check(favoriteAfter !== favoriteBefore, `${viewport.name}: favorite control did not toggle`);

  const details = page.locator('[data-details]').first();
  if (await details.count()) {
    await details.click();
    await page.waitForTimeout(80);
    check(
      await page
        .locator('[data-provider-details-dialog]')
        .evaluate((dialog) => dialog.open || dialog.hasAttribute('open')),
      `${viewport.name}: provider details dialog did not open`,
    );
    check(
      (await page.locator('[data-provider-details]').innerText()).length > 20,
      `${viewport.name}: provider details were empty`,
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(40);
    check(
      !(await page.locator('[data-provider-details-dialog]').evaluate((dialog) => dialog.open)),
      `${viewport.name}: Escape did not close provider details`,
    );
  }

  const unnamed = await page.locator('a,button,input,select,textarea,[tabindex]').evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          rect.width === 0 ||
          rect.height === 0
        )
          return false;
        if (element.matches('input,select,textarea'))
          return (
            !element.getAttribute('aria-label') &&
            !element.getAttribute('aria-labelledby') &&
            !element.closest('label')
          );
        return (
          !element.getAttribute('aria-label') &&
          !element.textContent.trim() &&
          !element.getAttribute('title')
        );
      }).length,
  );
  check(unnamed === 0, `${viewport.name}: ${unnamed} visible controls lacked accessible names`);
  check(errors.length === 0, `${viewport.name}: runtime errors: ${errors.join('; ')}`);
}

async function inspectProviders(page, viewport, origin) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${origin}/providers/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-provider]', { timeout: 10000 });
  const tabs = page.locator('[data-provider-category]');
  check((await tabs.count()) === 5, `${viewport.name}: provider categories missing`);
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    `${viewport.name}: provider page horizontal overflow`,
  );
  await page.locator('[data-provider-category="cloud"]').click();
  check(
    (await page.locator('[data-provider]').count()) === 8,
    `${viewport.name}: cloud category count incorrect`,
  );
  check(
    (await page.locator('[data-provider="twitch"]').count()) === 0,
    `${viewport.name}: cloud category leaked streaming provider`,
  );
  await page.locator('[data-provider-category="streaming"]').click();
  check(
    (await page.locator('[data-provider="twitch"]').count()) === 1,
    `${viewport.name}: streaming category missing Twitch`,
  );
  check(
    (await page.locator('[data-provider="nvidia-geforce-now"]').count()) === 0,
    `${viewport.name}: streaming category leaked cloud provider`,
  );
  await page.locator('[data-provider-category="all"]').click();
  check(
    (await page.locator('[data-provider]').count()) === 28,
    `${viewport.name}: all providers did not restore catalog`,
  );
  check(errors.length === 0, `${viewport.name}: provider runtime errors: ${errors.join('; ')}`);
}

const frontend = createFrontendServer({ host: '127.0.0.1', port: 0 });
await frontend.listen();
const address = frontend.server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'landscape-phone', width: 900, height: 500 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'television', width: 1920, height: 1080 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    await inspectDashboard(page, viewport, origin);
    await inspectProviders(page, viewport, origin);
    await page.close();
  }
} finally {
  await browser.close();
  await frontend.close();
}

const uniqueFailures = [...new Set(failures)];
if (uniqueFailures.length) {
  console.error('HUMAN FLOW AUDIT FAILED');
  uniqueFailures.forEach((failure) => console.error(` - ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    'HUMAN FLOW AUDIT PASSED: dashboard recovery, filters, favorites, details, focus, accessibility, responsive overflow, and runtime health across four viewports',
  );
}
