import assert from 'node:assert/strict';
import test from 'node:test';
import {createBindings, inputCommand} from './reference-adapter.mjs';

function probe(command) { return {status: ['ffmpeg', 'xdotool', 'pactl'].includes(command) ? 0 : 1}; }

test('Linux reference bindings report capability readiness without hiding missing session tools', async () => {
  const bindings = await createBindings({environment: {DISPLAY: ':1', XDG_RUNTIME_DIR: '/run/user/1000'}, spawnProbe: probe});
  assert.equal(bindings.platform, 'linux');
  assert.deepEqual(bindings.capabilities, {capture: true, audio: true, input: true, keyboard: true, pointer: true, gamepad: false, rumble: false, technologies: {capture: 'FFmpeg x11grab/PipeWire', audio: 'FFmpeg Pulse/PipeWire', input: 'X11 XTest via xdotool'}, requires: ['screen-capture-permission', 'audio-session-permission', 'remote-input-permission']});
});

test('Linux reference input maps only normalized keyboard and pointer operations to shell-free argv', () => {
  assert.deepEqual(inputCommand({kind: 'key', control: 'KeyA', pressed: true}), {args: ['keydown', 'a']});
  assert.deepEqual(inputCommand({kind: 'key', control: 'ArrowLeft', pressed: false}), {args: ['keyup', 'left']});
  assert.deepEqual(inputCommand({kind: 'pointer', deltaX: 12.4, deltaY: -9.6}), {args: ['mousemove_relative', '--', '12', '-10']});
  assert.throws(() => inputCommand({kind: 'button', control: 'a'}), /does not implement/);
});

test('Linux reference media bindings require explicit permission before spawning FFmpeg', async () => {
  const bindings = await createBindings({environment: {DISPLAY: ':1'}, spawnProbe: probe, spawnImpl: () => { throw new Error('spawn must not be reached'); }});
  await assert.rejects(() => bindings.capture.start(), /screen-capture permission/);
  await assert.rejects(() => bindings.audio.start(), /audio-capture permission/);
});
