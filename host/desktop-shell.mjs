import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAppHostServer} from './app-host.mjs';
import {resolveAdapterHome} from './adapter-home.mjs';

const CHROMIUM_CANDIDATES = Object.freeze(['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']);

function readArgument(name, fallback) { const index = process.argv.indexOf(`--${name}`); return index < 0 ? fallback : process.argv[index + 1]; }
function findOnPath(candidate) {
  for (const entry of (process.env.PATH || '').split(path.delimiter)) {
    if (!entry) continue;
    try { const full = path.resolve(entry, candidate); if (existsSync(full)) return full; } catch { /* keep probing */ }
  }
  return null;
}

/** Resolve a Chromium-based desktop shell binary, honoring an explicit override first. */
export function resolveChromiumBinary(binary = '', {exists = existsSync, find = findOnPath, candidates = CHROMIUM_CANDIDATES} = {}) {
  let found = null;
  const given = String(binary || '').trim();
  if (given) found = path.resolve(given);
  else { for (const candidate of candidates) { const executable = find(candidate); if (executable) { found = executable; break; } } }
  return found && exists(found) ? found : null;
}

function waitForHealth({host, port, attempts = 100, intervalMs = 100}) {
  const url = `http://${host}:${port}/health`;
  const poll = async () => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try { const response = await fetch(url); if (response.ok) return true; } catch { /* server not ready */ }
      await new Promise(resolveWait => setTimeout(resolveWait, intervalMs));
    }
    return false;
  };
  return poll();
}

export function createDesktopShellPlan({root, publicRoot, seedRoot = null, adapterHome = resolveAdapterHome(), platform = process.platform, host = '127.0.0.1', port = 4173, chromiumBinary = '', contextScript = null, resolveBinary = resolveChromiumBinary} = {}) {
  const binary = resolveBinary(chromiumBinary);
  if (!binary) throw new Error('no Chromium-based desktop shell found; install chromium or set SPARTAN_CHROMIUM_BINARY');
  const args = [`--app=http://${host}:${port}/dashboard/?startup=1`, '--no-first-run', '--no-default-browser-check'];
  if (typeof process.getuid === 'function' && process.getuid() === 0) args.push('--no-sandbox');
  if (process.env.SPARTAN_DISABLE_CHROMIUM_SANDBOX === '1' && !args.includes('--no-sandbox')) args.push('--no-sandbox');
  return Object.freeze({host, port, platform, binary, args: Object.freeze(args), contextScript, root: root ? path.resolve(root) : null, publicRoot: publicRoot ? path.resolve(publicRoot) : null, seedRoot: seedRoot ? path.resolve(seedRoot) : null});
}

/**
 * Start the loopback app host and open the desktop shell window on top of it.
 * When the window closes, the host is shut down too.
 */
export async function launchDesktopSession({root, publicRoot, seedRoot = null, adapterHome = resolveAdapterHome(), platform = process.platform, host = '127.0.0.1', port = 4173, chromiumBinary = '', hostFactory = createAppHostServer, spawnImpl = spawn, contextScript = null, installSeed = true, healthCheck = waitForHealth} = {}) {
  let seedContext = contextScript;
  if (seedRoot) {
    const {createSeedContextScript, runSeedInstall} = await import('./adapter-seed.mjs');
    if (installSeed) { try { await runSeedInstall({seedRoot, installRoot: adapterHome, platform, apply: true}); } catch (error) { console.error(`seed install skipped: ${error.message}`); } }
    seedContext = await createSeedContextScript({seedRoot, platform});
  }
  const appHost = hostFactory({host, port, root, publicRoot, contextScript: seedContext, agentEndpoint: null, adapterHome});
  await appHost.listen();
  const ready = await healthCheck({host, port});
  if (!ready) { await appHost.close(); throw new Error('app host did not become healthy'); }
  const plan = createDesktopShellPlan({root, publicRoot, seedRoot, adapterHome, host, port, platform, chromiumBinary, contextScript: seedContext});
  const child = spawnImpl(plan.binary, plan.args, {stdio: 'inherit', shell: false});
  const closed = new Promise(resolveClosed => child.once?.('exit', () => resolveClosed(true)));
  return Object.freeze({
    plan,
    child,
    async close() { if (child && !child.killed) child.kill?.(); await appHost.close(); },
    whenExited: closed.then(() => appHost.close()),
  });
}

function printUsage() {
  console.log('Usage: node host/desktop-shell.mjs --root <frontend-dir> [--public-root PATH] [--seed-root PATH] [--adapter-home PATH] [--platform linux|win32|darwin] [--port N] [--chromium-binary PATH]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      if (args.includes('--help') || args.includes('-h')) { printUsage(); return; }
      const session = await launchDesktopSession({
        root: path.resolve(readArgument('root', process.cwd())),
        publicRoot: path.resolve(readArgument('public-root', path.resolve(readArgument('root', process.cwd()), 'public'))),
        seedRoot: readArgument('seed-root', null),
        adapterHome: readArgument('adapter-home', resolveAdapterHome()),
        platform: readArgument('platform', process.platform),
        port: Number(readArgument('port', 4173)),
        chromiumBinary: readArgument('chromium-binary', process.env.SPARTAN_CHROMIUM_BINARY || ''),
      });
      console.log(JSON.stringify({service: 'spartan-desktop-shell', url: `http://${session.plan.host}:${session.plan.port}/dashboard/?startup=1`, binary: session.plan.binary, platform: session.plan.platform}));
      session.child.once('exit', () => { console.log('desktop shell window closed'); process.exitCode = 0; });
      process.on('SIGINT', () => { session.close().finally(() => process.exit(0)); });
      process.on('SIGTERM', () => { session.close().finally(() => process.exit(0)); });
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  })();
}
