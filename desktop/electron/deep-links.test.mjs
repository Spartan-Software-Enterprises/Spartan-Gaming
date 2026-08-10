import test from 'node:test';
import assert from 'node:assert/strict';
import {findSpartanDeepLink, normalizeSpartanDeepLink} from './deep-links.mjs';

test('Electron deep links accept only bounded catalog launch requests', () => {
  assert.deepEqual(normalizeSpartanDeepLink('spartan://launch?backend=steam-link'), {version: 1, action: 'launch', backendId: 'steam-link'});
  assert.deepEqual(findSpartanDeepLink(['--hidden', 'https://example.test', 'spartan://launch?backend=game_1']), {version: 1, action: 'launch', backendId: 'game_1'});
});

test('Electron deep links reject unsafe, ambiguous, or malformed targets', () => {
  for (const value of [
    'https://launch?backend=game',
    'spartan://other?backend=game',
    'spartan://launch?backend=game&url=https://evil.example',
    'spartan://launch?backend=../secret',
    'spartan://launch?backend=game#secret',
    'spartan://user:pass@launch?backend=game',
    `spartan://launch?backend=${'x'.repeat(129)}`,
  ]) assert.equal(normalizeSpartanDeepLink(value), null, value);
  assert.equal(findSpartanDeepLink('spartan://launch?backend=game'), null);
});
