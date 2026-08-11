import { randomUUID } from 'node:crypto';
import { makeSignalingTicket, verifySignalingTicket } from './broker.mjs';
import { validateTransportMessage } from '../src/frontend/transport/transport.mjs';

const ROLES = new Set(['client', 'host']);
const SESSION_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_MESSAGE_BYTES = 64 * 1024;
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const INSTANCE_ID = randomUUID();

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function required(value, name) {
  const result = text(value);
  if (!result) throw new TypeError(`${name} is required`);
  return result;
}
function positive(value, fallback, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(number, maximum) : fallback;
}
function redisUrl(value) {
  const result = required(value, 'Redis URL');
  if (!/^rediss?:\/\//i.test(result))
    throw new TypeError('Redis URL must use redis:// or rediss://');
  return result;
}
function key(sessionId, role) {
  return `spartan:signal:session:${sessionId}:${role}`;
}
function channel(sessionId) {
  return `spartan:signal:messages:${sessionId}`;
}
function roleOther(role) {
  return role === 'client' ? 'host' : 'client';
}

/**
 * Redis-backed signaling broker for production deployments. Redis stores only
 * short-lived role ownership; protocol payloads are delivered through pub/sub
 * and are never persisted as session data.
 */
export async function createBroker({
  secret,
  environment = process.env,
  redis = {},
  clock = () => Date.now(),
  sessionTtlMs = DEFAULT_TTL_MS,
  maxSessions = 1000,
} = {}) {
  const signingSecret = required(secret, 'secret');
  const url = redisUrl(redis.url || environment.SPARTAN_SIGNALING_REDIS_URL);
  const { createClient } = await import('redis');
  const ttlMs = positive(sessionTtlMs, DEFAULT_TTL_MS, 24 * 60 * 60 * 1000);
  const command = createClient({ url });
  const subscriber = command.duplicate();
  let closed = false;
  await command.connect();
  await subscriber.connect();
  await command.ping();
  const local = new Map();
  const publish = (sessionId, value) => command.publish(channel(sessionId), JSON.stringify(value));
  const release = async (sessionId, role) => {
    await command.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      { keys: [key(sessionId, role)], arguments: [INSTANCE_ID] },
    );
  };
  const issueTicket = ({ sessionId, role, subject = role, ttlMs: requestedTtl = ttlMs } = {}) => {
    required(sessionId, 'sessionId');
    if (!SESSION_ID.test(sessionId)) throw new TypeError('sessionId has invalid characters');
    if (!ROLES.has(role)) throw new TypeError('role must be client or host');
    required(subject, 'subject');
    const duration = Number(requestedTtl);
    if (!Number.isFinite(duration) || duration < 1000 || duration > 24 * 60 * 60 * 1000)
      throw new RangeError('ticket TTL is out of bounds');
    return makeSignalingTicket(
      { sessionId, role, subject, expiresAt: clock() + duration },
      signingSecret,
    );
  };
  const attach = async ({ sessionId, role, ticket, send } = {}) => {
    if (closed) throw new Error('Redis signaling broker is closed');
    required(sessionId, 'sessionId');
    if (!SESSION_ID.test(sessionId)) throw new TypeError('sessionId has invalid characters');
    if (!ROLES.has(role)) throw new TypeError('role must be client or host');
    if (typeof send !== 'function') throw new TypeError('send must be a function');
    verifySignalingTicket(ticket, { secret: signingSecret, sessionId, role, now: clock });
    if (local.has(`${sessionId}:${role}`))
      throw new Error(`signaling role already attached: ${role}`);
    if (local.size >= maxSessions * 2) throw new Error('signaling broker session capacity reached');
    const lock = await command.set(key(sessionId, role), INSTANCE_ID, { NX: true, PX: ttlMs });
    if (lock !== 'OK') throw new Error(`signaling role already attached: ${role}`);
    const localKey = `${sessionId}:${role}`;
    const participant = { sessionId, role, send, detached: false };
    local.set(localKey, participant);
    try {
      await subscriber.subscribe(channel(sessionId), (raw) => {
        let envelope;
        try {
          envelope = JSON.parse(raw);
        } catch {
          return;
        }
        if (envelope?.to !== role || envelope.from === role || !envelope.message) return;
        try {
          participant.send(envelope.message);
        } catch {
          /* a closed socket is cleaned up by the agent */
        }
      });
    } catch (error) {
      local.delete(localKey);
      await release(sessionId, role);
      throw error;
    }
    return Object.freeze({
      role,
      sessionId,
      async send(message) {
        if (participant.detached) throw new Error('signaling participant is detached');
        const validated = validateTransportMessage(message);
        if (validated.sessionId !== sessionId)
          throw new Error('message belongs to another signaling session');
        if (Buffer.byteLength(JSON.stringify(validated)) > MAX_MESSAGE_BYTES)
          throw new Error('signaling message is too large');
        await publish(sessionId, { from: role, to: roleOther(role), message: validated });
        if (validated.type === 'session.close') await this.detach();
        return validated;
      },
      async detach() {
        if (participant.detached) return;
        participant.detached = true;
        local.delete(localKey);
        try {
          await subscriber.unsubscribe(channel(sessionId));
        } finally {
          await release(sessionId, role);
        }
      },
    });
  };
  const broker = {
    issueTicket,
    attach,
    stats() {
      return Object.freeze({
        sessions: new Set([...local.values()].map((item) => item.sessionId)).size,
        participants: local.size,
      });
    },
    async health() {
      try {
        await command.ping();
        return Object.freeze({ status: 'ready', backend: 'redis' });
      } catch {
        return Object.freeze({ status: 'unavailable', backend: 'redis' });
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const participant of [...local.values()]) await participant.detach();
      await subscriber.quit();
      await command.quit();
    },
  };
  return Object.freeze(broker);
}

export default createBroker;
