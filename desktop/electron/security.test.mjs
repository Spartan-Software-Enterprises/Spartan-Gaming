import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedNavigation } from './security.mjs';

test('Electron navigation policy keeps the primary window inside the packaged application', () => {
  assert.equal(
    isAllowedNavigation('spartan-app://app/dashboard/', { appOrigin: 'spartan-app://app' }),
    true,
  );
  assert.equal(
    isAllowedNavigation('https://service.example/game', { appOrigin: 'spartan-app://app' }),
    false,
  );
  assert.equal(
    isAllowedNavigation('http://127.0.0.1:4173/dashboard/', { appOrigin: 'spartan-app://app' }),
    false,
  );
  assert.equal(isAllowedNavigation('javascript:alert(1)'), false);
});
