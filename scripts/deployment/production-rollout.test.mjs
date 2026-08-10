import assert from 'node:assert/strict';
import test from 'node:test';
import {createProductionRolloutPlan, executeProductionRollout} from './production-rollout.mjs';

test('production rollout plan is shell-free, explicit, and secret-free', () => {
  const plan = createProductionRolloutPlan({composeFile: '/srv/spartan/docker-compose.production.yml', envFile: '/run/secrets/spartan.env', project: 'spartan-prod', healthEndpoint: 'https://play.example/health', adminHealthEndpoint: 'https://play.example/admin/health'});
  assert.equal(plan.status, 'planned');
  assert.deepEqual(plan.compose.preflight.args.slice(0, 6), ['compose', '--project-name', 'spartan-prod', '--file', '/srv/spartan/docker-compose.production.yml', '--env-file']);
  assert.deepEqual(plan.compose.up.args.slice(-3), ['signaling', 'redis', 'turn']);
  assert.equal(plan.security.shell, false);
  assert.equal(JSON.stringify(plan).includes('SPARTAN_'), false);
});

test('production rollout can verify live service health through injected boundaries', async () => {
  const plan = createProductionRolloutPlan({composeFile: '/srv/spartan/compose.yml', healthEndpoint: 'http://127.0.0.1:8790/health'});
  const commands = [];
  const result = await executeProductionRollout(plan, {runner: async command => { commands.push(command); }, fetchImpl: async endpoint => { assert.equal(endpoint, 'http://127.0.0.1:8790/health'); return {ok: true, status: 200, async json() { return {status: 'ok', service: 'spartan-signaling'}; }}; }});
  assert.equal(commands.length, 2); assert.equal(result.status, 'healthy'); assert.equal(result.primary.service, 'spartan-signaling');
});

test('production rollout rejects unsafe endpoints and invalid runners', async () => {
  assert.throws(() => createProductionRolloutPlan({healthEndpoint: 'http://relay.example/health'}), /HTTPS/);
  assert.throws(() => createProductionRolloutPlan({project: 'spartan prod'}), /projectName/);
  const plan = createProductionRolloutPlan({composeFile: '/srv/spartan/compose.yml', healthEndpoint: 'http://localhost/health'});
  await assert.rejects(() => executeProductionRollout(plan, {runner: null}), /runner/);
});
