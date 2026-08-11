import { createSessionEnvelope } from '../src/frontend/session/session.mjs';
import {
  controllerPolicyAllowsEvent,
  normalizeControllerPolicy,
} from '../src/frontend/input/controller-policy.mjs';

function bounded(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

/**
 * Forward host-observed gamepad rumble to connected sessions as host-issued
 * input events. Adapters that can observe host-local force feedback expose
 * readRumbleEvents(); adapters without such a source leave the controller
 * idle so the transport contract stays platform-neutral.
 */
export function createRumbleBroadcastController({
  adapter,
  controllerPolicy = normalizeControllerPolicy(),
  intervalMs = 50,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
} = {}) {
  const sessions = new Set();
  let timer = null;
  let sequence = 0;
  const read =
    typeof adapter?.readRumbleEvents === 'function' ? adapter.readRumbleEvents.bind(adapter) : null;
  const broadcast = (rumble) => {
    const gamepadIndex = bounded(rumble?.gamepadIndex ?? rumble?.index, 0, 0, 15);
    if (
      !controllerPolicyAllowsEvent(
        { kind: 'rumble', source: 'host', gamepadIndex },
        controllerPolicy,
      )
    )
      return;
    const strongMagnitude = bounded(rumble?.strongMagnitude, 0, 0, 1);
    const weakMagnitude = bounded(rumble?.weakMagnitude, 0, 0, 1);
    for (const session of sessions) {
      try {
        session.send(
          createSessionEnvelope({
            sessionId: session.sessionId,
            type: 'input.event',
            sequence: (sequence += 1),
            payload: {
              type: 'input.event',
              source: 'host',
              kind: 'rumble',
              action: 'rumble',
              gamepadIndex,
              durationMs: 0,
              strongMagnitude,
              weakMagnitude,
            },
          }),
        );
      } catch {
        /* a closing session must not stop haptics for the remaining sessions */
      }
    }
  };
  const drain = () => {
    if (!read) return;
    let events;
    try {
      events = read();
    } catch {
      events = [];
    }
    if (Array.isArray(events)) events.forEach(broadcast);
  };
  return Object.freeze({
    get active() {
      return timer !== null;
    },
    poll() {
      drain();
    },
    attach() {
      if (!read || timer) return;
      timer = setIntervalImpl(drain, Number(intervalMs));
    },
    detach() {
      if (timer) {
        clearIntervalImpl(timer);
        timer = null;
      }
    },
    add(session) {
      if (!session || typeof session.send !== 'function')
        throw new TypeError('rumble broadcast sessions must implement send()');
      sessions.add(session);
      return () => sessions.delete(session);
    },
    remove(session) {
      sessions.delete(session);
    },
  });
}
