import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {createProductionRolloutPlan, createProductionRolloutReport, executeProductionRollout} from './production-rollout.mjs';

test('production rollout plan is shell-free, explicit, and secret-free', () => {
  const plan = createProductionRolloutPlan({composeFile: '/srv/spartan/docker-compose.production.yml', envFile: '/run/secrets/spartan.env', project: 'spartan-prod', healthEndpoint: 'https://play.example/health', adminHealthEndpoint: 'https://play.example/admin/health'});
  assert.equal(plan.status, 'planned');
  assert.deepEqual(plan.compose.preflight.args.slice(0, 6), ['compose', '--project-name', 'spartan-prod', '--file', path.resolve('/srv/spartan/docker-compose.production.yml'), '--env-file']);
  assert.deepEqual(plan.compose.up.args.slice(-3), ['signaling', 'redis', 'turn']);
  assert.equal(plan.security.shell, false);
  assert.equal(JSON.stringify(plan).includes('SPARTAN_'), false);
});

test('production rollout can verify live service health through injected boundaries', async () => {
  const plan = createProductionRolloutPlan({composeFile: '/srv/spartan/compose.yml', healthEndpoint: 'http://127.0.0.1:8790/health'});
  const commands = [];
  const result = await executeProductionRollout(plan, {runner: async command => { commands.push(command); }, fetchImpl: async endpoint => { assert.equal(endpoint, 'http://127.0.0.1:8790/health'); return {ok: true, status: 200, async json() { return {status: 'ok', service: 'spartan-signaling'}; }}; }});
  assert.equal(commands.length, 2); assert.equal(result.status, 'healthy'); assert.equal(result.primary.service, 'spartan-signaling');
  const report = createProductionRolloutReport(plan, result, {now: '2026-08-10T12:00:00.000Z'});
  assert.deepEqual(report, {version: 1, kind: 'production-rollout', status: 'healthy', recordedAt: '2026-08-10T12:00:00.000Z', includeTurn: true, required: ['service'], primary: {status: 'healthy', service: 'spartan-signaling', health: 'ok'}, admin: null, turn: null});
  assert.equal(JSON.stringify(report).includes('SPARTAN_'), false);
});

test('production rollout can require a ready broker health signal', async () => {
  const plan = createProductionRolloutPlan({composeFile: '/srv/spartan/compose.yml', healthEndpoint: 'http://127.0.0.1:8790/health', requireBroker: true});
  const fetchImpl = async () => ({ok: true, status: 200, async json() { return {status: 'ok', service: 'spartan-signaling', broker: {status: 'unavailable', backend: 'redis'}}; }});
  await assert.rejects(() => executeProductionRollout(plan, {runner: async () => {}, fetchImpl}), /broker health is not ready/);
});

test('production rollout verifies TURN credentials without retaining secrets', async () => {
  const plan = createProductionRolloutPlan({composeFile: '/srv/spartan/compose.yml', healthEndpoint: 'http://127.0.0.1:8790/health', adminHealthEndpoint: 'http://127.0.0.1:8790/admin/health', requireTurnCredentials: true});
  const result = await executeProductionRollout(plan, {runner: async () => {}, checkTurn: true, adminSecret: 'admin-secret', fetchImpl: async (endpoint, options = {}) => {
    if (endpoint.endsWith('/health')) return {ok: true, status: 200, async json() { return {status: 'ok', service: 'spartan-signaling'}; }};
    assert.equal(endpoint, 'http://127.0.0.1:8790/admin/turn-credentials'); assert.equal(options.method, 'POST'); assert.equal(options.headers.authorization, 'Bearer admin-secret');
    return {ok: true, status: 201, async json() { return {username: 'expires:rollout-health', credential: 'secret-credential', ttlSeconds: 60, urls: ['turns:turn.example:5349']}; }};
  }});
  assert.deepEqual(result.turn, {status: 'ready', urlCount: 1, ttlSeconds: 60});
  assert.equal(JSON.stringify(createProductionRolloutReport(plan, result)).includes('admin-secret'), false);
});

test('TURN network probe reports bounded transport reachability without exposing hosts', async () => {
  const {probeTurnEndpoints} = await import('./production-rollout.mjs');
  const seen = [];
  const result = await probeTurnEndpoints(['turn:turn.example:3478', 'turns:secure.example:5349'], {connector: async endpoint => { seen.push(endpoint); }});
  assert.deepEqual(result, {status: 'reachable', total: 2, reachable: 2});
  assert.deepEqual(seen.map(item => [item.scheme, item.port]), [['turn', 3478], ['turns', 5349]]);
});

test('production rollout rejects unsafe endpoints and invalid runners', async () => {
  assert.throws(() => createProductionRolloutPlan({healthEndpoint: 'http://relay.example/health'}), /HTTPS/);
  assert.throws(() => createProductionRolloutPlan({project: 'spartan prod'}), /projectName/);
  const plan = createProductionRolloutPlan({composeFile: '/srv/spartan/compose.yml', healthEndpoint: 'http://localhost/health'});
  await assert.rejects(() => executeProductionRollout(plan, {runner: null}), /runner/);
});
