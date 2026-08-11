import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appOrigin = 'spartan-app://app';

export const ELECTRON_VISUAL_ROUTES = Object.freeze([
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

function screenshotName(route) {
  const name = route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-');
  return `${name || 'home'}.png`;
}

export async function runElectronVisualSmoke({
  output = path.join(repositoryRoot, 'out/playwright/electron'),
} = {}) {
  await mkdir(output, { recursive: true });
  const application = await electron.launch({
    args: [path.join(repositoryRoot, 'desktop/electron/main.mjs')],
    cwd: repositoryRoot,
  });
  const results = [];
  try {
    const page = await application.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.setViewportSize({ width: 1280, height: 800 });
    if (!page.url().startsWith(`${appOrigin}/dashboard/`))
      throw new Error(`standalone app opened an unexpected URL: ${page.url()}`);

    const search = page.locator('input[type="search"]');
    await search.fill('Steam');
    await page.waitForTimeout(150);
    if (!(await page.locator('body').innerText()).includes('Steam'))
      throw new Error('standalone dashboard search did not render a Steam result');
    await page.screenshot({ path: path.join(output, 'dashboard-search.png'), fullPage: true });

    for (const route of ELECTRON_VISUAL_ROUTES) {
      await page.goto(`${appOrigin}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(150);
      const body = (await page.locator('body').innerText()).trim();
      if (body.length < 20) throw new Error(`${route} has no meaningful application content`);
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      await page.screenshot({ path: path.join(output, screenshotName(route)), fullPage: true });
      results.push(Object.freeze({ route, bodyLength: body.length, horizontalOverflow }));
    }

    await page.goto(`${appOrigin}/settings/`, { waitUntil: 'domcontentloaded' });
    const shortcut = page.locator('[data-key="general.globalShortcut"]');
    await shortcut.selectOption('CommandOrControl+Shift+G');
    await page.waitForTimeout(200);
    const saveStatus = await page.locator('[data-save-status]').innerText();
    if (!/active|unavailable|saved/i.test(saveStatus))
      throw new Error(`desktop shortcut setting returned unexpected status: ${saveStatus}`);
    await page.screenshot({
      path: path.join(output, 'settings-global-shortcut.png'),
      fullPage: true,
    });

    return Object.freeze({
      version: 1,
      tool: 'playwright-electron',
      origin: appOrigin,
      routes: Object.freeze(results),
      interactions: Object.freeze(['dashboard-search', 'global-shortcut-setting']),
      status: 'passed',
      output,
    });
  } finally {
    await application.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runElectronVisualSmoke()
    .then((report) => console.log(JSON.stringify(report)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
