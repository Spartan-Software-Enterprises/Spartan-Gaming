import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedExternalUrl, isAllowedNavigation, isAllowedProviderUrl} from './security.mjs';

test('Electron navigation policy permits the local frontend and HTTPS destinations', () => {
  assert.equal(isAllowedNavigation('http://127.0.0.1:4173/dashboard/', {frontendOrigin: 'http://127.0.0.1:4173'}), true);
  assert.equal(isAllowedNavigation('https://service.example/game'), true);
  assert.equal(isAllowedNavigation('http://service.example/game'), false);
  assert.equal(isAllowedNavigation('javascript:alert(1)'), false);
});

test('provider surfaces require HTTPS', () => {
  assert.equal(isAllowedProviderUrl('https://service.example/player'), true);
  assert.equal(isAllowedProviderUrl('http://localhost:8787/player'), false);
  assert.equal(isAllowedProviderUrl('not a URL'), false);
});

test('Electron external-link IPC allows only safe HTTPS or loopback URLs', () => {
  assert.equal(isAllowedExternalUrl('https://docs.example/help'), true);
  assert.equal(isAllowedExternalUrl('http://127.0.0.1:4173/diagnostics'), true);
  assert.equal(isAllowedExternalUrl('http://remote.example/help'), false);
  assert.equal(isAllowedExternalUrl('https://user:pass@example/help'), false);
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
});
