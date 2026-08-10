import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import test from 'node:test';
import {createSessionEnvelope, createSessionManager} from '../src/frontend/session/session.mjs';
import {createNativeHostLaunchRequest} from '../src/frontend/emulation/host-launch.mjs';

const agentPath = fileURLToPath(new URL('./agent.mjs', import.meta.url));

function frame(value) {
  const body = Buffer.from(value); const mask = Buffer.from([0x52, 0x70, 0x61, 0x72]);
  if (body.length >= 65536) throw new Error('integration frame is unexpectedly large');
  const payload = Buffer.from(body); for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
  const header = body.length < 126 ? Buffer.from([0x81, 0x80 | body.length]) : Buffer.from([0x81, 0xfe, body.length >> 8, body.length & 0xff]);
  return Buffer.concat([header, mask, payload]);
}

function socketClient(port) {
  const socket = net.connect({host: '127.0.0.1', port}); let buffer = Buffer.alloc(0); let handshake = false; const frames = []; const waiters = [];
  const pump = () => {
    if (!handshake) { const boundary = buffer.indexOf('\r\n\r\n'); if (boundary < 0) return; buffer = buffer.subarray(boundary + 4); handshake = true; }
    while (buffer.length >= 2) {
      let length = buffer[1] & 0x7f; let header = 2; if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); header = 4; } if (length === 127 || buffer.length < header + length) return;
      const payload = buffer.subarray(header, header + length).toString('utf8'); buffer = buffer.subarray(header + length); frames.push(payload); waiters.shift()?.(payload);
    }
  };
  socket.on('data', chunk => { buffer = Buffer.concat([buffer, chunk]); pump(); });
  const ready = new Promise((resolve, reject) => { socket.once('connect', () => { socket.write(`GET /session HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: c3BhcnRhbi10ZXN0LWtleQ==\r\n\r\n`); const check = () => handshake ? resolve() : setTimeout(check, 5); check(); }); socket.once('error', reject); });
  return {socket, ready, send(value) { socket.write(frame(JSON.stringify(value))); }, next() { return frames.length ? Promise.resolve(frames.shift()) : new Promise(resolve => waiters.push(resolve)); }, close() { socket.destroy(); }};
}

async function startAgent(extra = []) {
  const child = spawn(process.execPath, [agentPath, '--bind', '127.0.0.1', '--port', '0', '--id', 'host-integration', '--pairing-code', 'ABCD23', '--quiet', ...extra], {stdio: ['ignore', 'pipe', 'pipe']});
  const info = await new Promise((resolve, reject) => { let pending = ''; const timer = setTimeout(() => reject(new Error('reference host did not start')), 5000); child.stdout.on('data', chunk => { pending += chunk.toString(); const line = pending.split('\n')[0]; try { const parsed = JSON.parse(line); clearTimeout(timer); resolve(parsed); } catch {} }); child.once('error', reject); });
  return {child, info};
}

test('reference host completes a paired direct session and records control traffic', async () => {
  const {child, info} = await startAgent(); const client = socketClient(new URL(info.endpoint).port); const manager = createSessionManager({idFactory: () => 'ses-host-integration'});
  try {
    await client.ready;
    const offer = manager.start({backend: {id: 'spartan-host', backendType: 'remote-play', hostId: 'host-integration', pairingCode: 'ABCD23'}, capabilities: {transports: ['websocket'], video: {codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60, hdr: false}, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: true, keyboard: true, pointer: true, rumble: true}}});
    client.send(offer); const answer = JSON.parse(await client.next()); assert.equal(answer.type, 'session.answer'); assert.equal(answer.payload.accepted, true); assert.equal(answer.payload.hostId, 'host-integration'); manager.receive(answer); assert.equal(manager.state, 'connected');
    client.send(createSessionEnvelope({sessionId: offer.sessionId, type: 'quality.request', sequence: 1, payload: {profile: 'low', maxWidth: 1280, maxHeight: 720, maxFramerate: 30, bitrateKbps: 2500}}));
    client.send(createSessionEnvelope({sessionId: offer.sessionId, type: 'input.event', sequence: 2, payload: {action: 'confirm', kind: 'key', control: 'KeyA', pressed: true, value: 1, source: 'keyboard'}}));
    await new Promise(resolve => setTimeout(resolve, 60)); const health = await fetch(info.health).then(response => response.json()); assert.equal(health.secure, false); assert.deepEqual(health.limits, {maxConnections: 8, maxMessagesPerSecond: 120}); assert.equal(health.runtimePolicy.videoCodec, 'Automatic'); assert.equal(health.runtimePolicy.maxResolution, '1080p'); assert.equal(health.runtimePolicy.enableInput, false); assert.equal(health.controllerPolicy.version, 1); assert.equal(health.controllerPolicy.playerSlots, 4); assert.equal(health.controllerPolicy.allowGamepad, true); assert.equal(health.connections, 1); assert.equal(health.rejectedConnections, 0); assert.equal(health.activeSessions, 1); assert.equal(health.inputEvents, 1); assert.equal(health.lastQuality.profile, 'low'); assert.equal(health.lastInputExecution.state, 'disabled'); assert.equal(health.pairingUsed, true);
  } finally { client.close(); child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
});

test('reference host launches a matched native game request and stops it on session close', async () => {
  const {child, info} = await startAgent(['--enable-game-launch', '--runtime-id', 'node-runtime', '--runtime-path', process.execPath, '--runtime-version', process.version, '--game-path', 'spartan-test.iso', '--host-content-id', 'node-test', '--game-args-json', '["-e","setInterval(() => {}, 1000)"]']);
  const client = socketClient(new URL(info.endpoint).port); const manager = createSessionManager({idFactory: () => 'ses-game-launch'});
  try {
    await client.ready;
    const launch = createNativeHostLaunchRequest({plan: {status: 'ready', coreId: 'node-runtime', files: [{kind: 'game', name: 'spartan-test.iso', size: 1, userSelected: true}], integration: {runtime: 'native-emulator', runtimeProfile: {id: 'node-runtime', kind: 'native-emulator', version: process.version, trust: 'signed', enabled: true}}}, hostContentId: 'node-test', consent: true});
    const offer = manager.start({backend: {id: 'spartan-host', backendType: 'remote-play', hostId: 'host-integration', pairingCode: 'ABCD23'}, launch, capabilities: {transports: ['websocket'], video: {codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60, hdr: false}, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: false, keyboard: true, pointer: true, rumble: false}}});
    client.send(offer); const answer = JSON.parse(await client.next()); assert.equal(answer.payload.accepted, true); const running = await fetch(info.health).then(response => response.json()); assert.equal(running.gameLaunch.state, 'running'); assert.ok(running.gameLaunch.pid);
    client.send(manager.close()); await new Promise(resolve => setTimeout(resolve, 80)); const stopped = await fetch(info.health).then(response => response.json()); assert.equal(stopped.gameLaunch.state, 'stopped');
  } finally { client.close(); child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
});

test('reference host exposes health CORS only for configured origins', async () => {
  const {child, info} = await startAgent(['--allowed-origins', 'https://game.example']);
  try {
    const allowed = await fetch(info.health, {headers: {origin: 'https://game.example'}});
    assert.equal(allowed.status, 200); assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://game.example');
    const denied = await fetch(info.health, {headers: {origin: 'https://evil.example'}});
    assert.equal(denied.status, 403);
  } finally { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
});

test('reference host shuts down gracefully and stops a managed game launch on SIGTERM', async () => {
  const {child, info} = await startAgent(['--enable-game-launch', '--runtime-id', 'node-runtime', '--runtime-path', process.execPath, '--runtime-version', process.version, '--game-path', 'spartan-test.iso', '--host-content-id', 'node-test', '--game-args-json', '["-e","setInterval(() => {}, 1000)"]']);
  const exit = new Promise(resolve => child.once('exit', resolve));
  const client = socketClient(new URL(info.endpoint).port); const manager = createSessionManager({idFactory: () => 'ses-shutdown'});
  try {
    await client.ready;
    const launch = createNativeHostLaunchRequest({plan: {status: 'ready', coreId: 'node-runtime', files: [{kind: 'game', name: 'spartan-test.iso', size: 1, userSelected: true}], integration: {runtime: 'native-emulator', runtimeProfile: {id: 'node-runtime', kind: 'native-emulator', version: process.version, trust: 'signed', enabled: true}}}, hostContentId: 'node-test', consent: true});
    const offer = manager.start({backend: {id: 'spartan-host', backendType: 'remote-play', hostId: 'host-integration', pairingCode: 'ABCD23'}, launch, capabilities: {transports: ['websocket'], video: {codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60, hdr: false}, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: false, keyboard: true, pointer: true, rumble: false}}});
    client.send(offer); const answer = JSON.parse(await client.next()); assert.equal(answer.payload.accepted, true);
    const running = await fetch(info.health).then(response => response.json()); assert.equal(running.gameLaunch.state, 'running');
    child.kill('SIGTERM');
    assert.equal(await exit, 0);
  } finally { client.close(); if (child.exitCode === null) child.kill(); }
});
