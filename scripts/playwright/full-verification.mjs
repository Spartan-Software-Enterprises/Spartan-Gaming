#!/usr/bin/env node
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { createFrontendServer } from '../frontend/serve.mjs';

const modulePath = process.env.SPARTAN_PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = createRequire(import.meta.url)(modulePath);

export const FULL_ROUTES = Object.freeze([
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

export const FULL_LAYOUTS = Object.freeze([
  Object.freeze({ name: 'desktop', width: 1440, height: 900 }),
  Object.freeze({ name: 'handheld', width: 1280, height: 800 }),
  Object.freeze({ name: 'mobile', width: 390, height: 844 }),
  Object.freeze({ name: 'television', width: 1920, height: 1080 }),
]);

const ERROR_MARKERS = Object.freeze([
  'Unexpected end of JSON input',
  'is not valid JSON',
  'Failed to execute',
  'TypeError',
  'ReferenceError',
  'SyntaxError',
  'Cannot read properties of',
  'Uncaught (in promise)',
  'NotSupportedError',
  'SecurityError',
]);

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = [];
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const row = Buffer.from(raw.subarray(pos, pos + stride));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = y > 0 ? rows[y - 1][x] : 0;
      const upperLeft = y > 0 && x >= channels ? rows[y - 1][x - channels] : 0;
      let value = row[x];
      if (filter === 1) value = (value + left) & 0xff;
      else if (filter === 2) value = (value + up) & 0xff;
      else if (filter === 3) value = (value + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upperLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upperLeft);
        value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft)) & 0xff;
      }
      row[x] = value;
    }
    rows.push(row);
    pos += stride;
  }
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = y * stride + x * channels;
      const dst = (y * width + x) * 4;
      pixels[dst] = rows[y][src];
      pixels[dst + 1] = rows[y][src + 1];
      pixels[dst + 2] = rows[y][src + 2];
      pixels[dst + 3] = channels === 4 ? rows[y][src + 3] : 255;
    }
  }
  return { width, height, pixels };
}

function analyzeImage(png) {
  const { width, height, pixels } = png;
  let sum = 0;
  let sumSq = 0;
  let nearBackground = 0;
  const sampleEvery = Math.max(1, Math.floor((width * height) / 40000));
  let sampled = 0;
  let background = null;
  for (let i = 0; i < width * height; i += sampleEvery) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += luma;
    sumSq += luma * luma;
    if (background === null) background = [r, g, b];
    const bg = background;
    if (Math.abs(r - bg[0]) < 12 && Math.abs(g - bg[1]) < 12 && Math.abs(b - bg[2]) < 12)
      nearBackground++;
    sampled++;
  }
  const mean = sum / sampled;
  const variance = sumSq / sampled - mean * mean;
  const stddev = Math.sqrt(Math.max(0, variance));
  const backgroundRatio = nearBackground / sampled;
  const darkPixels = (() => {
    let count = 0;
    let checked = 0;
    for (let i = 0; i < width * height; i += sampleEvery) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma < 24) count++;
      checked++;
    }
    return count / checked;
  })();
  const blank = sampled > 0 && stddev < 4 && mean > 240;
  const nearBlank = sampled > 0 && stddev < 8;
  return Object.freeze({
    width,
    height,
    meanLuma: Math.round(mean * 10) / 10,
    stddev: Math.round(stddev * 10) / 10,
    backgroundRatio: Math.round(backgroundRatio * 1000) / 10,
    darkPixelRatio: Math.round(darkPixels * 1000) / 10,
    blank,
    nearBlank,
  });
}

async function probeRoute(page, route) {
  if (route === '/dashboard/') {
    const cards = page.locator('[data-cards]');
    const initial = await cards.locator('.card, article, .tile, button').count();
    if (initial === 0 && (await cards.innerText()).includes('No'))
      return { ok: true, note: 'empty library state rendered' };
    if (initial === 0) return { ok: false, message: 'dashboard rendered no cards' };
    const search = page.locator('[data-search]');
    if (await search.count()) {
      await search.fill('Steam');
      await page.waitForTimeout(120);
      const body = await page.locator('body').innerText();
      if (!body.includes('Steam'))
        return { ok: false, message: 'dashboard search produced no Steam result' };
    }
    const filter = page.locator('[data-filter]').first();
    if (await filter.count()) {
      await filter.click();
      await page.waitForTimeout(120);
    }
    return { ok: true };
  }
  if (route === '/settings/') {
    const nav = page.locator('[data-settings-nav]');
    if ((await nav.count()) === 0) return { ok: false, message: 'settings nav missing' };
    const buttons = nav.locator('button, [role="tab"], a');
    const n = await buttons.count();
    if (n === 0) return { ok: false, message: 'settings nav has no buttons' };
    if (n > 1) {
      await buttons.nth(1).click();
      await page.waitForTimeout(120);
    }
    const content = await page.locator('[data-settings-content]').innerText();
    if (content.trim().length === 0) return { ok: false, message: 'settings content empty' };
    return { ok: true };
  }
  if (route === '/adapters/') {
    const manifestList = page.locator('[data-manifest-list]');
    const coreList = page.locator('[data-core-list]');
    const manifestText = await manifestList.innerText();
    const coreText = await coreList.innerText();
    if (manifestText.trim().length < 10 && coreText.trim().length < 10)
      return { ok: false, message: 'adapters rendered no manifests or cores' };
    return { ok: true };
  }
  if (route === '/emulation/') {
    const coreList = page.locator('[data-core-list]');
    const cores = await coreList.locator('.core-card, article, button').count();
    const countText = await page.locator('[data-core-count]').innerText();
    if (!/runtimes/.test(countText) && cores === 0)
      return { ok: false, message: 'emulation rendered no cores' };
    return { ok: true };
  }
  if (route === '/workspaces/') {
    const list = page.locator('[data-workspaces]');
    const text = await list.innerText();
    if (text.trim().length < 10) return { ok: false, message: 'workspaces rendered nothing' };
    return { ok: true };
  }
  if (route === '/host/') {
    const hosts = page.locator('[data-hosts]');
    const text = await hosts.innerText();
    if (text.trim().length < 10) return { ok: false, message: 'host page rendered nothing' };
    return { ok: true };
  }
  if (route === '/providers/') {
    const count = await page.locator('[data-count]').innerText();
    if (!/^\d+ services$/.test(count))
      return { ok: false, message: `providers count invalid: "${count}"` };
    const items = await page.locator('[data-provider]').count();
    if (items < 20) return { ok: false, message: `providers rendered ${items} entries` };
    const first = page.locator('[data-provider]').first();
    const name = (await first.locator('strong').innerText()).trim();
    await first.click();
    await page.waitForTimeout(80);
    const editorText = await page.locator('[data-editor]').innerText();
    if (!editorText.includes(name))
      return { ok: false, message: `providers editor did not populate "${name}"` };
    return { ok: true };
  }
  if (route === '/diagnostics/') {
    const text = await page.locator('body').innerText();
    if (text.trim().length < 20) return { ok: false, message: 'diagnostics rendered nothing' };
    return { ok: true };
  }
  if (
    route === '/player/' ||
    route === '/input/inspector.html' ||
    route === '/input/profiles.html'
  ) {
    const text = await page.locator('body').innerText();
    if (text.trim().length < 20) return { ok: false, message: `${route} rendered nothing` };
    return { ok: true };
  }
  return { ok: true };
}

export async function runFullVerification({
  host = '127.0.0.1',
  port = 0,
  root,
  publicRoot,
  screenshotRoot = '/tmp/spartan-verification',
  launchOptions = { headless: true },
} = {}) {
  const frontend = createFrontendServer({ host, port, root, publicRoot });
  await frontend.listen();
  const address = frontend.server.address();
  const origin = `http://${address.address === '::' ? '[::1]' : address.address}:${address.port}`;
  const shotDir = path.join(screenshotRoot, 'screenshots');
  await mkdir(shotDir, { recursive: true });
  let browser;
  const results = [];
  const failures = [];
  try {
    browser = await chromium.launch(launchOptions);
    for (const layout of FULL_LAYOUTS) {
      const page = await browser.newPage({
        viewport: { width: layout.width, height: layout.height },
      });
      const pageErrors = [];
      const consoleErrors = [];
      const failedRequests = [];
      const onPageError = (error) => pageErrors.push(error.message);
      const onConsole = (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      };
      const onRequestFailed = (request) =>
        failedRequests.push(`${request.url()} (${request.failure()?.errorText})`);
      page.on('pageerror', onPageError);
      page.on('console', onConsole);
      page.on('requestfailed', onRequestFailed);
      for (const route of FULL_ROUTES) {
        const slug = route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home';
        const response = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
        const body = await page.locator('body').innerText();
        const horizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        const screenshot = await page.screenshot({ fullPage: false });
        const png = decodePng(screenshot);
        const image = analyzeImage(png);
        const file = `${layout.name}-${slug}.png`;
        await writeFile(path.join(shotDir, file), screenshot);
        const routeErrors = pageErrors.filter(Boolean);
        const routeConsole = consoleErrors.filter(Boolean);
        const routeFailures = [];
        if (!response || response.status() !== 200)
          routeFailures.push(`status ${response?.status() || 'no response'}`);
        if (body.trim().length < 20) routeFailures.push('no meaningful body');
        for (const marker of ERROR_MARKERS) {
          if (body.includes(marker)) routeFailures.push(`error marker "${marker}"`);
        }
        if (horizontalOverflow) routeFailures.push('horizontal overflow');
        if (routeErrors.length > 0) routeFailures.push(`page errors: ${routeErrors.join('; ')}`);
        if (routeConsole.length > 0)
          routeFailures.push(`console errors: ${routeConsole.join('; ')}`);
        if (failedRequests.length > 0)
          routeFailures.push(`failed requests: ${failedRequests.join('; ')}`);
        if (image.blank) routeFailures.push('blank screenshot');
        if (image.stddev < 3 && image.meanLuma > 250)
          routeFailures.push('nearly all-white screenshot');
        const probe = await probeRoute(page, route);
        if (!probe.ok) routeFailures.push(`probe: ${probe.message}`);
        results.push({
          viewport: layout.name,
          route,
          status: response?.status() ?? null,
          bodyLength: body.trim().length,
          horizontalOverflow,
          screenshot: file,
          image,
          probe: probe.ok,
          pageErrors: routeErrors,
          consoleErrors: routeConsole,
          failedRequests: [...failedRequests],
        });
        if (routeFailures.length > 0)
          failures.push(`${layout.name} ${route}: ${routeFailures.join(' | ')}`);
      }
      await page.close();
    }
    return Object.freeze({
      version: 1,
      tool: 'full-verification',
      routes: FULL_ROUTES,
      layouts: FULL_LAYOUTS,
      results,
      screenshotRoot: shotDir,
      failures: Object.freeze([...new Set(failures)]),
      status: failures.length === 0 ? 'passed' : 'failed',
    });
  } finally {
    await browser?.close();
    await frontend.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('/scripts/playwright/full-verification.mjs')) {
  const root = process.env.SPARTAN_FRONTEND_ROOT;
  const publicRoot = process.env.SPARTAN_PUBLIC_ROOT;
  runFullVerification({ root, publicRoot })
    .then((report) => {
      console.log(JSON.stringify(report));
      if (report.status !== 'passed') process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
