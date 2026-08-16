#!/usr/bin/env node
import { createRequire } from 'node:module';
import { createFrontendServer } from '../frontend/serve.mjs';

const modulePath = process.env.SPARTAN_PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = createRequire(import.meta.url)(modulePath);

const root = '/home/ubuntu/Spartan-Gaming/out/spartan-frontend';
const publicRoot = '/home/ubuntu/Spartan-Gaming';

const errors = [];
const failures = [];
function check(ok, message) {
  if (!ok) failures.push(message);
  else errors.push(null);
}
function note(message) {
  errors.push(null);
}

const frontend = createFrontendServer({ host: '127.0.0.1', port: 0, root, publicRoot });
await frontend.listen();
const address = frontend.server.address();
const origin = `http://${address.address === '::' ? '[::1]' : address.address}:${address.port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const pageErrors = [];
    const consoleErrors = [];
    const failedRequests = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('requestfailed', (r) => failedRequests.push(`${r.url()} (${r.failure()?.errorText})`));
    await page.goto(`${origin}/providers/`, { waitUntil: 'networkidle' });
    const count = await page.locator('[data-count]').innerText();
    check(/^\d+ services$/.test(count), `${viewport.name} count text: "${count}"`);
    const itemCount = await page.locator('[data-provider]').count();
    check(itemCount === 28, `${viewport.name} expected 28 provider entries, got ${itemCount}`);

    const names = await page
      .locator('[data-provider] strong')
      .evaluateAll((els) => els.map((el) => el.textContent.trim()));
    const expectedNames = [
      'NVIDIA GeForce NOW',
      'Xbox Cloud Gaming',
      'Amazon Luna',
      'Boosteroid',
      'Shadow PC',
      'Steam Remote Play',
      'Twitch',
      'YouTube Live',
      'Discord',
      'Owncast',
      'PlayStation Plus Cloud Streaming',
      'Blacknut',
      'Antstream Arcade',
      'Parsec',
      'Xbox Remote Play',
      'PlayStation Remote Play',
      'Sunshine / Moonlight Compatible Host',
      'Steam Broadcasting',
      'KICK',
      'Spartan Host',
      'Steam',
      'GOG',
      'Epic Games',
      'Ubisoft Connect',
      'EA App',
      'Battle.net',
      'Rockstar Games',
      'GameNative',
    ];
    for (let i = 0; i < expectedNames.length; i++) {
      if (names[i] !== expectedNames[i])
        failures.push(
          `${viewport.name} provider #${i + 1} name "${names[i]}" != "${expectedNames[i]}"`,
        );
    }
    check(failures.length === 0, `${viewport.name} provider names matched ${expectedNames.length}`);

    const editor = page.locator('[data-editor]');
    for (let i = 0; i < itemCount; i++) {
      const item = page.locator('[data-provider]').nth(i);
      const name = (await item.locator('strong').innerText()).trim();
      await item.click();
      await page.waitForTimeout(40);
      const editorText = await editor.innerText();
      if (!editorText.includes(name))
        failures.push(
          `${viewport.name} editor for "${name}" did not populate (got: ${editorText.slice(0, 80)})`,
        );
      const title = await editor.locator('h2').first().innerText();
      if (title.trim() !== name)
        failures.push(`${viewport.name} editor h2 "${title}" != provider "${name}"`);
    }

    const first = page.locator('[data-provider]').first();
    const firstName = (await first.locator('strong').innerText()).trim();
    await first.click();
    await page.waitForTimeout(40);
    const accountInput = editor.locator('[data-account]');
    await accountInput.fill('Playwright saved profile');
    await editor.locator('[data-quality]').selectOption('prefer-quality');
    await editor.locator('[data-save]').click();
    await page.waitForTimeout(120);
    const noticeText = await page.locator('[data-notice]').innerText();
    check(
      noticeText.includes('profile saved'),
      `${viewport.name} no save notice (got "${noticeText}")`,
    );
    await page.reload({ waitUntil: 'networkidle' });
    const persistedLabel = await page
      .locator('[data-provider]')
      .first()
      .locator('small')
      .innerText();
    check(
      persistedLabel.includes('Playwright saved profile') || persistedLabel.includes('1 account'),
      `${viewport.name} profile did not persist across reload (label: "${persistedLabel}")`,
    );
    const editorAfter = page.locator('[data-editor]');
    const savedAccount = await editorAfter.locator('[data-account]').inputValue();
    check(
      savedAccount === 'Playwright saved profile',
      `${viewport.name} saved account "${savedAccount}"`,
    );

    await page.goto(`${origin}/emulation/`, { waitUntil: 'networkidle' });
    await page.goto(`${origin}/providers/`, { waitUntil: 'networkidle' });
    const stillThere = await page.locator('[data-provider]').count();
    check(
      stillThere === 28,
      `${viewport.name} providers dropped after cross-route nav (${stillThere})`,
    );

    check(pageErrors.length === 0, `${viewport.name} page errors: ${pageErrors.join('; ')}`);
    check(
      consoleErrors.length === 0,
      `${viewport.name} console errors: ${consoleErrors.join('; ')}`,
    );
    check(
      failedRequests.length === 0,
      `${viewport.name} failed requests: ${failedRequests.join('; ')}`,
    );

    const body = await page.locator('body').innerText();
    for (const marker of [
      'is not valid JSON',
      'Unexpected end of JSON input',
      'Failed to execute',
    ]) {
      if (body.includes(marker)) failures.push(`${viewport.name} body shows marker "${marker}"`);
    }
    await page.close();
  }
} finally {
  await browser?.close();
  await frontend.close();
}

const uniqueFailures = [...new Set(failures)];
if (uniqueFailures.length > 0) {
  console.error('PROVIDERS DEEP CHECK FAILED:');
  for (const f of uniqueFailures) console.error(' -', f);
  process.exitCode = 1;
} else {
  console.log(
    'PROVIDERS DEEP CHECK PASSED: all providers, editor population, save/persist, cross-route, no page/console/request errors at desktop + mobile',
  );
}
