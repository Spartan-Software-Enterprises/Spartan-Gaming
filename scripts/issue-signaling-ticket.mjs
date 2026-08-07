#!/usr/bin/env node
import {createSignalingBroker} from '../signaling/broker.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value?.startsWith('--')) continue;
  const key = value.slice(2);
  args.set(key, process.argv[index + 1]?.startsWith('--') ? true : process.argv[++index]);
}

const secret = String(args.get('secret') || process.env.SPARTAN_SIGNALING_SECRET || '');
const sessionId = String(args.get('session') || '');
const role = String(args.get('role') || '');
const subject = String(args.get('subject') || role || '');
const ttlMs = args.get('ttl-ms') === undefined ? undefined : Number(args.get('ttl-ms'));

if (!secret || !sessionId || !role || !subject) {
  console.error('usage: issue-signaling-ticket.mjs --session <id> --role <client|host> [--subject <name>] [--ttl-ms <milliseconds>]');
  process.exit(2);
}

try {
  const broker = createSignalingBroker({secret});
  const ticket = broker.issueTicket({sessionId, role, subject, ...(ttlMs === undefined ? {} : {ttlMs})});
  console.log(JSON.stringify({version: 1, sessionId, role, subject, ttlMs: ttlMs ?? 10 * 60 * 1000, ticket}));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
