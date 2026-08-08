#!/usr/bin/env node
import {createHash, randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {createSessionEnvelope} from '../src/frontend/session/session.mjs';
import {validateTransportMessage} from '../src/frontend/transport/transport.mjs';
import {createPairingAuthority, createPairingCode} from './pairing.mjs';
import {normalizeHostCapabilities} from './capabilities.mjs';
import {detectHostRuntime} from './environment.mjs';
import {createInputInjectionPlan, createNativeInputExecutor} from './input.mjs';
import {createHostSignalingClient} from './signaling.mjs';
import {negotiateHostOffer} from './session.mjs';
import {createReferenceGameLaunch} from './reference-launch.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) { const value = process.argv[index]; if (value.startsWith('--')) args.set(value.slice(2), process.argv[index + 1]?.startsWith('--') ? true : process.argv[++index]); }
const hostId = String(args.get('id') || `host-${randomUUID().slice(0, 8)}`);
const hostName = String(args.get('name') || 'Spartan Host');
const bind = String(args.get('bind') || '127.0.0.1');
const portArgument = args.get('port');
const port = portArgument === undefined ? 8787 : Number(portArgument);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('port must be an integer between 0 and 65535');
const signalEndpoint = args.get('signal-endpoint') ? String(args.get('signal-endpoint')) : null;
const signalSessionId = args.get('signal-session') ? String(args.get('signal-session')) : null;
const signalTicket = args.get('signal-ticket') ? String(args.get('signal-ticket')) : null;
const pairingCode = args.get('pairing-code') || createPairingCode();
const pairing = createPairingAuthority({code: pairingCode});
const hostRuntime = await detectHostRuntime({bindingOptions: {environment: process.env}});
const environment = hostRuntime.environment;
const capabilities = {transports: ['websocket'], video: {codecs: ['h264', 'vp9'], maxWidth: 3840, maxHeight: 2160, maxFramerate: 144, hdr: false}, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: environment.inputAdapter.gamepad, keyboard: environment.inputAdapter.keyboard, pointer: environment.inputAdapter.pointer, rumble: environment.inputAdapter.rumble}};
const inputEnabled = args.get('enable-input') === true || args.get('enable-input') === 'true';
const inputExecutor = inputEnabled && hostRuntime.bindings?.input && environment.readiness.osInput ? createNativeInputExecutor({platform: environment.platform, adapter: hostRuntime.bindings.input, permissions: {'remote-input': true, 'virtual-gamepad': true}}) : null;
const gameLaunchEnabled = args.get('enable-game-launch') === true || args.get('enable-game-launch') === 'true';
let configuredGameArgs = args.get('game-args-json') ? JSON.parse(String(args.get('game-args-json'))) : (args.get('game-arg') ? [String(args.get('game-arg'))] : []);
if (!Array.isArray(configuredGameArgs)) throw new TypeError('game-args-json must contain an array');
const gameLaunch = gameLaunchEnabled ? createReferenceGameLaunch({platform: environment.platform, runtimeId: args.get('runtime-id'), runtimeKind: args.get('runtime-kind') || 'native-emulator', runtimeVersion: args.get('runtime-version') || 'unversioned', runtimePath: args.get('runtime-path'), gamePath: args.get('game-path'), hostContentId: args.get('host-content-id'), args: configuredGameArgs, cwd: args.get('game-cwd'), spawnImpl: undefined, maxOutputBytes: 64 * 1024, stopTimeoutMs: 2_000}) : null;
const hostCapabilities = normalizeHostCapabilities({media: {state: 'not-configured', capture: false, encode: false, audio: false, transports: ['webrtc']}, process: {mode: gameLaunch ? 'managed' : 'none', launch: Boolean(gameLaunch), emulator: Boolean(gameLaunch)}, publisher: environment.publisher, audioPublisher: environment.audioPublisher, inputAdapter: environment.inputAdapter, webrtc: environment.webrtc, input: capabilities.input});
const sessions = new Set(); let inputEvents = 0; let lastQuality = null; let lastInputPlan = null; let lastInputExecution = {state: inputExecutor ? 'ready' : 'disabled', reason: inputEnabled && !inputExecutor ? 'native input adapter is unavailable or not ready' : null};

function json(response, status, body) { response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}); response.end(JSON.stringify(body)); }
function frame(text) { const body = Buffer.from(text); const size = body.length; if (size < 126) return Buffer.concat([Buffer.from([0x81, size]), body]); if (size < 65536) { const header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(size, 2); return Buffer.concat([header, body]); } throw new Error('WebSocket message is too large'); }
function closeFrame() { return Buffer.from([0x88, 0x00]); }
function acceptKey(key) { return createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64'); }
function parseFrames(buffer, onMessage, socket) {
  let cursor = 0;
  while (buffer.length - cursor >= 2) {
    const first = buffer[cursor]; const second = buffer[cursor + 1]; const opcode = first & 0x0f; const masked = Boolean(second & 0x80); let length = second & 0x7f; let header = 2;
    if (length === 126) { if (buffer.length - cursor < 4) break; length = buffer.readUInt16BE(cursor + 2); header = 4; }
    if (length === 127 || !masked || length > 65536) { socket.end(closeFrame()); return Buffer.alloc(0); }
    if (buffer.length - cursor < header + 4 + length) break;
    const mask = buffer.subarray(cursor + header, cursor + header + 4); const payload = Buffer.from(buffer.subarray(cursor + header + 4, cursor + header + 4 + length)); for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    cursor += header + 4 + length;
    if (opcode === 0x8) { socket.end(closeFrame()); return buffer.subarray(cursor); }
    if (opcode === 0x9) { socket.write(Buffer.from([0x8a, 0])); continue; }
    if (opcode !== 0x1) { socket.end(closeFrame()); return Buffer.alloc(0); }
    Promise.resolve(onMessage(payload.toString('utf8'))).catch(() => socket.end(closeFrame()));
  }
  return buffer.subarray(cursor);
}
async function handleMessage(connection, text, session) {
  let message;
  try { message = validateTransportMessage(JSON.parse(text)); } catch { connection.close(); return; }
  if (message.type === 'session.offer' && !session.accepted) {
    if (message.payload.hostId !== hostId || !pairing.matches(message.payload.pairingCode)) { connection.close(); return; }
    const negotiation = negotiateHostOffer({offer: message.payload, hostCapabilities: capabilities});
    if (!negotiation.accepted) { connection.send(createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: false, hostId, hostName, reason: negotiation.reason}})); connection.close(); return; }
    if (!pairing.verify(message.payload.pairingCode)) { connection.close(); return; }
    if (message.payload.launch) {
      if (!gameLaunch) { connection.send(createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: false, hostId, hostName, reason: 'native game launch is not configured on this host'}})); connection.close(); return; }
      if (!gameLaunch.matches(message.payload.launch)) { connection.send(createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: false, hostId, hostName, reason: 'launch request does not match host-local runtime or content'}})); connection.close(); return; }
      try { await gameLaunch.launcher.start(); session.gameStarted = true; } catch (error) { connection.send(createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: false, hostId, hostName, reason: `game launch failed: ${error.message}`}})); connection.close(); return; }
    }
    session.accepted = true; session.sessionId = message.sessionId;
    session.negotiated = negotiation.capabilities;
    sessions.add(session); const answer = createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: true, hostId, hostName, capabilities: session.negotiated, hostCapabilities}});
    connection.send(answer);
    return;
  }
  if (message.sessionId !== session.sessionId) { connection.close(); return; }
  if (message.type === 'quality.request') { lastQuality = {profile: String(message.payload.profile || 'balanced'), maxWidth: Number(message.payload.maxWidth) || 0, maxHeight: Number(message.payload.maxHeight) || 0, maxFramerate: Number(message.payload.maxFramerate) || 0, bitrateKbps: Number(message.payload.bitrateKbps) || 0}; return; }
  if (message.type === 'input.event') { inputEvents += 1; session.lastInputAt = message.sentAt; try { const event = {type: 'input.event', ...message.payload}; lastInputPlan = createInputInjectionPlan({platform: environment.platform, event, permissions: {'remote-input': Boolean(inputExecutor), 'virtual-gamepad': Boolean(inputExecutor)}}); if (!inputExecutor) { lastInputExecution = {state: 'disabled', reason: 'start the host with --enable-input after installing a ready native input adapter'}; return; } lastInputExecution = {state: 'dispatching', reason: null}; inputExecutor.dispatch(event).then(() => { lastInputExecution = {state: 'active', reason: null}; }).catch(error => { lastInputExecution = {state: 'failed', reason: error.message}; }); } catch (error) { lastInputPlan = {state: 'failed', reason: error.message}; lastInputExecution = {state: 'failed', reason: error.message}; } return; }
  if (message.type === 'session.reconnect') { const answer = createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: true, hostId, capabilities: session.negotiated || capabilities, hostCapabilities}}); connection.send(answer); return; }
  if (message.type === 'session.close') { sessions.delete(session); if (session.gameStarted) { await gameLaunch?.launcher.stop(); session.gameStarted = false; } connection.close(); }
}

const server = createServer((request, response) => {
  if (request.url === '/health') return json(response, 200, {service: 'spartan-host-reference', version: 1, hostId, hostName, pairingExpiresAt: pairing.expiresAt, pairingUsed: pairing.used, activeSessions: sessions.size, inputEvents, lastInputPlan, lastInputExecution, lastQuality, gameLaunch: gameLaunch ? {enabled: true, ...gameLaunch.descriptor, state: gameLaunch.launcher.state, pid: gameLaunch.launcher.pid} : {enabled: false}, capabilities, hostCapabilities, environment});
  json(response, 404, {error: 'not found'});
});
server.on('upgrade', (request, socket) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/session' || request.headers.upgrade?.toLowerCase() !== 'websocket' || !request.headers['sec-websocket-key']) { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(request.headers['sec-websocket-key'])}\r\n\r\n`);
  const connection = {send: value => socket.write(frame(JSON.stringify(value))), close: () => socket.end(closeFrame())};
  const session = {accepted: false, sessionId: null, negotiated: null}; let buffer = Buffer.alloc(0);
  socket.on('data', chunk => { buffer = parseFrames(Buffer.concat([buffer, chunk]), text => handleMessage(connection, text, session), socket); });
  socket.on('close', () => { sessions.delete(session); if (session.gameStarted) { void gameLaunch?.launcher.stop(); session.gameStarted = false; } });
  socket.on('error', () => {});
});
server.listen(port, bind, () => {
  const actualPort = server.address().port;
  console.log(JSON.stringify({service: 'spartan-host-reference', endpoint: `ws://${bind}:${actualPort}/session`, health: `http://${bind}:${actualPort}/health`, hostId, hostName, pairingCode: args.get('quiet') ? undefined : pairingCode, pairingExpiresAt: pairing.expiresAt, signalingEndpoint: signalEndpoint || undefined, warning: gameLaunch ? 'Reference control plane with optional configured game launch; media capture/encoding remain separate.' : 'Reference control plane only; media capture/encoding and process launch are not configured.'}));
  if (!signalEndpoint && !signalSessionId && !signalTicket) return;
  if (!signalEndpoint || !signalSessionId || !signalTicket) { console.error('Outbound signaling requires --signal-endpoint, --signal-session, and --signal-ticket.'); process.exitCode = 1; return; }
  let signalingClient;
  const signalSession = {accepted: false, sessionId: signalSessionId, negotiated: null};
  signalingClient = createHostSignalingClient({endpoint: signalEndpoint, sessionId: signalSessionId, ticket: signalTicket, onMessage: message => handleMessage(signalingClient, JSON.stringify(message), signalSession), onError: error => console.error(`host signaling error: ${error.message}`), onClose: () => console.error('host signaling connection closed')});
  signalingClient.connect().catch(error => { console.error(`host signaling connection failed: ${error.message}`); process.exitCode = 1; });
});
server.on('close', () => inputExecutor?.close());
