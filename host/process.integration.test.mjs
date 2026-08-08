import assert from 'node:assert/strict';
import test from 'node:test';
import {createProcessLaunchPlan} from './adapters.mjs';
import {createManagedProcess, createProcessPipeline} from './process.mjs';

function waitFor(predicate, timeoutMs = 3_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => { const poll = () => { if (predicate()) return resolve(); if (Date.now() - startedAt >= timeoutMs) return reject(new Error('process output timed out')); setTimeout(poll, 10); }; poll(); });
}

function plan(script) { return createProcessLaunchPlan({executable: process.execPath, args: ['-e', script]}); }

test('managed process starts a real shell-free child, bounds output, and stops cleanly', async () => {
  const managed = createManagedProcess({plan: plan("process.stdout.write('ready'); process.stderr.write('diagnostic'); setInterval(() => {}, 1000)"), maxOutputBytes: 1024});
  const states = []; managed.on('state', value => states.push(value.state)); await managed.start(); await waitFor(() => managed.output.stdout.includes('ready') && managed.output.stderr.includes('diagnostic'));
  assert.equal(managed.state, 'running'); assert.equal(managed.output.stderr, 'diagnostic'); assert.equal(managed.plan, undefined); const stopped = await managed.stop();
  assert.equal(stopped.state, 'stopped'); assert.ok(states.includes('starting')); assert.ok(states.includes('running')); assert.ok(states.includes('stopping')); assert.equal(stopped.exit.code, null);
});

test('process pipeline starts in order and rolls back in reverse order', async () => {
  const pipeline = createProcessPipeline({plans: [plan("setInterval(() => {}, 1000)"), plan("setInterval(() => {}, 1000)")]}); await pipeline.start(); assert.equal(pipeline.state, 'running'); assert.equal(pipeline.processes.length, 2); assert.ok(pipeline.processes.every(process => process.state === 'running')); await pipeline.stop(); assert.equal(pipeline.state, 'stopped'); assert.ok(pipeline.processes.every(process => process.state === 'stopped'));
});
