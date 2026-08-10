import assert from 'node:assert/strict';
import test from 'node:test';
import {createBindings, inputCommand, keyName, probeX11Display} from './reference-adapter.mjs';

function probe(command) { return {status: ['ffmpeg', 'xdotool', 'pactl'].includes(command) ? 0 : 1}; }
function encoderOutput() { return ` V..... libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 encoder (codec h264)\n V....D h264_vaapi            H.264/AVC (VAAPI) (codec h264)\n V..... libvpx-vp9            libvpx VP9 (codec vp9)\n V....D vp9_vaapi             VP9 (VAAPI) (codec vp9)\n V..... libaom-av1            libaom AV1 (codec av1)\n V....D av1_vaapi             AV1 (VAAPI) (codec av1)\n`; }

test('Linux reference bindings report capability readiness without hiding missing session tools', async () => {
  const bindings = await createBindings({environment: {DISPLAY: ':1', XDG_RUNTIME_DIR: '/run/user/1000'}, spawnProbe: (command, args) => command === 'ffmpeg' && args?.[1] === '-encoders' ? {error: null, status: 0, stdout: encoderOutput()} : probe(command, args)});
  assert.equal(bindings.platform, 'linux');
  assert.equal(bindings.capture.plan({permissionGranted: true}).platform, 'linux');
  assert.equal(bindings.audio.plan({permissionGranted: true}).platform, 'linux');
  assert.equal(bindings.capabilities.encoders.hardware[0].encoder, 'h264_vaapi');
  assert.deepEqual(bindings.capabilities.encoders.hardware.map(entry => entry.codec), ['h264', 'vp9', 'av1']);
  assert.deepEqual(bindings.capabilities, {capture: true, audio: true, input: true, keyboard: true, pointer: true, gamepad: false, virtualGamepad: false, rumble: false, portal: false, encoders: {hardware: [{codec: 'h264', encoder: 'h264_vaapi', device: '/dev/dri/renderD128'}, {codec: 'vp9', encoder: 'vp9_vaapi', device: '/dev/dri/renderD128'}, {codec: 'av1', encoder: 'av1_vaapi', device: '/dev/dri/renderD128'}]}, technologies: {capture: 'FFmpeg x11grab/PipeWire', audio: 'FFmpeg Pulse/PipeWire', input: 'X11 XTest via xdotool'}, requires: ['screen-capture-permission', 'audio-session-permission', 'remote-input-permission']});
});

test('Linux portal consent gates capture and audio plans until granted', async () => {
  const environment = {DISPLAY: ':1', XDG_RUNTIME_DIR: '/run/user/1000', DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus', WAYLAND_DISPLAY: 'wayland-0'};
  const portalProbe = command => { const probeProbe = probe(command); return command === 'xdg-desktop-portal' ? {status: 0} : probeProbe; };
  const bindings = await createBindings({environment, spawnProbe: portalProbe});
  assert.equal(bindings.capabilities.portal, true);
  assert.equal(bindings.consent.status, 'available');
  await assert.rejects(async () => bindings.capture.plan(), /screen-capture permission/);
  await assert.rejects(async () => bindings.audio.plan(), /audio-capture permission/);
  assert.deepEqual(bindings.consent.request('capture'), {kind: 'capture', granted: true, portal: 'org.freedesktop.portal.ScreenCast'});
  assert.equal(bindings.consent.granted('capture'), true);
  assert.equal(bindings.capture.plan().sourceType, 'pipewire');
  assert.equal(bindings.consent.status, 'granted');
  bindings.consent.revoke();
  await assert.rejects(async () => bindings.capture.plan(), /screen-capture permission/);
  assert.throws(() => bindings.consent.request('keyboard'), /unsupported portal consent kind/);
});

test('Linux portal consent fails closed without a reachable portal session', async () => {
  const bindings = await createBindings({environment: {DISPLAY: ':1'}, spawnProbe: probe});
  assert.equal(bindings.consent.available, false);
  assert.equal(bindings.consent.status, 'unavailable');
  assert.throws(() => bindings.consent.request('capture'), /not reachable/);
});

test('Linux reference input maps only normalized keyboard and pointer operations to shell-free argv', () => {
  assert.deepEqual(inputCommand({kind: 'key', control: 'KeyA', pressed: true}), {args: ['keydown', 'a']});
  assert.deepEqual(inputCommand({kind: 'key', control: 'ArrowLeft', pressed: false}), {args: ['keyup', 'Left']});
  assert.deepEqual(inputCommand({kind: 'pointer', deltaX: 12.4, deltaY: -9.6}), {args: ['mousemove_relative', '--', '12', '-10']});
  assert.deepEqual(inputCommand({kind: 'pointer', action: 'pointer:down', control: 'button-0'}), {args: ['mousedown', '1']});
  assert.deepEqual(inputCommand({kind: 'pointer', action: 'pointer:up', control: 'button-2'}), {args: ['mouseup', '3']});
  assert.deepEqual(inputCommand({kind: 'pointer', action: 'pointer:wheel', deltaY: -120}), {args: ['click', '4']});
  assert.deepEqual(inputCommand({kind: 'pointer', action: 'pointer:wheel', deltaX: 120, deltaY: 0}), {args: ['click', '7']});
  assert.equal(keyName('ControlLeft'), 'Control_L');
  assert.equal(keyName('F12'), 'F12');
  assert.equal(keyName('Home'), 'Home');
  assert.equal(keyName('End'), 'End');
  assert.equal(keyName('Insert'), 'Insert');
  assert.equal(keyName('Delete'), 'Delete');
  assert.equal(keyName('Comma'), 'comma');
  assert.equal(keyName('Period'), 'period');
  assert.equal(keyName('Semicolon'), 'semicolon');
  assert.equal(keyName('Quote'), 'apostrophe');
  assert.equal(keyName('Backquote'), 'grave');
  assert.equal(keyName('Slash'), 'slash');
  assert.equal(keyName('Backslash'), 'backslash');
  assert.equal(keyName('Minus'), 'minus');
  assert.equal(keyName('Equal'), 'equal');
  assert.equal(keyName('BracketLeft'), 'bracketleft');
  assert.equal(keyName('BracketRight'), 'bracketright');
  assert.equal(keyName('CapsLock'), 'Caps_Lock');
  assert.equal(keyName('PageUp'), 'Page_Up');
  assert.equal(keyName('PageDown'), 'Page_Down');
  assert.equal(keyName('Numpad0'), 'KP_0');
  assert.equal(keyName('NumpadEnter'), 'KP_Enter');
  assert.equal(keyName('NumLock'), 'Num_Lock');
  assert.equal(keyName('PrintScreen'), 'Print');
  assert.equal(keyName('ScrollLock'), 'Scroll_Lock');
  assert.equal(keyName('ContextMenu'), 'Menu');
  assert.equal(keyName('IntlBackslash'), 'backslash');
  assert.equal(keyName('IntlRo'), 'backslash');
  assert.equal(keyName('IntlYen'), 'yen');
  assert.equal(keyName('AudioVolumeUp'), 'XF86AudioRaiseVolume');
  assert.equal(keyName('AudioVolumeMute'), 'XF86AudioMute');
  assert.equal(keyName('MediaPlayPause'), 'XF86AudioPlay');
  assert.equal(keyName('MediaTrackNext'), 'XF86AudioNext');
  assert.equal(keyName('BrowserBack'), 'XF86Back');
  assert.equal(keyName('BrowserForward'), 'XF86Forward');
  assert.equal(keyName('BrowserHome'), 'XF86HomePage');
  assert.equal(keyName('LaunchMail'), 'XF86Mail');
  assert.equal(keyName('Sleep'), 'XF86Sleep');
  assert.equal(keyName('WakeUp'), 'XF86WakeUp');
  assert.equal(keyName('Print'), 'Print');
  assert.equal(keyName('Help'), 'Help');
  assert.throws(() => keyName('F25'), error => error.code === 'ERR_UNSUPPORTED_INPUT' && /F25/.test(error.message));
  assert.throws(() => inputCommand({kind: 'button', control: 'a'}), error => error.code === 'ERR_UNSUPPORTED_INPUT');
  assert.throws(() => inputCommand({kind: 'pointer', action: 'pointer:down', control: 'button-9'}), error => error.code === 'ERR_UNSUPPORTED_INPUT');
});

test('Linux reference media bindings require explicit permission before spawning FFmpeg', async () => {
  const bindings = await createBindings({environment: {DISPLAY: ':1'}, spawnProbe: probe, spawnImpl: () => { throw new Error('spawn must not be reached'); }});
  await assert.rejects(() => bindings.capture.start(), /screen-capture permission/);
  await assert.rejects(() => bindings.audio.start(), /audio-capture permission/);
});

test('Linux reference audio bindings enumerate pactl capture devices without a shell', async () => {
  const sources = '0\talsa_output.pci-0000_00_1f.3.analog-stereo.monitor\tmodule-alsa-card.c\tRUNNING\n1\talsa_input.pci-0000_00_1f.3.analog-stereo\tmodule-alsa-card.c\tRUNNING\n2\talsa_input.usb-046d_C922_Pro_Stream_Webcam\tmodule-alsa-card.c\tSUSPENDED\n';
  const bindings = await createBindings({environment: {DISPLAY: ':1'}, spawnProbe: (command, args) => command === 'pactl' && args?.join(' ') === 'list short sources' ? {error: null, status: 0, stdout: sources} : probe(command, args)});
  assert.deepEqual(bindings.audio.devices().map(device => device.id), ['alsa_input.pci-0000_00_1f.3.analog-stereo', 'alsa_input.usb-046d_C922_Pro_Stream_Webcam']);
  assert.equal(bindings.audio.devices()[0].kind, 'capture');
  assert.equal(bindings.audio.plan({permissionGranted: true, source: 'alsa_input.usb-046d_C922_Pro_Stream_Webcam'}).source, 'alsa_input.usb-046d_C922_Pro_Stream_Webcam');
  assert.deepEqual(bindings.audio.devices({includeMonitors: true}).map(device => device.kind), ['monitor', 'capture', 'capture']);
});

test('Linux reference bindings expose a bounded display descriptor from a real xrandr query', async () => {
  const xrandr = 'Screen 0: minimum 16 x 16, current 1360 x 768, maximum 32767 x 32767\nHDMI-A-1 connected primary 1360x768+0+0 (normal left inverted right x axis y axis) 0mm x 0mm\n   1360x768      59.80*+   \n   1024x768      59.92  \n';
  const bindings = await createBindings({environment: {DISPLAY: ':1'}, spawnProbe: (command, args) => command === 'xrandr' && args?.join(' ') === '--query' ? {error: null, status: 0, stdout: xrandr} : probe(command, args)});
  assert.deepEqual(bindings.display, {width: 1360, height: 768, maxRefreshRate: 60, count: 1, hdr: false});
  assert.deepEqual(probeX11Display('not xrandr output'), null);
  assert.deepEqual(probeX11Display(), null);
});
