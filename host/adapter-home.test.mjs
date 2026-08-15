import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAdapterHome, resolveBundledSeedRoot } from './adapter-home.mjs';

test('adapter home honors the SPARTAN_ADAPTER_HOME override first', () => {
  assert.equal(
    resolveAdapterHome({
      platform: 'linux',
      env: { SPARTAN_ADAPTER_HOME: '/custom/adapters' },
      osHome: '/home/tester',
    }),
    '/custom/adapters',
  );
  assert.equal(
    resolveAdapterHome({
      platform: 'win32',
      env: { SPARTAN_ADAPTER_HOME: 'C:\\adapters' },
      osHome: 'C:\\Users\\tester',
    }),
    'C:\\adapters',
  );
});

test('adapter home resolves a per-user directory per platform', () => {
  assert.equal(
    resolveAdapterHome({ platform: 'linux', env: {}, osHome: '/home/tester' }),
    '/home/tester/.config/spartan-gaming/adapters',
  );
  assert.equal(
    resolveAdapterHome({ platform: 'win32', env: {}, osHome: 'C:\\Users\\tester' }),
    'C:\\Users\\tester\\AppData\\Local\\SpartanGaming\\adapters',
  );
  assert.equal(
    resolveAdapterHome({ platform: 'darwin', env: {}, osHome: '/Users/tester' }),
    '/Users/tester/Library/Application Support/Spartan Gaming/adapters',
  );
});

test('bundled seed root resolves inside the app root', () => {
  assert.equal(
    resolveBundledSeedRoot({ appRoot: '/opt/spartan-gaming', platform: 'linux' }),
    '/opt/spartan-gaming/seed',
  );
});
