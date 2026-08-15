import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  resolveChromiumBinary,
  createDesktopShellPlan,
  launchDesktopSession,
} from './desktop-shell.mjs';

test('desktop shell resolves a Chromium binary from an override or PATH candidates', () => {
  assert.equal(
    resolveChromiumBinary('/opt/fake/chromium', { exists: () => true }),
    '/opt/fake/chromium',
  );
  assert.equal(resolveChromiumBinary('/opt/missing/chromium'), null);
  assert.equal(resolveChromiumBinary('', { exists: () => true, find: () => null }), null);
  assert.equal(
    resolveChromiumBinary('', { exists: () => true, find: (candidate) => `/usr/bin/${candidate}` }),
    '/usr/bin/chromium',
  );
});

test('desktop shell plan targets the loopback app URL in app mode', () => {
  const plan = createDesktopShellPlan({
    host: '127.0.0.1',
    port: 4411,
    platform: 'linux',
    resolveBinary: () => '/opt/fake/chromium',
  });
  assert.equal(plan.binary, '/opt/fake/chromium');
  assert.ok(plan.args[0].startsWith('--app=http://127.0.0.1:4411/dashboard/?startup=1'));
  assert.ok(plan.args.includes('--no-first-run'));
  assert.ok(plan.args.includes('--no-default-browser-check'));
});

test('desktop shell exposes an explicit sandbox compatibility switch', () => {
  const previous = process.env.SPARTAN_DISABLE_CHROMIUM_SANDBOX;
  process.env.SPARTAN_DISABLE_CHROMIUM_SANDBOX = '1';
  try {
    assert.ok(
      createDesktopShellPlan({
        platform: 'linux',
        resolveBinary: () => '/opt/fake/chromium',
      }).args.includes('--no-sandbox'),
    );
  } finally {
    if (previous === undefined) delete process.env.SPARTAN_DISABLE_CHROMIUM_SANDBOX;
    else process.env.SPARTAN_DISABLE_CHROMIUM_SANDBOX = previous;
  }
});

test('desktop shell fails closed without a usable Chromium binary', () => {
  assert.throws(
    () => createDesktopShellPlan({ resolveBinary: () => null }),
    /no Chromium-based desktop shell/,
  );
});

test('desktop session starts the host, opens the window, and closes the host with it', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'spartan-shell-'));
  const fakeBinary = join(root, 'chromium');
  await fs.writeFile(fakeBinary, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const events = [];
  const fakeHost = {
    listen: async () => {
      events.push('listen');
      return { address: '127.0.0.1', port: 4412 };
    },
    close: async () => {
      events.push('close');
    },
  };
  const fakeChild = new EventEmitter();
  fakeChild.killed = false;
  fakeChild.kill = () => {
    fakeChild.killed = true;
    events.push('kill');
  };
  const session = await launchDesktopSession({
    root: '/tmp/root',
    publicRoot: '/tmp/public',
    host: '127.0.0.1',
    port: 4412,
    platform: 'linux',
    chromiumBinary: fakeBinary,
    hostFactory: () => fakeHost,
    spawnImpl: () => fakeChild,
    healthCheck: async () => true,
  });
  assert.ok(events.includes('listen'));
  assert.equal(session.plan.binary, fakeBinary);
  assert.ok(session.plan.args[0].includes(':4412/'));
  await session.close();
  assert.ok(events.includes('kill'));
  assert.ok(events.includes('close'));
  await fs.rm(root, { recursive: true, force: true });
});

test('desktop session aborts and closes the host when health never reports ready', async () => {
  const events = [];
  const fakeHost = {
    listen: async () => {
      events.push('listen');
    },
    close: async () => {
      events.push('close');
    },
  };
  await assert.rejects(
    () =>
      launchDesktopSession({
        root: '/tmp/root',
        publicRoot: '/tmp/public',
        platform: 'linux',
        chromiumBinary: '/opt/fake/chromium',
        hostFactory: () => fakeHost,
        healthCheck: async () => false,
        resolveBinary: () => '/opt/fake/chromium',
      }),
    /did not become healthy/,
  );
  assert.ok(events.includes('close'));
});
