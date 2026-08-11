import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_CONTROLLER_PROFILES,
  CONTROLLER_PROFILE_CAPABILITIES,
  createControllerProfile,
  createControllerProfileStore,
  resolveControllerProfile,
  updateControllerBinding,
  validateBindings,
} from './profiles.mjs';
import { CONTROLLER_PROFILE_OPTIONS } from './controller-policy.mjs';

test('built-in profiles cover common controller families and are immutable', () => {
  assert.equal(BUILTIN_CONTROLLER_PROFILES.length, 24);
  assert.ok(BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'xbox-elite-layout'));
  assert.ok(BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'xbox-adaptive-layout'));
  assert.ok(BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'dualsense-edge-layout'));
  assert.ok(
    BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'playstation-portal-layout'),
  );
  assert.ok(BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'joy-con-layout'));
  assert.ok(BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'wii-u-pro-layout'));
  assert.ok(
    BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'steam-controller-layout'),
  );
  assert.ok(BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'logitech-wheel-layout'));
  assert.ok(
    BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'thrustmaster-wheel-layout'),
  );
  assert.ok(BUILTIN_CONTROLLER_PROFILES.some((profile) => profile.id === 'hotas-layout'));
  assert.equal(Object.isFrozen(BUILTIN_CONTROLLER_PROFILES[0]), true);
});
test('variant profiles preserve unique extra controls', () => {
  const elite = BUILTIN_CONTROLLER_PROFILES.find((profile) => profile.id === 'xbox-elite-layout');
  const edge = BUILTIN_CONTROLLER_PROFILES.find(
    (profile) => profile.id === 'dualsense-edge-layout',
  );
  assert.equal(elite.bindings.leftPaddle2, 'button-13');
  assert.equal(edge.bindings.rightPaddle, 'button-16');
  assert.equal(new Set(Object.values(elite.bindings)).size, Object.keys(elite.bindings).length);
});
test('built-in profiles declare bounded device capabilities alongside bindings', () => {
  const dualsense = BUILTIN_CONTROLLER_PROFILES.find(
    (profile) => profile.id === 'dualsense-layout',
  );
  const wheel = BUILTIN_CONTROLLER_PROFILES.find(
    (profile) => profile.id === 'logitech-wheel-layout',
  );
  assert.deepEqual(dualsense.capabilities, [
    'touchpad',
    'gyro',
    'adaptiveTriggers',
    'haptics',
    'battery',
  ]);
  assert.deepEqual(wheel.capabilities, ['wheel', 'pedals', 'haptics']);
  assert.equal(Object.isFrozen(dualsense.capabilities), true);
});
test('profile capability editor vocabulary is bounded and immutable', () => {
  assert.ok(CONTROLLER_PROFILE_CAPABILITIES.includes('adaptiveTriggers'));
  assert.ok(CONTROLLER_PROFILE_CAPABILITIES.includes('wheel'));
  assert.equal(Object.isFrozen(CONTROLLER_PROFILE_CAPABILITIES), true);
});

test('automatic profile selection recognizes common console controller names', () => {
  assert.equal(
    resolveControllerProfile({ deviceName: 'Xbox Wireless Controller' }).id,
    'xbox-layout',
  );
  assert.equal(
    resolveControllerProfile({ deviceName: 'Sony Wireless Controller' }).id,
    'dualsense-layout',
  );
  assert.equal(
    resolveControllerProfile({ deviceName: 'Nintendo Switch Pro Controller' }).id,
    'switch-pro-layout',
  );
  assert.equal(
    resolveControllerProfile({ deviceName: '8BitDo Ultimate 2C' }).id,
    'eightbitdo-layout',
  );
});
test('binding validation rejects collisions', () => {
  assert.throws(
    () => validateBindings({ confirm: 'button-0', cancel: 'button-0' }),
    /already bound/,
  );
});
test('profile updates preserve metadata and reject accidental collisions', () => {
  const profile = createControllerProfile({ id: 'test-pad', name: 'Test pad' });
  const updated = updateControllerBinding(profile, 'confirm', 'button-4');
  assert.equal(updated.bindings.confirm, 'button-4');
  assert.throws(() => updateControllerBinding(updated, 'cancel', 'button-4'), /already bound/);
});
test('profile store persists, replaces, and removes profiles', () => {
  const store = createControllerProfileStore();
  store.save({ id: 'pad', name: 'Pad' });
  store.save({ id: 'pad', name: 'Updated pad' });
  assert.equal(store.list().length, 1);
  assert.equal(store.get('pad').name, 'Updated pad');
  store.remove('pad');
  assert.equal(store.get('pad'), undefined);
});
test('profile store exports capabilities and filters unknown capability labels', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = createControllerProfileStore({ storage });
  store.save({ id: 'wheel', name: 'Wheel', capabilities: ['wheel', 'pedals', 'driver-secret'] });
  const exported = store.export();
  assert.deepEqual(JSON.parse(exported).profiles[0].capabilities, ['wheel', 'pedals']);
  const restored = createControllerProfileStore({
    storage: {
      getItem: (key) => values.get(`restored:${key}`) || null,
      setItem: (key, value) => values.set(`restored:${key}`, value),
    },
  });
  const profiles = restored.import(exported);
  assert.deepEqual(profiles[0].capabilities, ['wheel', 'pedals']);
});
test('custom profiles override matching built-in profiles', () => {
  const custom = createControllerProfile({
    id: 'xbox-layout',
    name: 'My Xbox mapping',
    rumble: false,
  });
  assert.equal(resolveControllerProfile({ profileId: 'xbox-layout', profiles: [custom] }), custom);
});
test('automatic profile selection matches device names and prefers custom profiles', () => {
  const custom = createControllerProfile({
    id: 'my-dualsense',
    name: 'My DualSense',
    deviceMatch: 'Sony Wireless Controller',
    rumble: false,
  });
  assert.equal(
    resolveControllerProfile({
      profileId: 'Auto-detect',
      deviceName: 'Sony Wireless Controller (USB)',
      profiles: [custom],
    }),
    custom,
  );
  assert.equal(
    resolveControllerProfile({ profileId: 'auto', deviceName: 'Xbox Elite Wireless Controller' })
      .id,
    'xbox-elite-layout',
  );
  assert.equal(
    resolveControllerProfile({ profileId: 'auto', deviceName: 'Unlisted USB pad' }).id,
    'generic-hid-layout',
  );
});
test('automatic profile selection recognizes adaptive, handheld, wheel, and HOTAS devices', () => {
  assert.equal(
    resolveControllerProfile({ profileId: 'auto', deviceName: 'Xbox Adaptive Controller' }).id,
    'xbox-adaptive-layout',
  );
  assert.equal(
    resolveControllerProfile({ profileId: 'auto', deviceName: 'Backbone One' }).id,
    'mobile-controller-layout',
  );
  assert.equal(
    resolveControllerProfile({ profileId: 'auto', deviceName: 'Logitech G923' }).id,
    'logitech-wheel-layout',
  );
  assert.equal(
    resolveControllerProfile({ profileId: 'auto', deviceName: 'VKB Gladiator HOTAS' }).id,
    'hotas-layout',
  );
});
test('shared controller profile options exactly cover built-in profiles', () => {
  assert.deepEqual(CONTROLLER_PROFILE_OPTIONS, [
    'Auto-detect',
    ...BUILTIN_CONTROLLER_PROFILES.map((profile) => profile.name),
  ]);
});
