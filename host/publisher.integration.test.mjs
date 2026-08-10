import assert from 'node:assert/strict';
import test from 'node:test';
import {createProcessLaunchPlan} from './adapters.mjs';
import {createNativeMediaPipeline} from './native-media.mjs';
import {createEncodedMediaPublisher, createRtpMediaPublisher} from './publisher.mjs';

function nodePlan(script, target = 'stdout') { return {process: createProcessLaunchPlan({executable: process.execPath, args: ['-e', script]}), output: {target}}; }
async function waitFor(predicate, timeoutMs = 3000) { const started = Date.now(); while (!predicate()) { if (Date.now() - started >= timeoutMs) throw new Error('timed out waiting for publisher output'); await new Promise(resolve => setTimeout(resolve, 20)); } }

test('encoded media publisher hands capture-to-encode output to an adapter sink', async () => {
  const pipeline = createNativeMediaPipeline({capturePlan: nodePlan("process.stdout.write('frame'); setTimeout(() => {}, 1000)"), encoderPlan: nodePlan("process.stdin.on('data', chunk => process.stdout.write(chunk.toString().toUpperCase())); process.stdin.on('end', () => process.exit(0))")});
  const chunks = []; let opened; let closed = false; const publisher = createEncodedMediaPublisher({pipeline, codec: 'h264', sink: {open: value => { opened = value; }, write: chunk => chunks.push(chunk), close: () => { closed = true; }}});
  await publisher.start(); await waitFor(() => chunks.length > 0); assert.equal(publisher.state, 'active'); assert.deepEqual(opened, {codec: 'h264'}); assert.equal(Buffer.concat(chunks).toString(), 'FRAME'); assert.equal(publisher.bytesWritten, 5); await publisher.stop(); assert.equal(publisher.state, 'stopped'); assert.equal(closed, true);
});

test('encoded media publisher rejects invalid sinks and codecs', () => { const pipeline = {start: async () => {}, stop: async () => {}}; assert.throws(() => createEncodedMediaPublisher({pipeline, sink: {}}), /write/); assert.throws(() => createEncodedMediaPublisher({pipeline, sink: {write() {}}, codec: 'mpeg2'}), /unsupported/); });

test('RTP publisher packetizes encoded chunks and delegates transport delivery', async () => {
  const pipeline = {videoOutput: new (await import('node:stream')).PassThrough(), start: async function() {}, stop: async function() { this.videoOutput.end(); }};
  const packets = []; const timestamps = [];
  const rtp = createRtpMediaPublisher({pipeline, packetizer: {push(chunk, metadata) { timestamps.push(metadata.timestamp); return [Buffer.concat([Buffer.from('rtp:'), chunk])]; }}, transport: {send: packet => packets.push(packet)}, codec: 'h264'});
  await rtp.publisher.start(); pipeline.videoOutput.write(Buffer.from('frame')); await new Promise(resolve => setTimeout(resolve, 20)); await rtp.publisher.stop();
  assert.deepEqual(timestamps, [0]); assert.deepEqual(packets.map(packet => packet.toString()), ['rtp:frame']); assert.equal(rtp.packetsSent, 1);
});
