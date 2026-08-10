import assert from 'node:assert/strict';
import test from 'node:test';
import {createMessageRateLimiter, createSignalingServer, isOriginAllowed, loadBrokerAdapter, normalizeServiceOptions, readBrokerHealth, resolveSignalingSecrets} from './agent.mjs';

test('signaling service defaults are bounded and origins are opt-in', () => {
  const config = normalizeServiceOptions({secret: 'test'});
  assert.equal(config.maxConnections, 256);
  assert.equal(config.maxMessagesPerSecond, 120);
  assert.equal(isOriginAllowed(undefined, []), true);
  assert.equal(isOriginAllowed('https://game.example', ['https://game.example']), true);
  assert.equal(isOriginAllowed('https://evil.example', ['https://game.example']), false);
  assert.equal(config.tls.enabled, false);
});

test('signaling TLS configuration is opt-in and requires a certificate pair', () => {
  const config = normalizeServiceOptions({secret: 'test', tlsKey: '/run/secrets/signaling.key', tlsCert: '/run/secrets/signaling.crt'});
  assert.deepEqual(config.tls, {enabled: true, keyPath: '/run/secrets/signaling.key', certPath: '/run/secrets/signaling.crt'});
  assert.throws(() => normalizeServiceOptions({secret: 'test', tlsKey: '/run/secrets/signaling.key'}), /provided together/);
  assert.throws(() => normalizeServiceOptions({secret: 'test', tlsCert: '/run/secrets/signaling.crt'}), /provided together/);
});

test('signaling message rate limiter resets each window', () => {
  let now = 0;
  const limiter = createMessageRateLimiter({limit: 2, windowMs: 1000, clock: () => now});
  assert.equal(limiter.take(), true); assert.equal(limiter.take(), true); assert.equal(limiter.take(), false);
  now = 1000; assert.equal(limiter.take(), true);
});

test('signaling health endpoint exposes bounded operational state', async () => {
  const service = createSignalingServer({secret: 'test-secret', bind: '127.0.0.1', port: 0, allowedOrigins: ['https://game.example'], maxConnections: 3, maxMessagesPerSecond: 4});
  try {
    const address = await service.start();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.limits, {maxConnections: 3, maxMessagesPerSecond: 4});
    assert.equal(body.connections, 0);
    assert.equal(body.rejectedConnections, 0);
    assert.equal(body.sessions, 0);
    assert.equal(body.secure, false);
    assert.deepEqual(body.broker, {status: 'not-reported'});
  } finally {
    await service.close();
  }
});

test('broker health projection is safe, bounded, and fail-closed', async () => { assert.deepEqual(await readBrokerHealth({health: async () => ({status: 'ready', backend: 'redis', secret: 'must-not-appear', details: {token: 'hidden'}})}), {status: 'ready', backend: 'redis'}); assert.deepEqual(await readBrokerHealth({health: async () => { throw new Error('offline'); }}), {status: 'unavailable'}); assert.deepEqual(await readBrokerHealth({}), {status: 'not-reported'}); });

test('opt-in admin API protects health and mints scoped tickets without exposing admin secret', async () => {
  const adminSecret = 'admin-secret-for-test';
  const service = createSignalingServer({secret: 'test-secret', adminSecret, bind: '127.0.0.1', port: 0});
  try {
    const address = await service.start(); const endpoint = `http://127.0.0.1:${address.port}`;
    const denied = await fetch(`${endpoint}/admin/health`); assert.equal(denied.status, 401);
    const health = await fetch(`${endpoint}/admin/health`, {headers: {authorization: `Bearer ${adminSecret}`}}); const healthBody = await health.json();
    assert.equal(health.status, 200); assert.equal('adminSecret' in healthBody, false);
    const ticketResponse = await fetch(`${endpoint}/admin/tickets`, {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${adminSecret}`}, body: JSON.stringify({sessionId: 'ses-admin-01', role: 'host', subject: 'host-01', ttlMs: 60000})});
    const ticket = await ticketResponse.json(); assert.equal(ticketResponse.status, 201); assert.equal(ticket.sessionId, 'ses-admin-01'); assert.equal(ticket.role, 'host'); assert.equal(typeof ticket.ticket, 'string');
  } finally { await service.close(); }
});

test('signaling server accepts an injected broker for clustered production adapters', async () => {
  const broker = {issueTicket: () => 'injected-ticket', attach() { throw new Error('not used'); }, stats: () => ({sessions: 0, participants: 0})};
  const service = createSignalingServer({broker, bind: '127.0.0.1', port: 0});
  try { const address = await service.start(); const response = await fetch(`http://127.0.0.1:${address.port}/health`); assert.equal(response.status, 200); assert.equal((await response.json()).sessions, 0); }
  finally { await service.close(); }
});

test('broker adapter loader requires a validated external broker package', async () => {
  const broker = {issueTicket() {}, attach() {}, stats() { return {sessions: 0, participants: 0}; }};
  const loaded = await loadBrokerAdapter({packageName: '@test/clustered-broker', loader: async name => { assert.equal(name, '@test/clustered-broker'); return {createBroker: async options => { assert.equal(options.environment.NODE_ENV, 'test'); return broker; }}; }, options: {environment: {NODE_ENV: 'test'}}});
  assert.equal(loaded, broker);
  await assert.rejects(() => loadBrokerAdapter({packageName: '@test/invalid', loader: async () => ({})}), /must export createBroker/);
});

test('signaling executable resolves mounted secrets through its startup options', () => { const secrets = resolveSignalingSecrets({env: {SPARTAN_SIGNALING_SECRET_FILE: '/secret', SPARTAN_SIGNALING_ADMIN_SECRET_FILE: '/admin'}, readFile: path => path === '/secret' ? 's'.repeat(32) : 'a'.repeat(32)}); assert.equal(secrets.secret, 's'.repeat(32)); assert.equal(secrets.adminSecret, 'a'.repeat(32)); });
