import { parseHostEndpoint } from './host.mjs';

const HANDOFF_TYPE = 'spartan.lan-handoff.v1';
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function text(value, name, max = 256) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max)
    throw new TypeError(`${name} is required and bounded`);
  return normalized;
}

export function createLanHandoffPayload({ handoffId, target, endpoint, sessionId, ticket } = {}) {
  if (!ID_PATTERN.test(String(handoffId || ''))) throw new TypeError('handoffId is invalid');
  if (!['host', 'client'].includes(target)) throw new TypeError('handoff target is invalid');
  const parsed = parseHostEndpoint(endpoint);
  return Object.freeze({
    type: HANDOFF_TYPE,
    handoffId,
    target,
    endpoint: parsed.url,
    sessionId: text(sessionId, 'sessionId', 128),
    ticket: text(ticket, 'ticket', 4096),
  });
}

export function openLanHandoffWindow({
  windowImpl = globalThis,
  url,
  name,
  payload,
  origin = windowImpl.location?.origin,
} = {}) {
  const target = windowImpl.open?.(url, name);
  if (!target)
    throw new Error('The browser blocked the handoff window; allow pop-ups for Spartan Gaming.');
  const send = () => target.postMessage?.(payload, origin);
  target.addEventListener?.('load', send, { once: true });
  send();
  return target;
}

export function installLanHandoffListener({
  windowImpl = globalThis,
  handoffId,
  target,
  onHandoff,
} = {}) {
  if (!ID_PATTERN.test(String(handoffId || ''))) return () => {};
  const origin = windowImpl.location?.origin;
  const accept = (event) => {
    if (event.origin !== origin || event.source !== windowImpl.opener) return;
    const value = event.data;
    if (
      !value ||
      value.type !== HANDOFF_TYPE ||
      value.handoffId !== handoffId ||
      value.target !== target
    )
      return;
    try {
      onHandoff?.(createLanHandoffPayload(value));
    } catch {
      /* Invalid handoff data is ignored. */
    }
  };
  windowImpl.addEventListener?.('message', accept);
  return () => windowImpl.removeEventListener?.('message', accept);
}
