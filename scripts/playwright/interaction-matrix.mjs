import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createFrontendServer } from '../frontend/serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const layouts = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'landscape-phone', width: 900, height: 500 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'television', width: 1920, height: 1080 },
];
const routes = ['/dashboard/', '/providers/', '/settings/'];
const screenshotRoot = '/tmp/spartan-ui-interaction-matrix';
const failures = [];
const externalHeadStub = `
  const originalFetch = window.fetch.bind(window);
  window.fetch = (url, options) => {
    if (options?.method === 'HEAD' && String(url).startsWith('http'))
      return Promise.resolve({ status: 204, type: 'basic' });
    return originalFetch(url, options);
  };
`;

function fail(layout, route, message) {
  failures.push(`${layout.name} ${route}: ${message}`);
}

async function shot(page, layout, route, name) {
  await page.screenshot({
    path: path.join(
      screenshotRoot,
      `${layout.name}-${route.replaceAll('/', '-').replaceAll('.', '-')}-${name}.png`,
    ),
    fullPage: false,
  });
}

async function clickAndCapture(page, layout, route, locator, name) {
  if ((await locator.count()) !== 1) return false;
  const visible = await locator.isVisible().catch(() => false);
  if (!visible) return false;
  await locator.click();
  await page.waitForTimeout(70);
  await shot(page, layout, route, name);
  return true;
}

async function checkControls(page, layout, route) {
  const unnamed = await page.locator('a,button,input,select,textarea,[tabindex]').evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          !rect.width ||
          !rect.height
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
  if (unnamed) fail(layout, route, `${unnamed} visible controls lack accessible names`);
}

async function exercise(page, layout, route) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(180);
  await shot(page, layout, route, 'initial');
  await checkControls(page, layout, route);

  if (route === '/dashboard/') {
    for (const [selector, name] of [
      ['[data-console-mode-toggle]', 'console-mode'],
      ['[data-filter="cloud"]', 'filter-cloud'],
      ['[data-filter="all"]', 'filter-all'],
      ['[data-shelf-scroll]', 'shelf-arrow'],
      ['[data-shelf-filter]', 'shelf-view-all'],
      ['[data-details]', 'details'],
      ['[data-favorite]', 'favorite'],
    ])
      await clickAndCapture(page, layout, route, page.locator(selector).first(), name);
    await page.keyboard.press('Escape');
  } else if (route === '/providers/') {
    for (const category of ['cloud', 'streaming', 'emulation', 'remote', 'all'])
      await clickAndCapture(
        page,
        layout,
        route,
        page.locator(`[data-provider-category="${category}"]`),
        `category-${category}`,
      );
    if (await page.locator('[data-provider]').count()) {
      await page.locator('[data-provider]').first().click();
      await page.waitForTimeout(500);
      await shot(page, layout, route, 'provider-selected');
      await clickAndCapture(page, layout, route, page.locator('[data-health]'), 'health-check');
      await clickAndCapture(page, layout, route, page.locator('[data-save]'), 'save-profile');
      await clickAndCapture(
        page,
        layout,
        route,
        page.locator('[data-provider-back]'),
        'provider-back',
      );
    } else fail(layout, route, 'provider catalog did not render');
  } else if (route === '/settings/') {
    const categories = page.locator('[data-settings-category], [data-category]');
    for (let index = 0; index < (await categories.count()); index++)
      await clickAndCapture(page, layout, route, categories.nth(index), `category-${index}`);
  }
  if (errors.length) fail(layout, route, `runtime errors: ${errors.join('; ')}`);
}

const frontend = createFrontendServer({ host: '127.0.0.1', port: 0 });
await mkdir(screenshotRoot, { recursive: true });
await frontend.listen();
const address = frontend.server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const layout of layouts) {
    const context = await browser.newContext({
      viewport: { width: layout.width, height: layout.height },
    });
    await context.addInitScript({ content: externalHeadStub });
    for (const route of routes) {
      const page = await context.newPage();
      await exercise(page, layout, route);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await frontend.close();
}
console.log(
  JSON.stringify({
    layouts: layouts.length,
    routes: routes.length,
    screenshots: screenshotRoot,
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
