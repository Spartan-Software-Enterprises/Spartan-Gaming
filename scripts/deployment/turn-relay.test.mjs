import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  normalizeTurnRelayOptions,
  renderTurnServerConfig,
  writeTurnServerConfig,
} from './turn-relay.mjs';

const sharedSecret = 't'.repeat(40);

test('TURN relay configuration is bounded and renders coturn authentication without leaking through metadata', () => {
  const options = normalizeTurnRelayOptions({
    realm: 'turn.example',
    externalIp: '203.0.113.10',
    minPort: 50000,
    maxPort: 51000,
    tlsCert: '/etc/turn/cert.pem',
    tlsKey: '/etc/turn/key.pem',
  });
  const rendered = renderTurnServerConfig({ sharedSecret, options });
  assert.equal(options.minPort, 50000);
  assert.match(rendered.config, /use-auth-secret/);
  assert.match(rendered.config, /static-auth-secret=t{40}/);
  assert.match(rendered.config, /external-ip=203\.0\.113\.10/);
  assert.equal(rendered.secretMaterial.includes(sharedSecret), false);
  assert.throws(() => renderTurnServerConfig({ sharedSecret: 'short', options }), /at least 32/);
});

test('TURN relay configuration rejects unsafe or contradictory deployment options', () => {
  assert.throws(
    () => normalizeTurnRelayOptions({ listenPort: 3478, tlsPort: 3478 }),
    /must differ/,
  );
  assert.throws(
    () => normalizeTurnRelayOptions({ minPort: 60000, maxPort: 50000 }),
    /must not exceed/,
  );
  assert.throws(() => normalizeTurnRelayOptions({ externalIp: 'bad address' }), /single host/);
  assert.throws(() => normalizeTurnRelayOptions({ tlsCert: '/cert' }), /supplied together/);
});

test('TURN relay writer uses a private output mode and returns no secret', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'spartan-turn-'));
  try {
    const outputPath = path.join(root, 'turnserver.conf');
    const result = await writeTurnServerConfig({
      sharedSecret,
      outputPath,
      options: { realm: 'test' },
    });
    assert.equal(result.status, 'written');
    assert.equal(result.options.realm, 'test');
    assert.equal(
      await readFile(outputPath, 'utf8').then((value) => value.includes(sharedSecret)),
      true,
    );
    assert.equal('sharedSecret' in result, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
