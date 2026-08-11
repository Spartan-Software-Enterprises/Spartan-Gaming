#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoot = path.join(repositoryRoot, 'src/frontend');
const defaultOutputRoot = path.join(repositoryRoot, 'out/spartan-frontend');
const PUBLIC_DIRECTORIES = Object.freeze(['providers', 'emulators', 'games']);
const ENTRYPOINTS = Object.freeze({
  dashboard: '/dashboard/',
  player: '/player/',
  settings: '/settings/',
  providers: '/providers/',
  emulation: '/emulation/',
  adapters: '/adapters/',
  host: '/host/',
  diagnostics: '/diagnostics/',
});

function absolute(value, fallback) {
  return path.resolve(value || fallback);
}
function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function buildFrontendDistribution({
  outputRoot = defaultOutputRoot,
  source = sourceRoot,
  publicRoot = repositoryRoot,
} = {}) {
  const output = absolute(outputRoot, defaultOutputRoot);
  const sourceDirectory = absolute(source, sourceRoot);
  const publicDirectory = absolute(publicRoot, repositoryRoot);
  if (output === repositoryRoot) throw new Error('frontend output must not be the repository root');
  if (
    output === sourceDirectory ||
    isInside(output, sourceDirectory) ||
    isInside(sourceDirectory, output)
  )
    throw new Error('frontend output must not contain or overwrite the source directory');
  await rm(output, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  await mkdir(output, { recursive: true });
  await cp(sourceDirectory, output, { recursive: true });
  for (const directory of PUBLIC_DIRECTORIES)
    await cp(path.join(publicDirectory, directory), path.join(output, directory), {
      recursive: true,
    });
  await cp(path.join(publicDirectory, 'favicon.ico'), path.join(output, 'favicon.ico'));
  const manifest = Object.freeze({
    schemaVersion: 1,
    product: 'Spartan Gaming',
    artifact: 'static-frontend',
    entrypoints: ENTRYPOINTS,
    publicCatalogs: Object.freeze([
      '/providers/catalog.json',
      '/emulators/catalog.json',
      '/games/catalog.json',
    ]),
    serviceWorker: '/service-worker.mjs',
  });
  await writeFile(
    path.join(output, 'spartan-frontend-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  const required = [
    ...Object.values(ENTRYPOINTS).map((entry) => entry.slice(1, -1) + '/index.html'),
    'service-worker.mjs',
    'providers/catalog.json',
    'emulators/catalog.json',
    'games/catalog.json',
    'spartan-frontend-manifest.json',
  ];
  for (const relative of required) {
    try {
      await readFile(path.join(output, relative));
    } catch {
      throw new Error(`frontend distribution is missing ${relative}`);
    }
  }
  return Object.freeze({ output, manifest, files: required.length });
}

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildFrontendDistribution({ outputRoot: argument('out', defaultOutputRoot) })
    .then((result) =>
      console.log(
        JSON.stringify({
          service: 'spartan-frontend-build',
          output: result.output,
          files: result.files,
          manifest: path.join(result.output, 'spartan-frontend-manifest.json'),
        }),
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
