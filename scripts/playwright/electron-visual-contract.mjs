export const ELECTRON_VISUAL_ROUTES = Object.freeze([
  '/dashboard/',
  '/settings/',
  '/player/',
  '/diagnostics/',
  '/adapters/',
  '/emulation/',
  '/host/',
  '/workspaces/',
  '/providers/',
  '/input/inspector.html',
  '/input/profiles.html',
]);

export const ELECTRON_VISUAL_LAYOUTS = Object.freeze([
  Object.freeze({
    name: 'desktop',
    mode: 'Desktop',
    navigation: 'pointer-keyboard',
    width: 1440,
    height: 900,
  }),
  Object.freeze({
    name: 'handheld',
    mode: 'Handheld',
    navigation: 'controller-touch',
    width: 1280,
    height: 800,
  }),
  Object.freeze({ name: 'mobile', mode: 'Mobile', navigation: 'touch', width: 390, height: 844 }),
  Object.freeze({
    name: 'television',
    mode: 'Television',
    navigation: 'remote-controller',
    width: 1920,
    height: 1080,
  }),
]);

export function visualSnapshotKey(layout, route) {
  const name = route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-');
  return `${layout}-${name || 'home'}`;
}

function visualDifference(before, after) {
  if (
    typeof before !== 'string' ||
    typeof after !== 'string' ||
    before.length !== after.length ||
    before.length === 0
  )
    return Infinity;
  let difference = 0;
  for (let index = 0; index < before.length; index += 1) {
    const delta = Math.abs(Number.parseInt(before[index], 16) - Number.parseInt(after[index], 16));
    if (!Number.isFinite(delta)) return Infinity;
    difference += delta;
  }
  return difference / (before.length * 15);
}

export function compareVisualBaseline(expected, actual, { required = false } = {}) {
  if (!expected) {
    if (required) throw new Error('required Electron visual baseline is unavailable');
    return Object.freeze({ status: 'candidate', compared: 0, mismatches: [] });
  }
  if (expected.version !== 1 || !expected.snapshots || typeof expected.snapshots !== 'object')
    throw new TypeError('Electron visual baseline is invalid');
  const expectedKeys = Object.keys(expected.snapshots).sort();
  const actualKeys = Object.keys(actual.snapshots).sort();
  const mismatches = [];
  for (const key of new Set([...expectedKeys, ...actualKeys])) {
    const before = expected.snapshots[key];
    const after = actual.snapshots[key];
    if (!before) mismatches.push(`${key}: unexpected snapshot`);
    else if (!after) mismatches.push(`${key}: missing snapshot`);
    else if (before.width !== after.width || before.height !== after.height)
      mismatches.push(`${key}: screenshot dimensions changed`);
    else {
      const difference = visualDifference(before.visualHash, after.visualHash);
      const threshold = Number.isFinite(before.maxDifference) ? before.maxDifference : 0.015;
      if (difference > threshold)
        mismatches.push(
          `${key}: perceptual difference ${(difference * 100).toFixed(2)}% exceeds ${(threshold * 100).toFixed(2)}%`,
        );
    }
  }
  return Object.freeze({
    status: mismatches.length ? 'changed' : 'matched',
    compared: Math.min(expectedKeys.length, actualKeys.length),
    mismatches: Object.freeze(mismatches),
  });
}
