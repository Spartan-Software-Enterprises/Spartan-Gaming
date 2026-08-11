import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { PNG } from 'pngjs';
import {
  compareVisualBaseline,
  ELECTRON_VISUAL_LAYOUTS,
  ELECTRON_VISUAL_ROUTES,
  visualSnapshotKey,
} from './electron-visual-contract.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appOrigin = 'spartan-app://app';
const activeProfileKey = 'spartan-gaming.active-profile.v1';
const gamingSettingsKey = 'spartan-gaming.profile.gaming.spartan-gaming.settings.v1';

function screenshotName(layout, route) {
  return `${visualSnapshotKey(layout, route)}.png`;
}

function pngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG')
    throw new TypeError('visual smoke produced an invalid PNG screenshot');
  return Object.freeze({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });
}

function fingerprintScreenshot(buffer) {
  const image = PNG.sync.read(buffer);
  const samples = 32;
  let visualHash = '';
  for (let row = 0; row < samples; row += 1) {
    const y = Math.min(image.height - 1, Math.floor(((row + 0.5) * image.height) / samples));
    for (let column = 0; column < samples; column += 1) {
      const x = Math.min(image.width - 1, Math.floor(((column + 0.5) * image.width) / samples));
      const offset = (y * image.width + x) * 4;
      const alpha = image.data[offset + 3] / 255;
      const luma =
        (image.data[offset] * 0.2126 +
          image.data[offset + 1] * 0.7152 +
          image.data[offset + 2] * 0.0722) *
        alpha;
      visualHash += Math.round(luma / 17).toString(16);
    }
  }
  return Object.freeze({
    sha256: createHash('sha256').update(buffer).digest('hex'),
    visualHash,
    ...pngDimensions(buffer),
    bytes: buffer.length,
  });
}

async function readBaseline(baselinePath) {
  if (!baselinePath) return null;
  try {
    return JSON.parse(await readFile(baselinePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readJsonAfterWrite(filePath, predicate = () => true, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = JSON.parse(await readFile(filePath, 'utf8'));
      if (predicate(value)) return value;
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error(`timed out waiting for JSON file ${filePath}`);
}

async function waitForMissingFile(filePath, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for file removal ${filePath}`);
}

async function waitForApplicationDeveloperTools(application, expected, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const opened = await application.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().startsWith('spartan-app://app/'),
      );
      return mainWindow?.webContents.isDevToolsOpened() === true;
    });
    if (opened === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for application DevTools to ${expected ? 'open' : 'close'}`);
}

async function configureLayout(page, layout) {
  await page.setViewportSize({ width: layout.width, height: layout.height });
  await page.waitForFunction(
    ({ width, height }) => window.innerWidth === width && window.innerHeight === height,
    { width: layout.width, height: layout.height },
  );
  await page.goto(`${appOrigin}/dashboard/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ activeKey, settingsKey, mode }) => {
      localStorage.setItem(activeKey, 'gaming');
      let current = {};
      try {
        current = JSON.parse(localStorage.getItem(settingsKey) || '{}');
      } catch {
        current = {};
      }
      localStorage.setItem(
        settingsKey,
        JSON.stringify({
          ...current,
          'appearance.deviceMode': mode,
          'appearance.reduceMotion': true,
          'accessibility.reduceMotion': true,
          'general.askBeforeQuit': false,
          'gaming.hideBrowserChrome': true,
          'television.showPointer': true,
        }),
      );
    },
    { activeKey: activeProfileKey, settingsKey: gamingSettingsKey, mode: layout.mode },
  );
}

async function checkLayoutInteraction(page, layout, output, userDataDirectory, application) {
  await page.goto(`${appOrigin}/dashboard/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(150);
  const search = page.locator('input[type="search"]');
  const resultCount = page.locator('[data-result-count]');
  const beforeSearch = await resultCount.innerText();
  await search.fill('Steam');
  await page.waitForFunction(
    ([selector, before]) => document.querySelector(selector)?.textContent?.trim() !== before.trim(),
    ['[data-result-count]', beforeSearch],
  );
  const afterSearch = await resultCount.innerText();
  const visibleCards = await page.locator('[data-cards]').innerText();
  if (afterSearch.trim() === beforeSearch.trim() || !/steam/i.test(visibleCards))
    throw new Error(`${layout.name} dashboard search did not filter to a Steam result`);

  const interactions = [`${layout.name}:dashboard-search`];
  if (layout.name === 'television') {
    await search.evaluate((element) => element.blur());
    await page.keyboard.press('ArrowDown');
    const focused = await page.evaluate(
      (searchElement) => {
        const element = document.activeElement;
        return Boolean(
          element &&
          element !== searchElement &&
          element.matches(
            'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
          ),
        );
      },
      await search.elementHandle(),
    );
    if (!focused) throw new Error('television remote navigation did not establish focus');
    interactions.push('television:remote-focus');
  }

  if (layout.name === 'desktop') {
    await page.goto(`${appOrigin}/settings/`, { waitUntil: 'domcontentloaded' });
    const shortcut = page.locator('[data-key="general.globalShortcut"]');
    await shortcut.selectOption('CommandOrControl+Shift+G');
    await page.waitForTimeout(200);
    const saveStatus = await page.locator('[data-save-status]').innerText();
    if (!/active|unavailable|saved/i.test(saveStatus))
      throw new Error(`desktop shortcut setting returned unexpected status: ${saveStatus}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    if ((await shortcut.inputValue()) !== 'CommandOrControl+Shift+G')
      throw new Error('desktop shortcut setting did not persist after reload');
    interactions.push('desktop:global-shortcut-setting');

    await page.locator('[data-category="performance"]').click();
    const hardwareAcceleration = page.locator('[data-key="performance.hardwareAcceleration"]');
    if ((await hardwareAcceleration.getAttribute('aria-checked')) !== 'true')
      throw new Error('desktop hardware acceleration setting did not start enabled');
    await hardwareAcceleration.click();
    await page.waitForTimeout(500);
    const startupUi = await page.evaluate(() => ({
      hardwareAcceleration: document.documentElement.dataset.spartanHardwareAcceleration,
      restartRequired: document.documentElement.dataset.spartanRestartRequired,
      status: document.querySelector('[data-save-status]')?.textContent?.trim(),
      storedValue: JSON.parse(
        localStorage.getItem('spartan-gaming.profile.gaming.spartan-gaming.settings.v1') || '{}',
      )['performance.hardwareAcceleration'],
    }));
    if (startupUi.hardwareAcceleration !== 'disabled')
      throw new Error(
        `desktop hardware acceleration setting returned ${JSON.stringify(startupUi)}`,
      );
    const restartRequired = startupUi.restartRequired;
    if (restartRequired !== 'true')
      throw new Error(
        `desktop hardware acceleration setting returned ${JSON.stringify(startupUi)}`,
      );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-category="performance"]').click();
    if ((await hardwareAcceleration.getAttribute('aria-checked')) !== 'false')
      throw new Error('desktop hardware acceleration setting did not persist after reload');
    const startupPolicy = JSON.parse(
      await readFile(path.join(userDataDirectory, 'startup-policy.json'), 'utf8'),
    );
    if (startupPolicy.hardwareAcceleration !== false)
      throw new Error('desktop hardware acceleration setting did not persist for the next launch');
    interactions.push('desktop:hardware-acceleration-setting');
    await hardwareAcceleration.click();
    await page.waitForFunction(
      () =>
        document.documentElement.dataset.spartanHardwareAcceleration === 'enabled' &&
        document.documentElement.dataset.spartanRestartRequired === 'false',
    );

    const crashReports = page.locator('[data-key="performance.crashReports"]');
    await crashReports.click();
    await page.locator('[data-category="advanced"]').click();
    const verboseLogs = page.locator('[data-key="advanced.verboseLogs"]');
    const logRetention = page.locator('[data-key="advanced.logRetention"]');
    await verboseLogs.click();
    await logRetention.selectOption('1 day');
    const startupPolicyPath = path.join(userDataDirectory, 'startup-policy.json');
    const diagnosticsPolicy = await readJsonAfterWrite(
      startupPolicyPath,
      (policy) =>
        policy.crashReports === true &&
        policy.verboseLogs === true &&
        policy.logRetention === '1 day',
    );
    await page.evaluate(() =>
      console.warn(
        'diagnostic interaction token=playwright-secret https://private.example.test/session',
      ),
    );
    const diagnosticLogPath = path.join(userDataDirectory, 'diagnostics', 'events.json');
    const diagnosticEntries = await readJsonAfterWrite(
      diagnosticLogPath,
      (entries) =>
        Array.isArray(entries) &&
        entries.some(
          (entry) => entry.type === 'console' && /diagnostic interaction/.test(entry.message),
        ),
    );
    const interactionEntry = diagnosticEntries.find(
      (entry) => entry.type === 'console' && /diagnostic interaction/.test(entry.message),
    );
    if (
      !interactionEntry ||
      !interactionEntry.message.includes('token=[redacted]') ||
      !interactionEntry.message.includes('[redacted-url]') ||
      interactionEntry.message.includes('playwright-secret') ||
      interactionEntry.message.includes('private.example.test')
    )
      throw new Error('desktop diagnostics did not redact the runtime entry');
    if (
      diagnosticsPolicy.crashReports !== true ||
      diagnosticsPolicy.verboseLogs !== true ||
      diagnosticsPolicy.logRetention !== '1 day'
    )
      throw new Error(
        `desktop diagnostics policy did not persist: ${JSON.stringify(diagnosticsPolicy)}`,
      );
    await page.screenshot({
      path: path.join(output, 'desktop-local-diagnostics-interaction.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.locator('[data-action="advanced.clearDiagnostics"]').click();
    await waitForMissingFile(diagnosticLogPath);
    await verboseLogs.click();
    await logRetention.selectOption('7 days');
    await page.locator('[data-category="performance"]').click();
    await crashReports.click();
    interactions.push('desktop:local-diagnostics-settings');

    await page.locator('[data-category="advanced"]').click();
    const developerMode = page.locator('[data-key="advanced.developerMode"]');
    const developerToolsAction = page.locator('[data-action="advanced.flags"]');
    if ((await developerMode.getAttribute('aria-checked')) !== 'false')
      throw new Error('desktop developer mode did not start disabled');
    await developerToolsAction.click();
    await page.waitForFunction(() =>
      /enable developer mode/i.test(
        document.querySelector('[data-save-status]')?.textContent || '',
      ),
    );
    await developerMode.click();
    await page.waitForFunction(() =>
      /saved|changes saved/i.test(document.querySelector('[data-save-status]')?.textContent || ''),
    );
    const menuExposed = await application.evaluate(({ BrowserWindow, Menu }) => {
      const mainWindow = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().startsWith('spartan-app://app/'),
      );
      return Boolean(
        mainWindow && Menu.getApplicationMenu()?.getMenuItemById('spartan-developer-tools'),
      );
    });
    if (!menuExposed) throw new Error('desktop developer mode did not expose its application menu');
    await page.screenshot({
      path: path.join(output, 'desktop-developer-mode-interaction.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await developerToolsAction.click();
    await page.waitForFunction(() =>
      /developer tools opened/i.test(
        document.querySelector('[data-save-status]')?.textContent || '',
      ),
    );
    await waitForApplicationDeveloperTools(application, true);
    await developerMode.click();
    await waitForApplicationDeveloperTools(application, false);
    const disabledRuntime = await application.evaluate(({ BrowserWindow, Menu }) => {
      const mainWindow = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().startsWith('spartan-app://app/'),
      );
      return {
        devToolsOpened: mainWindow?.webContents.isDevToolsOpened() === true,
        menuExposed: Boolean(Menu.getApplicationMenu()?.getMenuItemById('spartan-developer-tools')),
      };
    });
    if (disabledRuntime.devToolsOpened || disabledRuntime.menuExposed)
      throw new Error(
        `desktop developer mode did not revoke runtime access: ${JSON.stringify(disabledRuntime)}`,
      );
    interactions.push('desktop:developer-mode-tools');

    await page.locator('[data-category="updates"]').click();
    const updateChannel = page.locator('[data-key="updates.channel"]');
    await updateChannel.selectOption('Beta');
    await page.locator('[data-action="updates.checkNow"]').click();
    await page.waitForFunction(() =>
      /packaged Spartan Gaming application/i.test(
        document.querySelector('[data-save-status]')?.textContent || '',
      ),
    );
    if (await page.locator('[data-key="updates.adapterUpdates"]').count())
      throw new Error('desktop updates still exposed an unsupported independent adapter updater');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-category="updates"]').click();
    if ((await updateChannel.inputValue()) !== 'Beta')
      throw new Error('desktop update channel did not persist after reload');
    await page.screenshot({
      path: path.join(output, 'desktop-update-settings-interaction.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await updateChannel.selectOption('Stable');
    interactions.push('desktop:update-settings');

    await page.locator('[data-category="controllers"]').click();
    await page.locator('[data-key="controllers.playerSlots"]').selectOption('2');
    await page.locator('[data-key="controllers.deadzone"]').fill('20');
    await page.locator('[data-key="controllers.inputLatency"]').selectOption('High frequency');
    await page.goto(`${appOrigin}/input/inspector.html`, { waitUntil: 'domcontentloaded' });
    const controllerPolicy = (await page.locator('[data-policy]').innerText()).trim();
    if (controllerPolicy !== '2 active slots · 20% dead zone · high frequency polling')
      throw new Error(`controller tester did not apply saved settings: ${controllerPolicy}`);
    interactions.push('desktop:controller-tester-settings');
    await page.evaluate(
      ({ settingsKey }) => {
        const current = JSON.parse(localStorage.getItem(settingsKey) || '{}');
        localStorage.setItem(
          settingsKey,
          JSON.stringify({
            ...current,
            'controllers.playerSlots': '4',
            'controllers.deadzone': 8,
            'controllers.inputLatency': 'Automatic',
          }),
        );
      },
      { settingsKey: gamingSettingsKey },
    );
  }

  await page.screenshot({
    path: path.join(output, `${layout.name}-interaction.png`),
    fullPage: true,
    animations: 'disabled',
  });
  return interactions;
}

export async function runElectronVisualSmoke({
  output = path.join(repositoryRoot, 'out/playwright/electron'),
  baselinePath = path.join(
    repositoryRoot,
    'scripts/playwright/baselines',
    `electron-${process.platform}-${process.arch}.json`,
  ),
} = {}) {
  await mkdir(output, { recursive: true });
  const userDataDirectory = await mkdtemp(path.join(tmpdir(), 'spartan-electron-visual-'));
  const application = await electron.launch({
    args: [
      path.join(repositoryRoot, 'desktop/electron/main.mjs'),
      `--user-data-dir=${userDataDirectory}`,
    ],
    cwd: repositoryRoot,
  });
  const results = [];
  const interactions = [];
  const snapshots = {};
  try {
    const page = await application.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    if (!page.url().startsWith(`${appOrigin}/dashboard/`))
      throw new Error(`standalone app opened an unexpected URL: ${page.url()}`);

    for (const layout of ELECTRON_VISUAL_LAYOUTS) {
      await configureLayout(page, layout);
      for (const route of ELECTRON_VISUAL_ROUTES) {
        await page.goto(`${appOrigin}${route}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(
          ({ mode, navigation }) =>
            document.documentElement.dataset.spartanDeviceMode === mode &&
            document.documentElement.dataset.spartanNavigation === navigation,
          { mode: layout.name, navigation: layout.navigation },
        );
        await page.evaluate(async () => {
          await document.fonts?.ready;
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        });
        const body = (await page.locator('body').innerText()).trim();
        if (body.length < 20)
          throw new Error(`${layout.name} ${route} has no meaningful application content`);
        const runtime = await page.evaluate(() => ({
          deviceMode: document.documentElement.dataset.spartanDeviceMode,
          navigation: document.documentElement.dataset.spartanNavigation,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          containers: ['body', '.app', '.rail', '.nav', '.main'].map((selector) => {
            const element = document.querySelector(selector);
            const bounds = element?.getBoundingClientRect();
            return {
              selector,
              left: Math.round(bounds?.left ?? 0),
              right: Math.round(bounds?.right ?? 0),
              scrollWidth: element?.scrollWidth ?? 0,
              clientWidth: element?.clientWidth ?? 0,
              overflowX: element ? getComputedStyle(element).overflowX : '',
            };
          }),
          overflowElements: Array.from(document.querySelectorAll('body *'))
            .filter((element) => {
              if (element.closest('.nav')) return false;
              const bounds = element.getBoundingClientRect();
              return bounds.left < -1 || bounds.right > window.innerWidth + 1;
            })
            .slice(0, 5)
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: String(element.className).slice(0, 80),
              text: element.textContent?.trim().slice(0, 80) || '',
              left: Math.round(element.getBoundingClientRect().left),
              right: Math.round(element.getBoundingClientRect().right),
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            })),
          wideContentElements: Array.from(document.querySelectorAll('.main *'))
            .filter(
              (element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth,
            )
            .slice(0, 8)
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: String(element.className).slice(0, 80),
              text: element.textContent?.trim().slice(0, 80) || '',
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            })),
        }));
        if (runtime.deviceMode !== layout.name)
          throw new Error(
            `${layout.name} ${route} resolved unexpected device mode ${runtime.deviceMode || 'none'}`,
          );
        if (runtime.navigation !== layout.navigation)
          throw new Error(
            `${layout.name} ${route} resolved unexpected navigation ${runtime.navigation || 'none'}`,
          );
        if (runtime.horizontalOverflow)
          throw new Error(
            `${layout.name} ${route} has horizontal overflow: ${JSON.stringify(runtime)}`,
          );
        const screenshot = await page.screenshot({
          path: path.join(output, screenshotName(layout.name, route)),
          fullPage: false,
          animations: 'disabled',
        });
        const key = visualSnapshotKey(layout.name, route);
        snapshots[key] = fingerprintScreenshot(screenshot);
        results.push(
          Object.freeze({
            layout: layout.name,
            route,
            bodyLength: body.length,
            deviceMode: runtime.deviceMode,
            navigation: runtime.navigation,
            horizontalOverflow: false,
          }),
        );
      }
      interactions.push(
        ...(await checkLayoutInteraction(page, layout, output, userDataDirectory, application)),
      );
    }

    const candidate = Object.freeze({
      version: 1,
      platform: `${process.platform}-${process.arch}`,
      layouts: ELECTRON_VISUAL_LAYOUTS.map(({ name, width, height }) => ({ name, width, height })),
      routes: ELECTRON_VISUAL_ROUTES,
      snapshots,
    });
    const candidatePath = path.join(output, 'visual-baseline.json');
    await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
    const baseline = compareVisualBaseline(await readBaseline(baselinePath), candidate, {
      required: Boolean(baselinePath),
    });
    if (baseline.status === 'changed')
      throw new Error(`Electron visual baseline changed:\n${baseline.mismatches.join('\n')}`);

    return Object.freeze({
      version: 2,
      tool: 'playwright-electron',
      origin: appOrigin,
      platform: candidate.platform,
      layouts: ELECTRON_VISUAL_LAYOUTS.map((layout) => layout.name),
      routes: Object.freeze(results),
      interactions: Object.freeze(interactions),
      snapshots: Object.keys(snapshots).length,
      baseline: Object.freeze({ ...baseline, path: baselinePath, candidatePath }),
      status: 'passed',
      output,
    });
  } finally {
    await application.close();
    await rm(userDataDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runElectronVisualSmoke({ baselinePath: process.argv.includes('--candidate') ? null : undefined })
    .then((report) => console.log(JSON.stringify(report)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
