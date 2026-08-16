import { createRequire } from 'node:module';
import { createFrontendServer } from '../frontend/serve.mjs';

export const PLAYWRIGHT_ROUTES = Object.freeze([
  '/dashboard/',
  '/settings/',
  '/player/',
  '/diagnostics/',
  '/adapters/',
  '/emulation/',
  '/host/',
  '/workspaces/',
  '/providers/',
  '/input/inspector.html',
  '/input/profiles.html',
]);

const VIEWPORTS = Object.freeze([
  Object.freeze({ name: 'desktop', width: 1280, height: 800 }),
  Object.freeze({ name: 'mobile', width: 390, height: 844 }),
]);

function playwrightModule() {
  const modulePath = process.env.SPARTAN_PLAYWRIGHT_MODULE || 'playwright';
  try {
    return createRequire(import.meta.url)(modulePath);
  } catch (error) {
    throw new Error(
      `Playwright is required. Set SPARTAN_PLAYWRIGHT_MODULE to its installed module path (${error.message})`,
    );
  }
}

const ERROR_MARKERS = Object.freeze([
  'Unexpected end of JSON input',
  'is not valid JSON',
  'Failed to execute',
  'TypeError',
  'ReferenceError',
  'SyntaxError',
]);

const EXTERNAL_HEAD_STUB = `
  const originalFetch = window.fetch.bind(window);
  window.fetch = (url, options) => {
    if (options?.method === 'HEAD' && String(url).startsWith('http'))
      return Promise.resolve({ status: 204, type: 'basic' });
    return originalFetch(url, options);
  };
`;

function assertNoErrorMarkers(viewport, route, text) {
  for (const marker of ERROR_MARKERS) {
    if (text.includes(marker))
      throw new Error(`${viewport.name} ${route} shows error marker "${marker}"`);
  }
}

async function checkProvidersPage(page, origin, viewport) {
  const count = await page.locator('[data-count]').innerText();
  if (!/^\d+ services$/.test(count))
    throw new Error(
      `${viewport.name} /providers/ did not render a provider count (got "${count}")`,
    );
  const providerItems = await page.locator('[data-provider]').count();
  if (providerItems < 20)
    throw new Error(`${viewport.name} /providers/ rendered only ${providerItems} provider entries`);
  const editor = page.locator('[data-editor]');
  const firstProvider = page.locator('[data-provider]').first();
  const selectedName = (await firstProvider.locator('strong').innerText()).trim();
  await firstProvider.click();
  await page.waitForTimeout(100);
  const editorText = await editor.innerText();
  if (!editorText.includes(selectedName))
    throw new Error(`${viewport.name} /providers/ editor did not populate "${selectedName}"`);
}

async function checkRoute(page, origin, viewport, route) {
  const pageErrors = [];
  const consoleErrors = [];
  const onPageError = (error) => pageErrors.push(error.message);
  const onConsole = (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  try {
    const response = await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    const body = await page.locator('body').innerText();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (!response || response.status() !== 200)
      throw new Error(`${viewport.name} ${route} returned ${response?.status() || 'no response'}`);
    if (body.trim().length < 20)
      throw new Error(`${viewport.name} ${route} has no meaningful body`);
    assertNoErrorMarkers(viewport, route, body);
    if (pageErrors.length > 0)
      throw new Error(
        `${viewport.name} ${route} page error: ${pageErrors.map((message) => `"${message}"`).join(', ')}`,
      );
    if (consoleErrors.length > 0)
      throw new Error(
        `${viewport.name} ${route} console error: ${consoleErrors
          .map((message) => `"${message}"`)
          .join(', ')}`,
      );
    if (route === '/providers/') await checkProvidersPage(page, origin, viewport);
    return Object.freeze({
      viewport: viewport.name,
      route,
      status: response.status(),
      bodyLength: body.trim().length,
      horizontalOverflow,
      pageErrors,
      consoleErrors,
    });
  } finally {
    page.removeListener('pageerror', onPageError);
    page.removeListener('console', onConsole);
  }
}

async function checkInteractions(page, origin, viewport) {
  await page.goto(`${origin}/dashboard/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  const search = page.locator('input[type="search"]');
  if (await search.count()) {
    await search.fill('Steam');
    if (!(await page.locator('body').innerText()).includes('Steam'))
      throw new Error(`${viewport.name} dashboard search did not render a Steam result`);
  }
  await page.goto(`${origin}/settings/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  const settingsText = await page.locator('body').innerText();
  if (!settingsText.includes('Android') && !settingsText.includes('Controller'))
    throw new Error(`${viewport.name} settings missing expected controls`);
}

export async function runPlaywrightSmoke({
  host = '127.0.0.1',
  port = 0,
  root,
  publicRoot,
  launchOptions = { headless: true },
} = {}) {
  const { chromium } = playwrightModule();
  const frontend = createFrontendServer({ host, port, root, publicRoot });
  await frontend.listen();
  const address = frontend.server.address();
  const origin = `http://${address.address === '::' ? '[::1]' : address.address}:${address.port}`;
  let browser;
  const results = [];
  try {
    browser = await chromium.launch(launchOptions);
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      await page.addInitScript({ content: EXTERNAL_HEAD_STUB });
      for (const route of PLAYWRIGHT_ROUTES)
        results.push(await checkRoute(page, origin, viewport, route));
      await checkInteractions(page, origin, viewport);
      await page.close();
    }
    if (results.some((result) => result.horizontalOverflow && result.viewport === 'mobile'))
      throw new Error('mobile horizontal overflow detected');
    return Object.freeze({
      version: 1,
      tool: 'playwright',
      routes: PLAYWRIGHT_ROUTES,
      viewports: results,
      status: 'passed',
    });
  } finally {
    await browser?.close();
    await frontend.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('/scripts/playwright/smoke.mjs')) {
  runPlaywrightSmoke()
    .then((report) => console.log(JSON.stringify(report)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
