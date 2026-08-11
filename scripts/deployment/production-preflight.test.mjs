import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyProductionInputs } from './production-preflight.mjs';

const config = Object.freeze({
  environment: 'production',
  tls: { keyPath: '/run/secrets/signaling.key', certPath: '/run/secrets/signaling.crt' },
  secrets: { configured: true, adminConfigured: true, turnConfigured: true },
  sessionStore: 'redis',
  brokerPackage: '@spartan-gaming/redis-broker',
  turnUrls: ['turns:turn.example:5349'],
});
const files = new Set([config.tls.keyPath, config.tls.certPath]);
const dependencies = { stat: (path) => ({ isFile: () => files.has(path) }), access: () => {} };

test('production preflight verifies mounted TLS files without returning secret material', () => {
  const result = verifyProductionInputs(config, dependencies);
  assert.deepEqual(result, {
    status: 'ready',
    environment: 'production',
    tls: { keyReadable: true, certificateReadable: true },
    secrets: { configured: true, adminConfigured: true, turnConfigured: true },
    sessionStore: 'redis',
    brokerConfigured: true,
    turnConfigured: true,
  });
  assert.equal('secret' in result, false);
});

test('production preflight fails closed for missing or non-file TLS inputs', () => {
  assert.throws(
    () =>
      verifyProductionInputs(config, { stat: () => ({ isFile: () => false }), access: () => {} }),
    /TLS key/,
  );
  assert.throws(
    () =>
      verifyProductionInputs(
        { ...config, tls: { ...config.tls, certPath: '/missing' } },
        dependencies,
      ),
    /TLS certificate/,
  );
  assert.throws(
    () => verifyProductionInputs({ ...config, environment: 'development' }, dependencies),
    /production configuration/,
  );
});
