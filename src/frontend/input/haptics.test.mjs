import assert from 'node:assert/strict';
import test from 'node:test';
import { createHapticsController, normalizeHapticRequest } from './haptics.mjs';

test('haptic requests are bounded for browser gamepad APIs', () => {
  const request = normalizeHapticRequest({
    gamepadIndex: 99,
    durationMs: 9000,
    startDelay: -1,
    strongMagnitude: 2,
    weakMagnitude: -1,
  });
  assert.deepEqual(request, {
    gamepadIndex: 15,
    durationMs: 5000,
    startDelay: 0,
    strongMagnitude: 1,
    weakMagnitude: 0,
  });
});

test('haptics controller plays dual-rumble on the selected gamepad', async () => {
  let effect;
  const controller = createHapticsController({
    navigatorRef: {
      getGamepads: () => [
        {
          index: 0,
          vibrationActuator: {
            playEffect: async (name, options) => {
              effect = { name, options };
            },
          },
        },
      ],
    },
  });
  assert.equal(
    await controller.play({ durationMs: 250, strongMagnitude: 0.8, weakMagnitude: 0.2 }),
    true,
  );
  assert.equal(effect.name, 'dual-rumble');
  assert.equal(effect.options.duration, 250);
});

test('haptics fail closed when disabled or unsupported', async () => {
  const disabled = createHapticsController({
    enabled: false,
    navigatorRef: { getGamepads: () => [] },
  });
  assert.equal(await disabled.play({ durationMs: 100 }), false);
  const unsupported = createHapticsController({ navigatorRef: {} });
  assert.equal(await unsupported.play(), false);
});
