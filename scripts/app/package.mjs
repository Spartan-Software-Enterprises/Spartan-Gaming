#!/usr/bin/env node
import {cp, mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {existsSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PLATFORM_ALIASES = Object.freeze({windows: 'win32', win32: 'win32', macos: 'darwin', mac: 'darwin', darwin: 'darwin', linux: 'linux'});
const PLATFORMS = Object.freeze(['win32', 'darwin', 'linux']);
// The static pages import shared frontend modules by relative URL at runtime.
// Ship the complete frontend runtime tree so packaged pages do not degrade to
// HTML-only shells when a secondary module is requested.
const RUNTIME_DIRECTORIES = Object.freeze(['host', 'scripts/frontend', 'src/frontend']);
const INSTALLER_KINDS = Object.freeze({linux: ['portable', 'deb'], darwin: ['portable', 'dmg-spec'], win32: ['portable', 'exe-spec']});
const PLATFORM_NAMES = Object.freeze({linux: 'linux', darwin: 'darwin', win32: 'win32'});

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required`); return value.trim(); }
function platform(value) { const selected = PLATFORM_ALIASES[String(value || '').toLowerCase()]; if (!selected) throw new TypeError(`unsupported app package platform: ${value}`); return selected; }
function commandAvailable(program) { const result = spawnSync(program, ['--version'], {stdio: 'ignore', shell: false}); return !result.error && result.status === 0; }
function findExecutable(candidates) { for (const candidate of candidates) { const probes = path.isAbsolute(candidate) ? [candidate] : (process.env.PATH || '').split(path.delimiter).filter(Boolean).map(directory => path.join(directory, candidate)); for (const full of probes) { try { if (lstatSync(full).isFile()) return full; } catch { /* keep probing */ } } } return null; }
function hostPlatform() { return PLATFORM_ALIASES[process.platform] || process.platform; }
function platformVendorPath(kind, target) { const root = path.join(repositoryRoot, 'vendor', kind); const targeted = path.join(root, PLATFORM_NAMES[target] || target); return existsSync(targeted) ? targeted : root; }
function defaultPackagingInputs(target = hostPlatform()) {
  const bundledChromium = platformVendorPath('chromium', target);
  const chromiumNames = target === 'win32' ? ['chrome.exe', 'chromium.exe'] : target === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'chromium'] : ['chrome', 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
  const bundledChrome = target === 'win32' ? path.join(bundledChromium, 'chrome.exe') : target === 'darwin' ? path.join(bundledChromium, 'Chromium') : path.join(bundledChromium, 'chrome');
  const chromiumBinary = process.env.SPARTAN_CHROMIUM_BINARY || (existsSync(bundledChrome) ? bundledChromium : target === hostPlatform() ? findExecutable(chromiumNames) : null);
  const nodeBinary = target === hostPlatform() ? process.execPath : null;
  return {nodeBinary, chromiumBinary, dependenciesDir: existsSync(path.join(repositoryRoot, 'node_modules')) ? path.join(repositoryRoot, 'node_modules') : null};
}

export function parseAppPackageArgs(argv = process.argv.slice(2)) {
  const options = {platform: null, sourceRoot: repositoryRoot, outRoot: '', frontendDir: '', seedDir: null, nativeAddon: null, emulatorDir: null, nodeBinary: null, chromiumBinary: null, dependenciesDir: null, version: '0.1.0', installers: [], execute: false, help: false};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--execute') options.execute = true;
    else if (argument === '--platform') options.platform = argv[++index];
    else if (argument === '--source-root') options.sourceRoot = argv[++index];
    else if (argument === '--out-root') options.outRoot = argv[++index];
    else if (argument === '--frontend-dir') options.frontendDir = argv[++index];
    else if (argument === '--seed-dir') options.seedDir = argv[++index];
    else if (argument === '--native-addon') options.nativeAddon = argv[++index];
    else if (argument === '--emulator-dir') options.emulatorDir = argv[++index];
    else if (argument === '--node-binary') options.nodeBinary = argv[++index];
    else if (argument === '--chromium-binary') options.chromiumBinary = argv[++index];
    else if (argument === '--dependencies-dir') options.dependenciesDir = argv[++index];
    else if (argument === '--version') options.version = argv[++index];
    else if (argument === '--installer') options.installers.push(argv[++index]);
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`unknown app package option: ${argument}`);
  }
  return Object.freeze(options);
}

function resolvePath(value, fallback) { return path.resolve(value || fallback); }
const LINUX_RUNTIME_DEPENDENCIES = Object.freeze(['libnss3', 'libatk-bridge2.0-0', 'libdrm2', 'libxcomposite1', 'libxdamage1', 'libxrandr2', 'libgbm1', 'libgtk-3-0', 'libasound2']);

function installerDependencyManifest(plan) {
  const system = plan.platform === 'linux' ? [...LINUX_RUNTIME_DEPENDENCIES, ...(plan.emulators ? ['wine64', 'playonlinux'] : [])] : [];
  return {schemaVersion: 1, product: 'Spartan Gaming', platform: plan.platform, bundled: ['node', 'chromium', ...(plan.dependencies ? ['node_modules'] : []), ...(plan.emulators ? ['emulator runtimes'] : [])], system, updatePolicy: 'the native package manager installs/upgrades declared dependencies; the bundled helper can refresh them manually; user credentials and game files remain outside the bundle'};
}

function installerSupportFiles(plan) {
  const manifest = JSON.stringify(installerDependencyManifest(plan), null, 2) + '\n';
  const linux = `#!/usr/bin/env bash\nset -euo pipefail\nif [[ "\${1:-}" == "--post-install" && "\${SPARTAN_SKIP_DEPENDENCY_UPDATE:-0}" != "1" ]]; then\n  if command -v apt-get >/dev/null 2>&1; then\n    export DEBIAN_FRONTEND=noninteractive\n    apt-get update\n    apt-get install -y ${installerDependencyManifest(plan).system.join(' ')}\n  else\n    echo "Spartan Gaming: apt-get is unavailable; install dependencies listed in dependencies.json." >&2\n  fi\nfi\nif [[ "\${1:-}" != "--post-install" ]]; then\n  echo "Spartan Gaming dependencies: install completed. Set SPARTAN_SKIP_DEPENDENCY_UPDATE=1 to skip package index refresh."\nfi\n`;
  const mac = `#!/bin/sh\nset -eu\ncommand -v sw_vers >/dev/null 2>&1 || { echo "This installer must run on macOS." >&2; exit 1; }\nif ! xcode-select -p >/dev/null 2>&1; then\n  echo "Install the Xcode Command Line Tools, then rerun Spartan Gaming." >&2\n  exit 1\nfi\necho "Spartan Gaming is self-contained on macOS; no runtime package manager dependencies are required."\n`;
  const windows = `# Spartan Gaming dependency verifier\n$ErrorActionPreference = 'Stop'\nif (-not $env:OS -or $env:OS -ne 'Windows_NT') { throw 'This installer must run on Windows.' }\nWrite-Host 'Spartan Gaming is self-contained on Windows; bundled Node and Chromium require no package-manager install.'\n`;
  return {manifest, linux, mac, windows};
}

export function createAppBundlePlan({platform: selectedPlatform, sourceRoot = repositoryRoot, outRoot, frontendDir, seedDir = null, nativeAddon = null, emulatorDir = null, nodeBinary = null, chromiumBinary = null, dependenciesDir = null, version = '0.1.0', installers = []} = {}) {
  const target = platform(selectedPlatform);
  const source = path.resolve(sourceRoot);
  const frontend = resolvePath(frontendDir, path.join(source, 'out/spartan-frontend'));
  const seed = seedDir ? resolvePath(seedDir, null) : null;
  const addon = nativeAddon ? resolvePath(nativeAddon, null) : null;
  const emulators = emulatorDir ? resolvePath(emulatorDir, null) : null;
  const node = nodeBinary ? resolvePath(nodeBinary, null) : null;
  const chromium = chromiumBinary ? resolvePath(chromiumBinary, null) : null;
  const dependencies = dependenciesDir ? resolvePath(dependenciesDir, null) : null;
  const out = resolvePath(outRoot, path.join(source, 'out/spartan-app', target));
  const requested = installers.length ? installers : INSTALLER_KINDS[target];
  const known = new Set(INSTALLER_KINDS[target]);
  for (const installer of requested) if (!known.has(installer)) throw new Error(`unsupported ${target} installer: ${installer}`);
  const runtime = RUNTIME_DIRECTORIES.map(relative => path.join(source, relative));
  const payload = Object.freeze({runtime, frontend, seed, addon, emulators, node, chromium, dependencies, version: required(version, 'version')});
  const bundle = path.join(out, 'bundle');
  const spec = Object.freeze({bundle, portable: path.join(out, `spartan-gaming-${version}-${target}-portable.tar.gz`), deb: path.join(out, `spartan-gaming_${version}_amd64.deb`), dmgSpec: path.join(out, 'spartan-gaming.dmg.spec.json'), exeSpec: path.join(out, 'spartan-gaming.windows.spec.json'), debDir: path.join(out, '.deb-build')});
  return Object.freeze({platform: target, source, frontend, seed, addon, emulators, node, chromium, dependencies, version, payload, bundle, spec, installers: Object.freeze(requested)});
}

async function statExists(check, kind) {
  let info;
  try { info = await stat(check); } catch (error) { if (error && error.code === 'ENOENT') throw new Error(`required input is not available: ${check}`); throw error; }
  const isDirectory = info.isDirectory();
  if (kind === 'directory' && !isDirectory) throw new Error(`required input must be a directory: ${check}`);
  if (kind === 'file' && isDirectory) throw new Error(`required input must be a file: ${check}`);
}

export async function buildAppBundle(plan) {
  for (const check of [plan.payload.frontend, ...plan.payload.runtime, ...(plan.seed ? [plan.seed] : []), ...(plan.emulators ? [plan.emulators] : [])]) await statExists(check, 'directory');
  if (plan.addon) await statExists(plan.addon, 'file');
  if (plan.node) await statExists(plan.node, 'file');
  if (plan.chromium) await statExists(plan.chromium);
  if (plan.dependencies) await statExists(plan.dependencies, 'directory');
  await rm(plan.bundle, {recursive: true, force: true});
  for (const relative of RUNTIME_DIRECTORIES) await cp(path.join(plan.source, relative), path.join(plan.bundle, relative), {recursive: true});
  await cp(plan.payload.frontend, path.join(plan.bundle, 'public'), {recursive: true});
  if (plan.seed) await cp(plan.seed, path.join(plan.bundle, 'seed'), {recursive: true});
  if (plan.emulators) await cp(plan.emulators, path.join(plan.bundle, 'emulators'), {recursive: true});
  if (plan.addon) { await mkdir(path.join(plan.bundle, 'native'), {recursive: true}); await cp(plan.addon, path.join(plan.bundle, 'native', path.basename(plan.addon))); }
  if (plan.node) { await mkdir(path.join(plan.bundle, 'runtime'), {recursive: true}); await cp(plan.node, path.join(plan.bundle, 'runtime', plan.platform === 'win32' ? 'node.exe' : 'node')); }
  if (plan.chromium) { await mkdir(path.join(plan.bundle, 'runtime', 'chromium'), {recursive: true}); const chromiumInfo = await stat(plan.chromium); if (chromiumInfo.isDirectory()) await cp(plan.chromium, path.join(plan.bundle, 'runtime', 'chromium'), {recursive: true}); else await cp(plan.chromium, path.join(plan.bundle, 'runtime', plan.platform === 'win32' ? 'chrome.exe' : plan.platform === 'darwin' ? 'Chromium' : 'chrome')); }
  if (plan.dependencies) await cp(plan.dependencies, path.join(plan.bundle, 'node_modules'), {recursive: true});
  const support = installerSupportFiles(plan);
  await mkdir(path.join(plan.bundle, 'install'), {recursive: true});
  await writeFile(path.join(plan.bundle, 'install', 'dependencies.json'), support.manifest, 'utf8');
  await writeFile(path.join(plan.bundle, 'install', 'install-linux.sh'), support.linux, {mode: 0o755});
  await writeFile(path.join(plan.bundle, 'install', 'install-macos.sh'), support.mac, {mode: 0o755});
  await writeFile(path.join(plan.bundle, 'install', 'install-windows.ps1'), support.windows, 'utf8');
  const chromiumEntry = plan.platform === 'win32' ? 'runtime/chromium/chrome.exe' : plan.platform === 'darwin' ? 'runtime/chromium/Chromium' : 'runtime/chromium/chrome';
  const manifest = Object.freeze({schemaVersion: 1, product: 'Spartan Gaming', version: plan.version, platform: plan.platform, buildHost: hostPlatform(), runtime: plan.node ? 'bundled node >=20' : 'node >=20', entrypoint: 'host/app-host.mjs', publicRoot: 'public', emulatorRoot: plan.emulators ? 'emulators' : null, compatibility: plan.platform === 'linux' && plan.emulators ? {wine: 'system dependency', playOnLinux: 'system dependency'} : null, installerRoot: 'install', dependencyManifest: 'install/dependencies.json', seedRoot: plan.seed ? 'seed' : null, nativeAddon: plan.addon ? `native/${path.basename(plan.addon)}` : null, bundledNode: plan.node ? `runtime/${plan.platform === 'win32' ? 'node.exe' : 'node'}` : null, bundledChromium: plan.chromium ? chromiumEntry : null, bundledDependencies: plan.dependencies ? 'node_modules' : null, defaultHost: '127.0.0.1', defaultPort: 4173, installers: Object.freeze([...plan.installers])});
  await writeFile(path.join(plan.bundle, 'spartan-app.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const launcher = launcherScript(plan);
  await writeFile(path.join(plan.bundle, 'spartan-gaming'), launcher, {mode: 0o755});
  return Object.freeze({bundle: plan.bundle, manifest, files: RUNTIME_DIRECTORIES.length + (plan.seed ? 1 : 0) + (plan.emulators ? 1 : 0) + (plan.addon ? 1 : 0) + (plan.node ? 1 : 0) + (plan.chromium ? 1 : 0) + (plan.dependencies ? 1 : 0) + 3});
}

function launcherScript(plan) {
  const seedArgs = plan.seed ? `--seed-root "\${SCRIPT_DIR}/seed" --platform ${plan.platform}` : '';
  const resolveDir = `SOURCE="\${BASH_SOURCE[0]}"; while [ -L "\$SOURCE" ]; do DIR="\$(cd -P "\$(dirname "\$SOURCE")" && pwd)"; SOURCE="\$(readlink "\$SOURCE")"; [[ \$SOURCE != /* ]] && SOURCE="\$DIR/\$SOURCE"; done; SCRIPT_DIR="\$(cd -P "\$(dirname "\$SOURCE")" && pwd)"`;
  const chromiumName = plan.platform === 'darwin' ? 'Chromium' : 'chrome';
  const body = `#!/usr/bin/env bash\nset -euo pipefail\n${resolveDir}\nDEFAULT_ADAPTER_HOME="${adapterHomeDefault(plan.platform)}"\nNODE_BIN="\${SCRIPT_DIR}/runtime/node"\n[ -x "\$NODE_BIN" ] || NODE_BIN="node"\nCHROMIUM_BIN="\${SCRIPT_DIR}/runtime/chromium/${chromiumName}"\n[ -x "\$CHROMIUM_BIN" ] || CHROMIUM_BIN="\${SPARTAN_CHROMIUM_BINARY:-}"\nexec "\$NODE_BIN" "\${SCRIPT_DIR}/host/desktop-shell.mjs" --root "\${SCRIPT_DIR}/public" --public-root "\${SCRIPT_DIR}/public" --adapter-home "\${SPARTAN_ADAPTER_HOME:-\$DEFAULT_ADAPTER_HOME}" --chromium-binary "\$CHROMIUM_BIN" --port 4173 ${seedArgs}\n`;
  return plan.platform === 'win32' ? `@echo off\r\nset "NODE_BIN=%~dp0runtime\\node.exe"\r\nif not exist "%NODE_BIN%" set "NODE_BIN=node"\r\nset "CHROMIUM_BIN=%~dp0runtime\\chromium\\chrome.exe"\r\nif not exist "%CHROMIUM_BIN%" set "CHROMIUM_BIN=%SPARTAN_CHROMIUM_BINARY%"\r\n"%NODE_BIN%" "%~dp0host\\desktop-shell.mjs" --root "%~dp0public" --public-root "%~dp0public" --chromium-binary "%CHROMIUM_BIN%" --port 4173\r\n` : body;
}

function adapterHomeDefault(platform) { return platform === 'win32' ? '%LOCALAPPDATA%\\SpartanGaming\\adapters' : platform === 'darwin' ? '$HOME/Library/Application Support/Spartan Gaming/adapters' : '$HOME/.config/spartan-gaming/adapters'; }

function command(command, args, cwd, label) {
  if (!commandAvailable(command)) throw new Error(`required app installer tool is unavailable: ${command}`);
  const result = spawnSync(command, args, {cwd, stdio: 'inherit', shell: false});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${label} exited with status ${result.status}`);
}

export function createPortableInstallerPlan(plan) { return Object.freeze({kind: 'portable', target: plan.spec.portable, cwd: plan.bundle}); }
export function createInstallerPlan(plan) {
  if (plan.platform === 'linux') {
    const control = path.join(plan.spec.debDir, 'DEBIAN/control');
    const data = path.join(plan.spec.debDir, `opt/spartan-gaming`);
    const portables = plan.installers.includes('deb') ? [Object.freeze({kind: 'portable', target: plan.spec.portable, cwd: plan.bundle}), Object.freeze({kind: 'deb', target: plan.spec.deb, root: plan.spec.debDir, control, data, bundle: plan.bundle})] : [Object.freeze({kind: 'portable', target: plan.spec.portable, cwd: plan.bundle})];
    return portables.filter(entry => plan.installers.includes(entry.kind));
  }
  if (plan.platform === 'darwin') {
    const portable = Object.freeze({kind: 'portable', target: plan.spec.portable, cwd: plan.bundle});
    const spec = Object.freeze({kind: 'dmg-spec', target: plan.spec.dmgSpec, bundle: plan.bundle, platform: 'darwin'});
    return [portable, spec].filter(entry => plan.installers.includes(entry.kind));
  }
  if (plan.platform === 'win32') {
    const portable = Object.freeze({kind: 'portable', target: plan.spec.portable, cwd: plan.bundle});
    const spec = Object.freeze({kind: 'exe-spec', target: plan.spec.exeSpec, bundle: plan.bundle, platform: 'win32'});
    return [portable, spec].filter(entry => plan.installers.includes(entry.kind));
  }
  throw new Error(`unsupported app installer platform: ${plan.platform}`);
}

export async function executeInstallerPlan(installers, plan) {
  const results = [];
  for (const installer of installers) {
    if (installer.kind === 'portable') {
      command('tar', ['--exclude=spartan-gaming', '-czf', installer.target, '.'], installer.cwd, 'portable archive');
      results.push(Object.freeze({kind: 'portable', target: installer.target}));
    } else if (installer.kind === 'deb') {
      await rm(installer.root, {recursive: true, force: true});
      await mkdir(path.dirname(installer.control), {recursive: true});
      await mkdir(installer.data, {recursive: true});
      const dependencies = [...(plan.node ? [] : ['nodejs (>= 20)']), ...installerDependencyManifest(plan).system];
      const control = ['Package: spartan-gaming', 'Version: ' + plan.version, 'Section: games', 'Priority: optional', 'Architecture: amd64', 'Maintainer: Spartan Software Enterprises <support@example.invalid>', ...(dependencies.length ? ['Depends: ' + dependencies.join(', ')] : []), 'Description: All-in-one cloud gaming, streaming, and emulation desktop client.', ''].join('\n');
      await writeFile(installer.control, control, 'utf8');
      // Preserve dependency-bin symlinks while staging the Debian payload;
      // resolving them during a recursive copy can make Node treat a link as
      // a copy into its own source tree.
      await cp(plan.bundle, installer.data, {recursive: true, verbatimSymlinks: true});
      const manifest = JSON.parse(await readFile(path.join(plan.bundle, 'spartan-app.json'), 'utf8'));
      const postinst = '#!/bin/sh\nset -e\nln -sf /opt/spartan-gaming/spartan-gaming /usr/local/bin/spartan-gaming\n# Dependencies are installed/upgraded by apt before this hook; do not invoke apt while its lock is held.\n';
      await writeFile(path.join(path.dirname(installer.control), 'postinst'), postinst, {mode: 0o755});
      const prerm = '#!/bin/sh\nrm -f /usr/local/bin/spartan-gaming\n';
      await writeFile(path.join(path.dirname(installer.control), 'prerm'), prerm, {mode: 0o755});
      command('dpkg-deb', ['--build', '--root-owner-group', installer.root, installer.target], process.cwd(), 'deb build');
      results.push(Object.freeze({kind: 'deb', target: installer.target, manifest}));
    } else if (installer.kind === 'dmg-spec' || installer.kind === 'exe-spec') {
      const spec = Object.freeze({schemaVersion: 1, product: 'Spartan Gaming', version: plan.version, platform: installer.platform, bundle: installer.bundle, dependencyManifest: path.join(installer.bundle, 'install', 'dependencies.json'), installHelper: installer.platform === 'darwin' ? path.join(installer.bundle, 'install', 'install-macos.sh') : path.join(installer.bundle, 'install', 'install-windows.ps1'), note: 'Run the platform installer on its native OS; the bundled helper verifies or installs declared prerequisites before first launch.'});
      await writeFile(installer.target, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
      results.push(Object.freeze({kind: installer.kind, target: installer.target}));
    }
  }
  return results;
}

function print(plan, json) {
  if (json) { console.log(JSON.stringify(plan, null, 2)); return; }
  console.log(`Spartan Gaming app package plan (${plan.platform})`);
  console.log(`frontend: ${plan.frontend}`); console.log(`seed: ${plan.seed || 'none'}`); console.log(`native addon: ${plan.addon || 'none'}`);
  console.log(`bundle: ${plan.bundle}`); for (const installer of plan.installers) console.log(`installer: ${installer}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '')) {
  (async () => {
    try {
      const options = parseAppPackageArgs(process.argv.slice(2));
      if (options.help) { console.log('Usage: npm run app:package -- --platform linux|windows|macos [--frontend-dir PATH] [--seed-dir PATH] [--emulator-dir PATH] [--native-addon PATH] [--node-binary PATH] [--chromium-binary PATH] [--dependencies-dir PATH] [--version VERSION] [--installer portable|deb|dmg-spec|exe-spec] [--execute]'); process.exit(0); }
      const target = platform(options.platform || process.platform);
      const defaults = defaultPackagingInputs(target);
      const sourceBase = options.sourceRoot || repositoryRoot;
      const targetEmulators = path.join(sourceBase, 'vendor/emulators', target);
      const sharedEmulators = path.join(sourceBase, 'vendor/emulators');
      const emulatorDir = options.emulatorDir || (existsSync(targetEmulators) ? targetEmulators : target === hostPlatform() && existsSync(sharedEmulators) ? sharedEmulators : null);
      const plan = createAppBundlePlan({platform: target, sourceRoot: options.sourceRoot, outRoot: options.outRoot, frontendDir: options.frontendDir, seedDir: options.seedDir, emulatorDir, nativeAddon: options.nativeAddon, nodeBinary: options.nodeBinary || defaults.nodeBinary, chromiumBinary: options.chromiumBinary || defaults.chromiumBinary, dependenciesDir: options.dependenciesDir || defaults.dependenciesDir, version: options.version, installers: options.installers});
      if (options.execute && (!plan.node || !plan.chromium)) throw new Error(`a runnable ${target} release requires target-platform Node and Chromium binaries; build on ${target} or pass --node-binary and --chromium-binary explicitly`);
      print(plan, options.json);
      const summary = await buildAppBundle(plan);
      const installers = options.execute ? await executeInstallerPlan(createInstallerPlan(plan), plan) : createInstallerPlan(plan);
      console.log(JSON.stringify({service: 'spartan-app-package', platform: plan.platform, bundle: summary.bundle, files: summary.files, installers: installers.map(entry => entry.target)}, null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  })();
}
