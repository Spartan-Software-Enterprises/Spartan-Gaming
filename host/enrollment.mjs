import { parseHostEndpoint } from '../src/frontend/host/host.mjs';

function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function safeSession(value) {
  const result = required(value, 'sessionId');
  if (/[\r\n\s]/.test(result) || result.length > 128)
    throw new TypeError('sessionId must be a bounded single token');
  return result;
}

/** Create a transient host enrollment handoff; the ticket is never included in the returned diagnostics. */
export function createHostEnrollmentPlan({ endpoint, sessionId, ticket } = {}) {
  const parsed = parseHostEndpoint(required(endpoint, 'endpoint'), {
    allowInsecureLocalhost: true,
  });
  if (!['ws:', 'wss:'].includes(parsed.protocol))
    throw new TypeError('host enrollment endpoint must use ws or wss');
  const session = safeSession(sessionId);
  const joinTicket = required(ticket, 'ticket');
  return Object.freeze({
    endpoint: parsed.url,
    sessionId: session,
    args: Object.freeze([
      '--signal-endpoint',
      parsed.url,
      '--signal-session',
      session,
      '--signal-ticket',
      joinTicket,
    ]),
    diagnostics: Object.freeze({
      role: 'host',
      endpoint: parsed.url,
      sessionId: session,
      ticket: 'session-only',
    }),
    persistence: Object.freeze({ ticket: 'memory-only', session: 'memory-only', profile: 'never' }),
    security: Object.freeze({
      requiresSecureRemoteEndpoint: parsed.protocol === 'wss:',
      userConsentRequired: true,
    }),
  });
}
