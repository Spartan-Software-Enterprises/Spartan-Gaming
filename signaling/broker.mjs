import {createHmac, timingSafeEqual} from 'node:crypto';
import {validateTransportMessage} from '../src/frontend/transport/transport.mjs';

const ROLES = new Set(['client', 'host']);
const SESSION_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_MESSAGE_BYTES = 64 * 1024;

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function encode(value) { return Buffer.from(value).toString('base64url'); }
function decode(value) { return Buffer.from(value, 'base64url').toString('utf8'); }
function sign(value, secret) { return createHmac('sha256', secret).update(value).digest('base64url'); }

export function makeSignalingTicket({sessionId, role, subject, expiresAt}, secret) {
  const body = encode(JSON.stringify({version: 1, sessionId, role, subject, expiresAt}));
  return `${body}.${sign(body, secret)}`;
}

export function verifySignalingTicket(ticket, {secret, sessionId, role, now}) {
  const [body, signature] = String(ticket || '').split('.');
  if (!body || !signature) throw new Error('invalid signaling ticket');
  const expected = sign(body, secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) throw new Error('invalid signaling ticket signature');
  let claims;
  try { claims = JSON.parse(decode(body)); } catch { throw new Error('invalid signaling ticket claims'); }
  if (claims.version !== 1 || claims.sessionId !== sessionId || claims.role !== role || !ROLES.has(claims.role)) throw new Error('signaling ticket scope mismatch');
  if (!Number.isFinite(claims.expiresAt) || claims.expiresAt <= now()) throw new Error('signaling ticket expired');
  return Object.freeze(claims);
}

export function createSignalingBroker({secret, clock = () => Date.now(), sessionTtlMs = 10 * 60 * 1000, maxSessions = 1000} = {}) {
  const signingSecret = requiredString(secret, 'secret');
  const sessions = new Map();
  const ticket = ({sessionId, role, subject = role, ttlMs = sessionTtlMs} = {}) => {
    requiredString(sessionId, 'sessionId');
    if (!SESSION_ID.test(sessionId)) throw new TypeError('sessionId has invalid characters');
    if (!ROLES.has(role)) throw new TypeError('role must be client or host');
    requiredString(subject, 'subject');
    const duration = Number(ttlMs);
    if (!Number.isFinite(duration) || duration < 1000 || duration > 24 * 60 * 60 * 1000) throw new RangeError('ticket TTL is out of bounds');
    return makeSignalingTicket({sessionId, role, subject, expiresAt: clock() + duration}, signingSecret);
  };
  const sweep = () => {
    const cutoff = clock() - sessionTtlMs;
    for (const [sessionId, session] of sessions) if (session.lastActivityAt < cutoff || session.participants.size === 0) sessions.delete(sessionId);
  };
  const attach = ({sessionId, role, ticket: joinTicket, send} = {}) => {
    requiredString(sessionId, 'sessionId');
    if (!ROLES.has(role)) throw new TypeError('role must be client or host');
    if (typeof send !== 'function') throw new TypeError('send must be a function');
    sweep();
    verifySignalingTicket(joinTicket, {secret: signingSecret, sessionId, role, now: clock});
    let session = sessions.get(sessionId);
    if (!session) {
      if (sessions.size >= maxSessions) throw new Error('signaling broker session capacity reached');
      session = {participants: new Map(), createdAt: clock(), lastActivityAt: clock()};
      sessions.set(sessionId, session);
    }
    if (session.participants.has(role)) throw new Error(`signaling role already attached: ${role}`);
    const participant = {role, send};
    session.participants.set(role, participant);
    session.lastActivityAt = clock();
    let detached = false;
    return Object.freeze({
      role,
      sessionId,
      send(message) {
        if (detached) throw new Error('signaling participant is detached');
        const validated = validateTransportMessage(message);
        if (validated.sessionId !== sessionId) throw new Error('message belongs to another signaling session');
        const encoded = JSON.stringify(validated);
        if (Buffer.byteLength(encoded) > MAX_MESSAGE_BYTES) throw new Error('signaling message is too large');
        session.lastActivityAt = clock();
        for (const [recipientRole, recipient] of session.participants) if (recipientRole !== role) recipient.send(validated);
        if (validated.type === 'session.close') detach();
        return validated;
      },
      detach() {
        if (detached) return;
        detached = true;
        if (sessions.get(sessionId) === session) {
          session.participants.delete(role);
          session.lastActivityAt = clock();
          if (session.participants.size === 0) sessions.delete(sessionId);
        }
      },
    });
  };
  return Object.freeze({
    issueTicket: ticket,
    attach,
    sweep,
    stats() { sweep(); return Object.freeze({sessions: sessions.size, participants: [...sessions.values()].reduce((count, session) => count + session.participants.size, 0)}); },
  });
}
