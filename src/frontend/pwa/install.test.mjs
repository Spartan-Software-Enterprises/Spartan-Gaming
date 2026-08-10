import test from 'node:test';
import assert from 'node:assert/strict';
import {createPwaInstallController} from './install.mjs';

function fakeWindow() {
  const listeners = new Map();
  return {listeners, addEventListener(type, callback) { listeners.set(type, callback); }, removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); }, matchMedia() { return {matches: false}; }};
}

test('PWA install controller captures and prompts for a deferred install event', async () => {
  const windowRef = fakeWindow(); const states = []; let prevented = 0; let prompted = 0;
  const controller = createPwaInstallController({windowRef, onState: state => states.push(state)});
  const event = {preventDefault() { prevented += 1; }, async prompt() { prompted += 1; }, userChoice: Promise.resolve({outcome: 'accepted'})};
  windowRef.listeners.get('beforeinstallprompt')(event);
  assert.equal(controller.state, 'available'); assert.equal(controller.canInstall, true); assert.equal(prevented, 1);
  assert.deepEqual(await controller.prompt(), {status: 'accepted'});
  assert.equal(prompted, 1); assert.equal(controller.canInstall, false); assert.deepEqual(states, ['available', 'accepted']);
});

test('PWA install controller handles installation and removes listeners', async () => {
  const windowRef = fakeWindow(); const controller = createPwaInstallController({windowRef});
  windowRef.listeners.get('beforeinstallprompt')({preventDefault() {}, prompt() {}, userChoice: Promise.resolve({outcome: 'dismissed'})});
  windowRef.listeners.get('appinstalled')();
  assert.equal(controller.state, 'installed'); assert.deepEqual(await controller.prompt(), {status: 'unavailable'});
  controller.close(); assert.equal(windowRef.listeners.size, 0);
});
