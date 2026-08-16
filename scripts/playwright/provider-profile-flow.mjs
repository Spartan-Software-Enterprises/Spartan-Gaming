import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const { createFrontendServer } = await import('../frontend/serve.mjs');

const frontend = createFrontendServer({ host: '127.0.0.1', port: 0 });
await frontend.listen();
const address = frontend.server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'landscape-phone', width: 900, height: 500 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (url, options) => {
        if (String(url).includes('nvidia.com')) {
          if (window.__forceProviderAuth) throw new Error('authentication required');
          if (window.__forceProviderUnavailable) return { status: 503, type: 'basic' };
          return { status: 204, type: 'basic' };
        }
        return originalFetch(url, options);
      };
    });
    await page.goto(`${origin}/providers/`, { waitUntil: 'networkidle' });
    const first = page.locator('[data-provider]').first();
    await first.click();
    const panel = page.locator('.health-check');
    const layout = await panel.evaluate((element) => {
      const button = element.querySelector('button').getBoundingClientRect();
      const text = element.querySelector('div').getBoundingClientRect();
      const result = element.querySelector('span').getBoundingClientRect();
      return {
        panelWidth: element.getBoundingClientRect().width,
        textWidth: text.width,
        buttonWidth: button.width,
        resultWidth: result.width,
        textHeight: text.height,
      };
    });
    if (layout.textWidth < 180 || layout.buttonWidth < 100 || layout.resultWidth < 100)
      throw new Error(`${viewport.name}: health panel collapsed: ${JSON.stringify(layout)}`);
    const providerText = await page.locator('.editor-title p').nth(1).innerText();
    const providerUrl = providerText.split(' · ')[0];
    const providerOrigin = new URL(providerUrl).origin;
    await page.waitForTimeout(500);
    await page.route(`${providerOrigin}/**`, (route) =>
      route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
        },
      }),
    );
    await page.locator('[data-health]').click();
    await page.waitForTimeout(500);
    const reachableResult = await page.locator('[data-health-result]').innerText();
    if (!reachableResult.startsWith('reachable'))
      throw new Error(`${viewport.name}: reachable check did not render: ${reachableResult}`);
    await page.evaluate(() => {
      window.__forceProviderUnavailable = true;
    });
    await page.locator('[data-health]').click();
    await page.waitForTimeout(500);
    const unavailableResult = await page.locator('[data-health-result]').innerText();
    if (!unavailableResult.startsWith('unavailable'))
      throw new Error(`${viewport.name}: unavailable state did not render: ${unavailableResult}`);
    await page.unroute(`${providerOrigin}/**`);
    await page.route(`${providerOrigin}/**`, (route) => route.abort());
    await page.evaluate(() => {
      window.__forceProviderUnavailable = false;
      window.__forceProviderAuth = true;
      window.__spartanAuthOpened = null;
      window.open = (url) => {
        window.__spartanAuthOpened = url;
        return {};
      };
    });
    await page.locator('[data-health]').click();
    await page.waitForTimeout(500);
    const authResult = await page.locator('[data-health-result]').innerText();
    if (!authResult.startsWith('sign-in required'))
      throw new Error(`${viewport.name}: auth fallback did not render: ${authResult}`);
    if (!(await page.locator('[data-auth]').isVisible()))
      throw new Error(`${viewport.name}: login action was not shown`);
    await page.locator('[data-auth]').click();
    if (!(await page.locator('[data-health-result]').innerText()).startsWith('login dialog opened'))
      throw new Error(`${viewport.name}: login dialog did not open`);
    if ((await page.evaluate(() => window.__spartanAuthOpened)) !== providerUrl)
      throw new Error(`${viewport.name}: auth fallback opened the wrong URL`);
    if (errors.length) throw new Error(`${viewport.name}: ${errors.join('; ')}`);
    await page.screenshot({ path: `/tmp/spartan-provider-${viewport.name}.png`, fullPage: false });
    results.push({ viewport: viewport.name, layout, authResult });
    await page.close();
  }
  console.log(JSON.stringify({ status: 'passed', results }));
} finally {
  await browser.close();
  await frontend.close();
}
