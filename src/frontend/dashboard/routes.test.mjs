import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveDashboardSection} from './routes.mjs';

test('dashboard sections resolve to real frontend destinations or filters', () => {
  assert.deepEqual(resolveDashboardSection('providers'), {kind: 'navigate', href: '../providers/index.html'});
  assert.deepEqual(resolveDashboardSection('emulation'), {kind: 'navigate', href: '../emulation/index.html'});
  assert.deepEqual(resolveDashboardSection('watch'), {kind: 'filter', filter: 'watch'});
  assert.deepEqual(resolveDashboardSection('browser'), {kind: 'filter', filter: 'browser'});
  assert.equal(resolveDashboardSection('unknown'), undefined);
});
