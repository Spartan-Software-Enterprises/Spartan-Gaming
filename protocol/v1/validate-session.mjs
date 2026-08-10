#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const allowedTypes = new Set([
  'session.offer',
  'session.answer',
  'session.ice-candidate',
  'session.reconnect',
  'input.event',
  'quality.request',
  'telemetry.health',
  'session.close',
]);

function fail(message) {
  console.error(`invalid session: ${message}`);
  process.exitCode = 1;
}

function validate(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return 'message must be a JSON object';
  }
  if (message.protocol !== 'spartan-gaming/1') return 'protocol must be spartan-gaming/1';
  for (const field of ['messageId', 'sessionId']) {
    if (typeof message[field] !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(message[field])) {
      return `${field} must be 8-128 characters using [A-Za-z0-9._:-]`;
    }
  }
  if (!allowedTypes.has(message.type)) return `unsupported message type: ${message.type}`;
  if (typeof message.sentAt !== 'string' || Number.isNaN(Date.parse(message.sentAt))) {
    return 'sentAt must be an ISO-8601 date-time';
  }
  if ('sequence' in message && (!Number.isInteger(message.sequence) || message.sequence < 0)) {
    return 'sequence must be a non-negative integer';
  }
  if (!message.payload || typeof message.payload !== 'object' || Array.isArray(message.payload)) {
    return 'payload must be an object';
  }
  return null;
}

const [path] = process.argv.slice(2);
if (!path) {
  console.error('usage: validate-session.mjs <message.json>');
  process.exit(2);
}

try {
  const message = JSON.parse(await readFile(path, 'utf8'));
  const error = validate(message);
  if (error) fail(error);
  else console.log(`valid session message: ${path}`);
} catch (error) {
  fail(error instanceof SyntaxError ? 'file is not valid JSON' : error.message);
}

