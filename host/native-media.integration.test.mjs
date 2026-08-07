import assert from 'node:assert/strict';
import test from 'node:test';
import {createProcessLaunchPlan} from './adapters.mjs';
import {createNativeMediaPipeline} from './native-media.mjs';

function nodePlan(script, output = 'stdout') { return {process: createProcessLaunchPlan({executable: process.execPath, args: ['-e', script]}), output: {target: output}}; }

test('native media pipeline forwards capture bytes into an encoder output stream', async () => {
  const capture = nodePlan("process.stdout.write('encoded-input'); setTimeout(() => {}, 1000)");
  const encoder = nodePlan("process.stdin.on('data', chunk => process.stdout.write(chunk.toString().toUpperCase())); process.stdin.on('end', () => process.exit(0))");
  const pipeline = createNativeMediaPipeline({capturePlan: capture, encoderPlan: encoder}); const chunks = []; await pipeline.start();
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('encoded stream timed out')), 3000); pipeline.videoOutput.on('data', chunk => { chunks.push(chunk); clearTimeout(timer); resolve(); }); });
  assert.equal(Buffer.concat(chunks).toString(), 'ENCODED-INPUT'); assert.equal(pipeline.state, 'running'); assert.equal(pipeline.encoder.state, 'running'); await pipeline.stop(); assert.equal(pipeline.state, 'stopped');
});

test('native media pipeline fails closed for non-streaming capture plans', () => { assert.throws(() => createNativeMediaPipeline({capturePlan: nodePlan('', 'pipe'), encoderPlan: nodePlan('', 'stdout')}), /capturePlan must write media to stdout/); });
