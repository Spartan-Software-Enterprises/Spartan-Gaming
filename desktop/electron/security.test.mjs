import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedNavigation, isAllowedProviderUrl} from './security.mjs';

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

