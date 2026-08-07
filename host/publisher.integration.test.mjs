import assert from 'node:assert/strict';
import test from 'node:test';
import {createProcessLaunchPlan} from './adapters.mjs';
import {createNativeMediaPipeline} from './native-media.mjs';
import {createEncodedMediaPublisher} from './publisher.mjs';

function nodePlan(script, target = 'stdout') { return {process: createProcessLaunchPlan({executable: process.execPath, args: ['-e', script]}), output: {target}}; }

test('encoded media publisher hands capture-to-encode output to an adapter sink', async () => {
  const pipeline = createNativeMediaPipeline({capturePlan: nodePlan("process.stdout.write('frame'); setTimeout(() => {}, 1000)"), encoderPlan: nodePlan("process.stdin.on('data', chunk => process.stdout.write(chunk.toString().toUpperCase())); process.stdin.on('end', () => process.exit(0))")});
  const chunks = []; let opened; let closed = false; const publisher = createEncodedMediaPublisher({pipeline, codec: 'h264', sink: {open: value => { opened = value; }, write: chunk => chunks.push(chunk), close: () => { closed = true; }}});
  await publisher.start(); await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(publisher.state, 'active'); assert.deepEqual(opened, {codec: 'h264'}); assert.equal(Buffer.concat(chunks).toString(), 'FRAME'); assert.equal(publisher.bytesWritten, 5); await publisher.stop(); assert.equal(publisher.state, 'stopped'); assert.equal(closed, true);
});

test('encoded media publisher rejects invalid sinks and codecs', () => { const pipeline = {start: async () => {}, stop: async () => {}}; assert.throws(() => createEncodedMediaPublisher({pipeline, sink: {}}), /write/); assert.throws(() => createEncodedMediaPublisher({pipeline, sink: {write() {}}, codec: 'mpeg2'}), /unsupported/); });
