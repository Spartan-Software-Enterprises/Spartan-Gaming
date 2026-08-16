import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createFrontendServer } from '../frontend/serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const routes = [
  '/adapters/',
  '/dashboard/',
  '/diagnostics/',
  '/emulation/',
  '/host/',
  '/host/browser-studio.html',
  '/host/lan-demo.html',
  '/input/inspector.html',
  '/input/profiles.html',
  '/library/',
  '/library/detail.html',
  '/multiplayer/',
  '/player/',
  '/providers/',
  '/settings/',
  '/social/',
  '/watch/',
  '/workspaces/',
];
const layouts = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'landscape-phone', width: 900, height: 500 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'television', width: 1920, height: 1080 },
];
const screenshotRoot = '/tmp/spartan-ui-release-audit';
const failures = [];
const externalHeadStub = `
  const originalFetch = window.fetch.bind(window);
  window.fetch = (url, options) => {
    if (options?.method === 'HEAD' && String(url).startsWith('http'))
      return Promise.resolve({ status: 204, type: 'basic' });
    return originalFetch(url, options);
  };
`;

function fail(route, layout, message) {
  failures.push(`${layout.name} ${route}: ${message}`);
}

async function inspectPage(page, origin, route, layout) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const response = await page.goto(`${origin}${route}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(250);
  const bodyText = (await page.locator('body').innerText()).trim();
  const metrics = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const focusables = [
      ...document.querySelectorAll('a,button,input,select,textarea,[tabindex]'),
    ].filter(visible);
    const unnamed = focusables.filter((element) => {
      if (element.matches('input,select,textarea')) {
        return (
          !element.getAttribute('aria-label') &&
          !element.getAttribute('aria-labelledby') &&
          !element.closest('label')
        );
      }
      return (
        !element.getAttribute('aria-label') &&
        !element.textContent.trim() &&
        !element.getAttribute('title')
      );
    });
    const offscreen = focusables.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1;
    });
    const tinyTargets = focusables.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 24 || rect.height < 24;
    });
    return {
      width: document.documentElement.scrollWidth,
      focusables: focusables.length,
      unnamed: unnamed.length,
      offscreen: offscreen.length,
      tinyTargets: tinyTargets.length,
    };
  });
  if (!response || response.status() !== 200) fail(route, layout, `HTTP ${response?.status()}`);
  if (bodyText.length < 30) fail(route, layout, 'blank or nearly blank body');
  if (metrics.width > layout.width + 1)
    fail(route, layout, `horizontal overflow ${metrics.width}px`);
  if (metrics.unnamed)
    fail(route, layout, `${metrics.unnamed} visible interactive controls lack accessible names`);
  if (metrics.offscreen)
    fail(route, layout, `${metrics.offscreen} visible controls extend beyond the viewport`);
  if (pageErrors.length) fail(route, layout, `page errors: ${pageErrors.join('; ')}`);
  if (consoleErrors.length) fail(route, layout, `console errors: ${consoleErrors.join('; ')}`);
  await page.screenshot({
    path: path.join(
      screenshotRoot,
      `${layout.name}-${route.replaceAll('/', '-').replaceAll('.', '-') || 'root'}.png`,
    ),
    fullPage: false,
  });
  return metrics;
}

await mkdir(screenshotRoot, { recursive: true });
const frontend = createFrontendServer({ host: '127.0.0.1', port: 0 });
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
    const page = await context.newPage();
    await page.goto(`${origin}/providers/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    const providerCount = await page.locator('[data-provider]').count();
    if (providerCount < 20) fail('/providers/', layout, `only ${providerCount} providers rendered`);
    await page.locator('[data-provider]').first().click();
    const health = page.locator('.health-check');
    if ((await health.count()) !== 1)
      fail('/providers/', layout, 'availability panel missing after provider selection');
    else {
      const healthLayout = await health.evaluate((element) => {
        const text = element.querySelector('div').getBoundingClientRect();
        const action = element.querySelector('button').getBoundingClientRect();
        const result = element.querySelector('span').getBoundingClientRect();
        return { text: text.width, action: action.width, result: result.width };
      });
      if (healthLayout.text < 180 || healthLayout.action < 100 || healthLayout.result < 100)
        fail('/providers/', layout, `availability panel collapsed ${JSON.stringify(healthLayout)}`);
    }
    await page.close();
    for (const route of routes) {
      const routePage = await context.newPage();
      await inspectPage(routePage, origin, route, layout);
      await routePage.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await frontend.close();
}

console.log(
  JSON.stringify({
    routes: routes.length,
    layouts: layouts.length,
    screenshots: screenshotRoot,
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
