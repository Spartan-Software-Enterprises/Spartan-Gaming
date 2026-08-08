import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveRecoveryPresentation, resolveResumeEntry, resolveResumePresentation} from './resume.mjs';
import './library-state.test.mjs';
import '../startup/route.test.mjs';

test('resume presentation defaults to the host session and describes recent backends', () => {
  assert.deepEqual(resolveResumePresentation(), {title: 'Desktop stream', copy: 'Pick up where you left off with your Spartan Host session.', actionLabel: '▶ Resume session'});
  assert.deepEqual(resolveResumePresentation({name: 'PCSX2', backendType: 'emulator', action: 'choose-runtime'}), {title: 'PCSX2', copy: 'Continue with your last emulation connection.', actionLabel: 'Configure runtime'});
  assert.equal(resolveResumePresentation({name: 'GeForce NOW', backendType: 'provider', action: 'open-url'}).actionLabel, 'Open service');
});

test('resume lookup is limited to the current normalized catalog', () => {
  const catalog = [{id: 'known', name: 'Known'}, {id: 'other', name: 'Other'}];
  assert.equal(resolveResumeEntry({backendId: 'known'}, catalog), catalog[0]);
  assert.equal(resolveResumeEntry({backendId: 'missing'}, catalog), undefined);
  assert.equal(resolveResumeEntry({backendId: 'known'}, null), undefined);
});

test('recovery presentation exposes no connection secret', () => {
  assert.deepEqual(resolveRecoveryPresentation({backendName: 'Office host', endpoint: 'wss://signal.example', ticket: 'secret'}), {title: 'Office host', copy: 'A short-lived Spartan Host connection is ready to continue in this browser session.', actionLabel: '▶ Resume secure session'});
  assert.equal(resolveRecoveryPresentation(null), null);
});
