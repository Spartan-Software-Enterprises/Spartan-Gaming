#!/usr/bin/env node
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createServer as createHttpServer} from 'node:http';
import {createServer as createHttpsServer} from 'node:https';
import {createSessionEnvelope} from '../src/frontend/session/session.mjs';
import {validateTransportMessage} from '../src/frontend/transport/transport.mjs';
import {createPairingAuthority, createPairingCode} from './pairing.mjs';
import {normalizeHostCapabilities, resolveHostVideoCapabilities} from './capabilities.mjs';
import {detectHostRuntime} from './environment.mjs';
import {createInputInjectionPlan, createNativeInputExecutor, virtualGamepadPermissionGranted} from './input.mjs';
import {createRumbleBroadcastController} from './rumble-passthrough.mjs';
import {createHostSignalingClient} from './signaling.mjs';
import {negotiateHostOffer} from './session.mjs';
import {createReferenceGameLaunch} from './reference-launch.mjs';
import {loadWerift} from './werift-adapter.mjs';
import {createNativeWeriftConnection} from './native-agent.mjs';
import {readHostConfig} from './config.mjs';
import {platform as osPlatform} from 'node:os';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) { const value = process.argv[index]; if (value.startsWith('--')) args.set(value.slice(2), process.argv[index + 1]?.startsWith('--') ? true : process.argv[++index]); }
const hostConfig = readHostConfig(args.get('config'), {platform: osPlatform()});
const configured = (cliName, configName, fallback) => args.has(cliName) ? args.get(cliName) : (hostConfig[configName] ?? fallback);
const hostId = String(configured('id', 'hostId', `host-${randomUUID().slice(0, 8)}`));
const hostName = String(configured('name', 'hostName', 'Spartan Host'));
const bind = String(configured('bind', 'bind', '127.0.0.1'));
const portArgument = configured('port', 'port', undefined);
const port = portArgument === undefined ? 8787 : Number(portArgument);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('port must be an integer between 0 and 65535');
const signalEndpoint = args.get('signal-endpoint') ? String(args.get('signal-endpoint')) : (process.env.SPARTAN_HOST_SIGNAL_ENDPOINT || null);
const signalSessionId = args.get('signal-session') ? String(args.get('signal-session')) : (process.env.SPARTAN_HOST_SIGNAL_SESSION || null);
const signalTicket = args.get('signal-ticket') ? String(args.get('signal-ticket')) : (process.env.SPARTAN_HOST_SIGNAL_TICKET || null);
const tlsKey = String(configured('tls-key', 'tlsKey', process.env.SPARTAN_HOST_TLS_KEY || '')).trim();
const tlsCert = String(configured('tls-cert', 'tlsCert', process.env.SPARTAN_HOST_TLS_CERT || '')).trim();
if (Boolean(tlsKey) !== Boolean(tlsCert)) throw new TypeError('tls-key and tls-cert must be provided together');
const secure = Boolean(tlsKey);
const allowedOrigins = args.has('allowed-origins') ? String(args.get('allowed-origins')).split(',').map(value => value.trim()).filter(Boolean) : (hostConfig.allowedOrigins.length ? hostConfig.allowedOrigins : String(process.env.SPARTAN_HOST_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
const maxConnections = Number(configured('max-connections', 'maxConnections', process.env.SPARTAN_HOST_MAX_CONNECTIONS || 8));
const maxMessagesPerSecond = Number(configured('max-messages-per-second', 'maxMessagesPerSecond', process.env.SPARTAN_HOST_MAX_MESSAGES_PER_SECOND || 120));
if (!Number.isInteger(maxConnections) || maxConnections < 1 || maxConnections > 256) throw new TypeError('max-connections must be an integer between 1 and 256');
if (!Number.isInteger(maxMessagesPerSecond) || maxMessagesPerSecond < 1 || maxMessagesPerSecond > 10000) throw new TypeError('max-messages-per-second must be an integer between 1 and 10000');
const pairingCode = args.get('pairing-code') || createPairingCode();
const pairing = createPairingAuthority({code: pairingCode});
const nativePackage = String(configured('native-package', 'nativePackage', process.env.SPARTAN_NATIVE_PACKAGE || '')).trim() || undefined;
const virtualGamepadPackage = String(configured('virtual-gamepad-package', 'virtualGamepadPackage', process.env.SPARTAN_VIRTUAL_GAMEPAD_PACKAGE || '')).trim() || undefined;
const virtualGamepadBackend = String(configured('virtual-gamepad-backend', 'virtualGamepadBackend', process.env.SPARTAN_VIRTUAL_GAMEPAD_BACKEND || 'Automatic')).trim();
const virtualGamepadDevice = String(configured('virtual-gamepad-device', 'virtualGamepadDevice', process.env.SPARTAN_VIRTUAL_GAMEPAD_DEVICE || '')).trim() || undefined;
const virtualGamepadDevices = args.get('virtual-gamepad-devices') ? String(args.get('virtual-gamepad-devices')).split(',').map(value => value.trim()).filter(Boolean).slice(0, 8) : (hostConfig.virtualGamepadDevices.length ? hostConfig.virtualGamepadDevices : String(process.env.SPARTAN_VIRTUAL_GAMEPAD_DEVICES || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 8));
const hostRuntime = await detectHostRuntime({packageName: nativePackage, bindingOptions: {environment: process.env}, virtualGamepadPackageName: virtualGamepadPackage, virtualGamepadBackend, virtualGamepadDevice, virtualGamepadDevices, virtualGamepadOptions: {environment: process.env}});
const environment = hostRuntime.environment;
const inputEnabled = args.has('enable-input') ? args.get('enable-input') === true || args.get('enable-input') === 'true' : hostConfig.enableInput;
const nativeMediaEnabled = args.has('enable-native-media') ? args.get('enable-native-media') === true || args.get('enable-native-media') === 'true' : hostConfig.enableNativeMedia;
const nativeAudioEnabled = args.has('enable-native-audio') ? args.get('enable-native-audio') === true || args.get('enable-native-audio') === 'true' : hostConfig.enableNativeAudio;
const nativeAudioSource = configured('audio-source', 'audioSource', '') ? String(configured('audio-source', 'audioSource', '')) : null;
const nativeAudioBackend = configured('audio-backend', 'audioBackend', '') ? String(configured('audio-backend', 'audioBackend', '')) : null;
const audioOptions = Object.freeze({...(nativeAudioSource ? {source: nativeAudioSource} : {}), ...(nativeAudioBackend ? {backend: nativeAudioBackend} : {})});
let weriftModule = null;
if (nativeMediaEnabled) {
  try { weriftModule = await loadWerift(); } catch { throw new Error('native media requires the optional werift package; install it before using --enable-native-media'); }
  if (!hostRuntime.bindings?.capture?.plan) throw new Error('native media requires an installed platform binding with capture.plan()');
}
const hostVideo = resolveHostVideoCapabilities({encoders: environment.nativeBinding?.capabilities?.encoders?.hardware, display: hostRuntime.bindings?.display || null, maxWidth: 3840, maxHeight: 2160, maxFramerate: 144, hdr: false});
const capabilities = {transports: nativeMediaEnabled ? ['webrtc'] : ['websocket'], video: hostVideo, audio: {codecs: ['opus'], channels: 2}, input: {gamepad: environment.inputAdapter.gamepad, virtualGamepad: environment.inputAdapter.virtualGamepad, keyboard: environment.inputAdapter.keyboard, pointer: environment.inputAdapter.pointer, rumble: environment.inputAdapter.rumble}};
const virtualGamepadPermission = virtualGamepadPermissionGranted({inputEnabled, inputAdapter: environment.inputAdapter});
const inputExecutor = inputEnabled && hostRuntime.bindings?.input && environment.readiness.osInput ? createNativeInputExecutor({platform: environment.platform, adapter: hostRuntime.bindings.input, permissions: {'remote-input': true, 'virtual-gamepad': virtualGamepadPermission}}) : null;
const rumbleBroadcast = inputExecutor ? createRumbleBroadcastController({adapter: inputExecutor.adapter}) : null;
rumbleBroadcast?.attach();
const gameLaunchEnabled = args.get('enable-game-launch') === true || args.get('enable-game-launch') === 'true';
let configuredGameArgs = args.get('game-args-json') ? JSON.parse(String(args.get('game-args-json'))) : (args.get('game-arg') ? [String(args.get('game-arg'))] : []);
if (!Array.isArray(configuredGameArgs)) throw new TypeError('game-args-json must contain an array');
const gameLaunch = gameLaunchEnabled ? createReferenceGameLaunch({platform: environment.platform, runtimeId: args.get('runtime-id'), runtimeKind: args.get('runtime-kind') || 'native-emulator', runtimeVersion: args.get('runtime-version') || 'unversioned', runtimePath: args.get('runtime-path'), gamePath: args.get('game-path'), hostContentId: args.get('host-content-id'), args: configuredGameArgs, cwd: args.get('game-cwd'), spawnImpl: undefined, maxOutputBytes: 64 * 1024, stopTimeoutMs: 2_000}) : null;
const nativeRuntimeProfile = gameLaunch ? {id: String(args.get('runtime-id')), kind: String(args.get('runtime-kind') || 'native-emulator'), version: String(args.get('runtime-version') || 'unversioned'), trust: 'signed', enabled: true, executablePath: String(args.get('runtime-path'))} : null;
const hostCapabilities = normalizeHostCapabilities({media: {state: nativeMediaEnabled ? 'ready' : 'not-configured', capture: nativeMediaEnabled, encode: nativeMediaEnabled, audio: nativeMediaEnabled && nativeAudioEnabled, transports: nativeMediaEnabled ? ['webrtc'] : ['webrtc']}, process: {mode: gameLaunch ? 'managed' : 'none', launch: Boolean(gameLaunch), emulator: Boolean(gameLaunch)}, publisher: nativeMediaEnabled ? {state: 'ready', transports: ['webrtc'], video: capabilities.video, audio: capabilities.audio} : environment.publisher, audioPublisher: nativeMediaEnabled && nativeAudioEnabled ? {state: 'ready', codecs: ['opus'], channels: 2} : environment.audioPublisher, inputAdapter: environment.inputAdapter, webrtc: nativeMediaEnabled ? {adapters: [{id: 'werift', state: 'available'}]} : environment.webrtc, input: capabilities.input});
const sessions = new Set(); const connections = new Set(); let rejectedConnections = 0; let inputEvents = 0; let droppedInputEvents = 0; let lastQuality = null; let lastInputPlan = null; let lastInputExecution = {state: inputExecutor ? 'ready' : 'disabled', reason: inputEnabled && !inputExecutor ? 'native input adapter is unavailable or not ready' : null};

function json(response, status, body) { response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}); response.end(JSON.stringify(body)); }
function originAllowed(origin) { return !allowedOrigins.length || (typeof origin === 'string' && allowedOrigins.includes(origin)); }
function createMessageRateLimiter(limit, windowMs = 1000) { let startedAt = Date.now(); let count = 0; return () => { const now = Date.now(); if (now - startedAt >= windowMs) { startedAt = now; count = 0; } count += 1; return count <= limit; }; }
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
  if (nativeMediaEnabled && session.native) { session.native.receive(message); return; }
  if (nativeMediaEnabled && message.type === 'session.offer' && !session.accepted) {
    if (message.payload.hostId !== hostId || !pairing.matches(message.payload.pairingCode)) { connection.close(); return; }
    if (message.payload.launch && (!gameLaunch || !gameLaunch.matches(message.payload.launch))) { connection.send(createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: false, hostId, hostName, reason: 'launch request does not match host-local runtime or content'}})); connection.close(); return; }
    if (!pairing.verify(message.payload.pairingCode)) { connection.close(); return; }
    let native;
    try {
      native = createNativeWeriftConnection({connection, sessionId: message.sessionId, bindings: hostRuntime.bindings, module: weriftModule, platform: environment.platform, permissions: {'screen-capture': true, 'remote-input': inputEnabled, 'virtual-gamepad': virtualGamepadPermission, ...(nativeAudioEnabled ? {microphone: true, 'microphone-capture': true} : {})}, includeAudio: nativeAudioEnabled, audioOptions, runtimeProfile: nativeRuntimeProfile, gamePath: args.get('game-path') ? String(args.get('game-path')) : null, gameArgs: configuredGameArgs, gameCwd: args.get('game-cwd'), gameEnv: undefined, hostContentId: args.get('host-content-id') ? String(args.get('host-content-id')) : null, hostId, hostName, capabilities, onInput: () => { inputEvents += 1; }, onQuality: quality => { lastQuality = quality; }});
      session.native = native; session.sessionId = message.sessionId;
      const connected = new Promise((resolve, reject) => { const offConnected = native.host.on('connected', value => { offConnected?.(); offError?.(); resolve(value); }); const offError = native.host.on('error', error => { offConnected?.(); offError?.(); reject(error); }); });
      await native.start(); native.receive(message); await connected; session.accepted = true; sessions.add(session); if (rumbleBroadcast && session.send) rumbleBroadcast.add(session); return;
    } catch (error) { session.native = null; native?.close(); connection.send(createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: false, hostId, hostName, reason: `native media start failed: ${error.message}`}})); connection.close(); return; }
  }
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
    sessions.add(session); if (rumbleBroadcast && session.send) rumbleBroadcast.add(session); const answer = createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: true, hostId, hostName, capabilities: session.negotiated, hostCapabilities}});
    connection.send(answer);
    return;
  }
  if (message.sessionId !== session.sessionId) { connection.close(); return; }
  if (message.type === 'quality.request') { lastQuality = {profile: String(message.payload.profile || 'balanced'), maxWidth: Number(message.payload.maxWidth) || 0, maxHeight: Number(message.payload.maxHeight) || 0, maxFramerate: Number(message.payload.maxFramerate) || 0, bitrateKbps: Number(message.payload.bitrateKbps) || 0}; return; }
  if (message.type === 'input.event') { inputEvents += 1; session.lastInputAt = message.sentAt; if (!inputExecutor) { lastInputExecution = {state: 'disabled', reason: 'start the host with --enable-input after installing a ready native input adapter'}; return; } try { const event = {type: 'input.event', ...message.payload}; lastInputPlan = createInputInjectionPlan({platform: environment.platform, event, permissions: {'remote-input': true, 'virtual-gamepad': virtualGamepadPermission}}); lastInputExecution = {state: 'dispatching', reason: null}; inputExecutor.dispatch(event).then(plan => { if (plan?.unsupported) { droppedInputEvents += 1; lastInputExecution = {state: 'active', reason: `unsupported input dropped: ${plan.reason}`}; } else { lastInputExecution = {state: 'active', reason: null}; } }).catch(error => { lastInputExecution = {state: 'failed', reason: error.message}; }); } catch (error) { lastInputPlan = {state: 'failed', reason: error.message}; lastInputExecution = {state: 'failed', reason: error.message}; } return; }
  if (message.type === 'session.reconnect') { const answer = createSessionEnvelope({sessionId: message.sessionId, type: 'session.answer', sequence: (message.sequence || 0) + 1, payload: {accepted: true, hostId, capabilities: session.negotiated || capabilities, hostCapabilities}}); connection.send(answer); return; }
  if (message.type === 'session.close') { sessions.delete(session); if (session.gameStarted) { await gameLaunch?.launcher.stop(); session.gameStarted = false; } connection.close(); }
}

const requestHandler = (request, response) => {
  if (!originAllowed(request.headers.origin)) return json(response, 403, {error: 'origin is not allowed'});
  if (request.headers.origin && allowedOrigins.includes(request.headers.origin)) { response.setHeader('access-control-allow-origin', request.headers.origin); response.setHeader('vary', 'Origin'); }
  if (request.url === '/health') return json(response, 200, {service: 'spartan-host-reference', version: 1, secure, hostId, hostName, pairingExpiresAt: pairing.expiresAt, pairingUsed: pairing.used, activeSessions: sessions.size, connections: connections.size, rejectedConnections, limits: {maxConnections, maxMessagesPerSecond}, allowedOrigins, inputEvents, droppedInputEvents, lastInputPlan, lastInputExecution, lastQuality, gameLaunch: gameLaunch ? {enabled: true, ...gameLaunch.descriptor, state: gameLaunch.launcher.state, pid: gameLaunch.launcher.pid} : {enabled: false}, capabilities, hostCapabilities, environment});
  json(response, 404, {error: 'not found'});
};
const server = secure ? createHttpsServer({key: readFileSync(tlsKey), cert: readFileSync(tlsCert)}, requestHandler) : createHttpServer(requestHandler);
server.on('upgrade', (request, socket) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (!originAllowed(request.headers.origin)) { rejectedConnections += 1; socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
  if (connections.size >= maxConnections) { rejectedConnections += 1; socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
  if (url.pathname !== '/session' || request.headers.upgrade?.toLowerCase() !== 'websocket' || !request.headers['sec-websocket-key']) { rejectedConnections += 1; socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
  connections.add(socket); let detached = false; const takeMessage = createMessageRateLimiter(maxMessagesPerSecond);
  const cleanup = () => { if (detached) return; detached = true; connections.delete(socket); sessions.delete(session); rumbleBroadcast?.remove(session); session.native?.close(); if (session.gameStarted) { void gameLaunch?.launcher.stop(); session.gameStarted = false; } };
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(request.headers['sec-websocket-key'])}\r\n\r\n`);
  const connection = {send: value => socket.write(frame(JSON.stringify(value))), close: () => socket.end(closeFrame())};
  const session = {accepted: false, sessionId: null, negotiated: null, send: connection.send}; let buffer = Buffer.alloc(0);
  socket.on('data', chunk => { if (!takeMessage()) { socket.end(closeFrame()); return; } buffer = parseFrames(Buffer.concat([buffer, chunk]), text => handleMessage(connection, text, session), socket); });
  socket.on('close', cleanup); socket.on('error', cleanup);
});
server.listen(port, bind, () => {
  const actualPort = server.address().port;
    console.log(JSON.stringify({service: nativeMediaEnabled ? 'spartan-host-native' : 'spartan-host-reference', endpoint: `${secure ? 'wss' : 'ws'}://${bind}:${actualPort}/session`, health: `${secure ? 'https' : 'http'}://${bind}:${actualPort}/health`, secure, hostId, hostName, pairingCode: args.get('quiet') ? undefined : pairingCode, pairingExpiresAt: pairing.expiresAt, allowedOrigins, limits: {maxConnections, maxMessagesPerSecond}, signalingEndpoint: signalEndpoint || undefined, warning: nativeMediaEnabled ? 'Native media mode is enabled; capture, encoding, WebRTC, and optional audio run through installed platform bindings.' : (gameLaunch ? 'Reference control plane with optional configured game launch; media capture/encoding remain separate.' : 'Reference control plane only; media capture/encoding and process launch are not configured.')}));
  if (!signalEndpoint && !signalSessionId && !signalTicket) return;
  if (!signalEndpoint || !signalSessionId || !signalTicket) { console.error('Outbound signaling requires --signal-endpoint, --signal-session, and --signal-ticket.'); process.exitCode = 1; return; }
  let signalingClient;
  const signalSession = {accepted: false, sessionId: signalSessionId, negotiated: null};
  signalingClient = createHostSignalingClient({endpoint: signalEndpoint, sessionId: signalSessionId, ticket: signalTicket, onMessage: message => handleMessage(signalingClient, JSON.stringify(message), signalSession), onError: error => console.error(`host signaling error: ${error.message}`), onClose: () => console.error('host signaling connection closed')});
  signalingClient.connect().catch(error => { console.error(`host signaling connection failed: ${error.message}`); process.exitCode = 1; });
});
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`host received ${signal}; stopping sessions and children before exit`);
  const forceExit = setTimeout(() => { process.exitCode = 1; process.exit(1); }, 5_000);
  forceExit.unref?.();
  for (const session of sessions) { if (session.native?.close) session.native.close(); if (session.gameStarted) { void gameLaunch?.launcher.stop().catch(() => {}); session.gameStarted = false; } }
  sessions.clear();
  for (const socket of connections) socket.end(closeFrame());
  connections.clear();
  server.close(() => { clearTimeout(forceExit); process.exit(0); });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));
server.on('close', () => { rumbleBroadcast?.detach(); inputExecutor?.close(); });
