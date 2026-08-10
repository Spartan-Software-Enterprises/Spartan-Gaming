#!/usr/bin/env node
import {accessSync, constants, statSync} from 'node:fs';
import {resolveProductionConfig} from '../../signaling/production-config.mjs';

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required`);
  return value.trim();
}

function verifyFile(path, name, {stat = statSync, access = accessSync} = {}) {
  const normalized = required(path, name);
  try {
    if (!stat(normalized)?.isFile?.()) throw new Error('not a regular file');
    access(normalized, constants.R_OK);
  } catch {
    throw new Error(`${name} must be a readable regular file`);
  }
  return true;
}

/** Verify operator-mounted production inputs without returning secret material. */
export function verifyProductionInputs(config, dependencies = {}) {
  if (!config || config.environment !== 'production') throw new TypeError('production configuration is required');
  verifyFile(config.tls?.keyPath, 'TLS key', dependencies);
  verifyFile(config.tls?.certPath, 'TLS certificate', dependencies);
  return Object.freeze({
    status: 'ready',
    environment: 'production',
    tls: Object.freeze({keyReadable: true, certificateReadable: true}),
    secrets: Object.freeze({...config.secrets}),
    sessionStore: config.sessionStore,
    brokerConfigured: Boolean(config.brokerPackage),
    turnConfigured: config.turnUrls.length > 0,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(JSON.stringify(verifyProductionInputs(resolveProductionConfig())));
  } catch (error) {
    console.error(`production preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}
