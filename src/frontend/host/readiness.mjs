import {normalizeControllerPolicy} from '../input/controller-policy.mjs';

const TRANSPORTS = Object.freeze(['webrtc', 'webtransport', 'websocket']);

function readyState(value) { return value === 'ready' || value === 'active'; }

function nativeBindingSummary(environment = {}) {
  const binding = environment.nativeBinding || {};
  const status = ['available', 'unavailable'].includes(binding.status) ? binding.status : 'not-reported';
  const capabilities = binding.capabilities && typeof binding.capabilities === 'object' ? Object.freeze(Object.fromEntries(Object.entries(binding.capabilities).filter(([key, value]) => typeof value === 'boolean').slice(0, 16))) : Object.freeze({});
  return Object.freeze({status, platform: typeof environment.platform === 'string' ? environment.platform : null, packageName: typeof binding.packageName === 'string' ? binding.packageName : null, reason: typeof binding.reason === 'string' ? binding.reason : null, capabilities});
}

function virtualGamepadBindingSummary(environment = {}) {
  const binding = environment.virtualGamepadBinding || {};
  const status = ['available', 'unavailable'].includes(binding.status) ? binding.status : 'not-reported';
  const capabilities = binding.capabilities && typeof binding.capabilities === 'object' ? Object.freeze(Object.fromEntries(Object.entries(binding.capabilities).filter(([key, value]) => typeof value === 'boolean').slice(0, 16))) : Object.freeze({});
  return Object.freeze({status, platform: typeof binding.platform === 'string' ? binding.platform : (typeof environment.platform === 'string' ? environment.platform : null), packageName: typeof binding.packageName === 'string' ? binding.packageName : null, reason: typeof binding.reason === 'string' ? binding.reason : null, capabilities});
}

function controllerPolicySummary(policy) {
  const normalized = normalizeControllerPolicy(policy);
  return Object.freeze({version: normalized.version, profile: normalized.defaultProfile, inputMode: normalized.inputMode, slots: normalized.playerSlots, gamepad: normalized.allowGamepad, hid: normalized.allowHid, rumble: normalized.rumble && normalized.hapticsBackend !== 'Disabled', haptics: normalized.hapticsBackend, virtualBackend: normalized.virtualGamepadBackend});
}

export function createHostPreflight({capabilities = {}, environment = {}, controllerPolicy, clientTransports = TRANSPORTS} = {}) {
  const media = capabilities.media || {};
  const publisher = capabilities.publisher || {};
  const audioPublisher = capabilities.audioPublisher || {};
  const input = capabilities.input || {};
  const hostTransports = Array.isArray(capabilities.transports) && capabilities.transports.length ? capabilities.transports : media.transports || [];
  const transport = clientTransports.find(candidate => hostTransports.includes(candidate));
  const checks = Object.freeze([
    {id: 'media-capture', label: 'Media capture', status: media.capture && (environment.readiness?.mediaCapture !== false) ? 'ready' : 'missing', detail: media.capture ? 'Capture adapter available' : 'Native capture adapter required'},
    {id: 'media-encode', label: 'Video encoding', status: media.encode && (environment.readiness?.mediaEncode !== false) ? 'ready' : 'missing', detail: media.encode ? 'Encoder available' : 'Hardware or software encoder required'},
    {id: 'publisher', label: 'Stream publisher', status: readyState(publisher.state) ? 'ready' : 'missing', detail: readyState(publisher.state) ? 'Publisher ready' : 'WebRTC publisher is not configured'},
    {id: 'audio', label: 'Host audio', status: media.audio || readyState(audioPublisher.state) ? 'ready' : 'warning', detail: media.audio || readyState(audioPublisher.state) ? 'Audio return available' : 'Audio return is not configured'},
    {id: 'transport', label: 'Transport', status: transport ? 'ready' : 'missing', detail: transport ? `${transport} is shared with this browser` : 'No compatible transport'},
    {id: 'input', label: 'Host input', status: input.gamepad || input.keyboard || input.pointer ? 'ready' : 'warning', detail: input.gamepad || input.keyboard || input.pointer ? 'Input adapter advertised' : 'Host input adapter is not configured'},
  ]);
  const blocking = checks.filter(check => check.status === 'missing');
  return Object.freeze({status: blocking.length ? 'configuration-required' : 'ready', transport: transport || null, checks, blocking: Object.freeze(blocking.map(check => check.id)), hostName: environment.hostName || null, nativeBinding: nativeBindingSummary(environment), virtualGamepadBinding: virtualGamepadBindingSummary(environment), controllerPolicy: controllerPolicySummary(controllerPolicy), tools: Object.freeze(environment.tools && typeof environment.tools === 'object' ? {ffmpeg: Boolean(environment.tools.ffmpeg), gstreamer: Boolean(environment.tools.gstreamer)} : {})});
}
