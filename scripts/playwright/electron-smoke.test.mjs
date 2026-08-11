import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareVisualBaseline,
  ELECTRON_VISUAL_LAYOUTS,
  ELECTRON_VISUAL_ROUTES,
  visualSnapshotKey,
} from './electron-visual-contract.mjs';

test('Electron visual matrix covers every route at four release layouts', () => {
  assert.deepEqual(
    ELECTRON_VISUAL_LAYOUTS.map(({ name, navigation }) => [name, navigation]),
    [
      ['desktop', 'pointer-keyboard'],
      ['handheld', 'controller-touch'],
      ['mobile', 'touch'],
      ['television', 'remote-controller'],
    ],
  );
  assert.equal(ELECTRON_VISUAL_ROUTES.length, 11);
  assert.equal(
    new Set(
      ELECTRON_VISUAL_LAYOUTS.flatMap((layout) =>
        ELECTRON_VISUAL_ROUTES.map((route) => visualSnapshotKey(layout.name, route)),
      ),
    ).size,
    44,
  );
});

test('Electron visual baseline comparison detects missing and changed screenshots', () => {
  const expected = {
    version: 1,
    snapshots: {
      'desktop-dashboard': { visualHash: '012345', width: 1440, height: 900 },
      'mobile-dashboard': { visualHash: '012345', width: 390, height: 844 },
    },
  };
  assert.equal(compareVisualBaseline(expected, structuredClone(expected)).status, 'matched');
  const changed = structuredClone(expected);
  changed.snapshots['desktop-dashboard'].visualHash = 'ffffff';
  delete changed.snapshots['mobile-dashboard'];
  changed.snapshots['television-dashboard'] = {
    visualHash: '012345',
    width: 1920,
    height: 1080,
  };
  const result = compareVisualBaseline(expected, changed);
  assert.equal(result.status, 'changed');
  assert.equal(result.mismatches.length, 3);
});

test('Electron visual baseline tolerates small live-pixel changes', () => {
  const expected = {
    version: 1,
    snapshots: {
      dashboard: { visualHash: '77777777', width: 1280, height: 800 },
    },
  };
  const actual = structuredClone(expected);
  actual.snapshots.dashboard.visualHash = '77777778';
  assert.equal(compareVisualBaseline(expected, actual).status, 'matched');
});

test('Electron visual baseline comparison emits a candidate when no baseline exists', () => {
  assert.deepEqual(compareVisualBaseline(null, { snapshots: {} }), {
    status: 'candidate',
    compared: 0,
    mismatches: [],
  });
});

test('Electron visual baseline comparison rejects a missing required baseline', () => {
  assert.throws(
    () => compareVisualBaseline(null, { snapshots: {} }, { required: true }),
    /required Electron visual baseline is unavailable/,
  );
});
