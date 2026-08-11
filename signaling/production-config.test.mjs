import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeProductionConfig,
  resolveConfiguredSecret,
  resolveProductionConfig,
} from './production-config.mjs';

const valid = {
  secret: 's'.repeat(32),
  adminSecret: 'a'.repeat(32),
  turnSecret: 't'.repeat(32),
  tlsKey: '/run/secrets/key',
  tlsCert: '/run/secrets/cert',
  allowedOrigins: ['https://play.example'],
  sessionStore: 'redis',
  brokerPackage: '@spartan-gaming/redis-broker',
  turnUrls: ['turns:turn.example:5349'],
};

test('production signaling config normalizes safe operator prerequisites without exposing secrets', () => {
  const config = normalizeProductionConfig(valid);
  assert.deepEqual(config.allowedOrigins, ['https://play.example']);
  assert.equal(config.sessionStore, 'redis');
  assert.deepEqual(config.secrets, {
    configured: true,
    adminConfigured: true,
    turnConfigured: true,
  });
  assert.equal('secret' in config, false);
});
test('production signaling config rejects weak, insecure, reference-only, or missing broker settings', () => {
  assert.throws(() => normalizeProductionConfig({ ...valid, secret: 'short' }), /at least 32/);
  assert.throws(() => normalizeProductionConfig({ ...valid, tlsCert: '' }), /TLS certificate/);
  assert.throws(
    () => normalizeProductionConfig({ ...valid, allowedOrigins: ['http://play.example'] }),
    /HTTPS/,
  );
  assert.throws(
    () => normalizeProductionConfig({ ...valid, sessionStore: 'memory' }),
    /session store/,
  );
  assert.throws(() => normalizeProductionConfig({ ...valid, brokerPackage: '' }), /broker package/);
  assert.throws(
    () => normalizeProductionConfig({ ...valid, turnUrls: ['stun:stun.example'] }),
    /TURN/,
  );
});
test('production signaling config resolves mounted secret files without exposing values', () => {
  const files = new Map([
    ['/run/secrets/signaling', 's'.repeat(32)],
    ['/run/secrets/admin', 'a'.repeat(32)],
    ['/run/secrets/turn', 't'.repeat(32)],
  ]);
  const config = resolveProductionConfig({
    env: {
      SPARTAN_SIGNALING_SECRET_FILE: '/run/secrets/signaling',
      SPARTAN_SIGNALING_ADMIN_SECRET_FILE: '/run/secrets/admin',
      SPARTAN_SIGNALING_TURN_SECRET_FILE: '/run/secrets/turn',
      SPARTAN_SIGNALING_TLS_KEY: '/run/secrets/key',
      SPARTAN_SIGNALING_TLS_CERT: '/run/secrets/cert',
      SPARTAN_SIGNALING_ALLOWED_ORIGINS: 'https://play.example',
      SPARTAN_SIGNALING_SESSION_STORE: 'redis',
      SPARTAN_SIGNALING_BROKER_PACKAGE: '@spartan-gaming/redis-broker',
      SPARTAN_SIGNALING_TURN_URLS: 'turns:turn.example:5349',
    },
    readFile: (path) => files.get(path),
  });
  assert.deepEqual(config.secrets, {
    configured: true,
    adminConfigured: true,
    turnConfigured: true,
  });
  assert.equal(config.brokerPackage, '@spartan-gaming/redis-broker');
  assert.equal('secret' in config, false);
});
test('production signaling config rejects mixed inline and file credentials', () => {
  assert.throws(
    () =>
      resolveProductionConfig({
        env: {
          ...Object.fromEntries(
            Object.entries({
              SPARTAN_SIGNALING_SECRET: 's'.repeat(32),
              SPARTAN_SIGNALING_SECRET_FILE: '/run/secrets/signaling',
            }),
          ),
          SPARTAN_SIGNALING_ADMIN_SECRET: 'a'.repeat(32),
          SPARTAN_SIGNALING_TURN_SECRET: 't'.repeat(32),
          SPARTAN_SIGNALING_TLS_KEY: '/key',
          SPARTAN_SIGNALING_TLS_CERT: '/cert',
          SPARTAN_SIGNALING_ALLOWED_ORIGINS: 'https://play.example',
          SPARTAN_SIGNALING_SESSION_STORE: 'redis',
          SPARTAN_SIGNALING_TURN_URLS: 'turn:turn.example',
        },
      }),
    /cannot both be set/,
  );
});
test('runtime secret resolution supports direct values and mounted files', () => {
  assert.equal(resolveConfiguredSecret({ env: { TOKEN: 'direct' }, name: 'TOKEN' }), 'direct');
  assert.equal(
    resolveConfiguredSecret({
      env: { TOKEN_FILE: '/token' },
      name: 'TOKEN',
      readFile: () => 'mounted\n',
    }),
    'mounted',
  );
  assert.throws(
    () =>
      resolveConfiguredSecret({
        env: { TOKEN_FILE: '/missing' },
        name: 'TOKEN',
        readFile: () => {
          throw new Error('missing');
        },
      }),
    /could not be read/,
  );
});
