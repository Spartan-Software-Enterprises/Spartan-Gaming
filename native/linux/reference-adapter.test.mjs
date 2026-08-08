import assert from 'node:assert/strict';
import test from 'node:test';
import {createBindings, inputCommand, keyName} from './reference-adapter.mjs';

function probe(command) { return {status: ['ffmpeg', 'xdotool', 'pactl'].includes(command) ? 0 : 1}; }

test('Linux reference bindings report capability readiness without hiding missing session tools', async () => {
  const bindings = await createBindings({environment: {DISPLAY: ':1', XDG_RUNTIME_DIR: '/run/user/1000'}, spawnProbe: probe});
  assert.equal(bindings.platform, 'linux');
  assert.equal(bindings.capture.plan({permissionGranted: true}).platform, 'linux');
  assert.equal(bindings.audio.plan({permissionGranted: true}).platform, 'linux');
  assert.deepEqual(bindings.capabilities, {capture: true, audio: true, input: true, keyboard: true, pointer: true, gamepad: false, rumble: false, technologies: {capture: 'FFmpeg x11grab/PipeWire', audio: 'FFmpeg Pulse/PipeWire', input: 'X11 XTest via xdotool'}, requires: ['screen-capture-permission', 'audio-session-permission', 'remote-input-permission']});
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
  assert.throws(() => keyName('F25'), error => error.code === 'ERR_UNSUPPORTED_INPUT' && /F25/.test(error.message));
  assert.throws(() => inputCommand({kind: 'button', control: 'a'}), error => error.code === 'ERR_UNSUPPORTED_INPUT');
  assert.throws(() => inputCommand({kind: 'pointer', action: 'pointer:down', control: 'button-9'}), error => error.code === 'ERR_UNSUPPORTED_INPUT');
});

test('Linux reference media bindings require explicit permission before spawning FFmpeg', async () => {
  const bindings = await createBindings({environment: {DISPLAY: ':1'}, spawnProbe: probe, spawnImpl: () => { throw new Error('spawn must not be reached'); }});
  await assert.rejects(() => bindings.capture.start(), /screen-capture permission/);
  await assert.rejects(() => bindings.audio.start(), /audio-capture permission/);
});
