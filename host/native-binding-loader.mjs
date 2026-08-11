import { createPlatformNativeAdapter } from './native-adapter-kit.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const KINDS = new Set(['capture', 'audio', 'input']);
const DEFAULT_PACKAGES = Object.freeze({
  win32: '@spartan-gaming/native-windows',
  darwin: '@spartan-gaming/native-macos',
  linux: '@spartan-gaming/native-linux',
});

function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

/** Discover an optional platform binary package without executing a fallback. */
export async function loadPlatformNativeBindings({
  platform,
  packageName = DEFAULT_PACKAGES[platform],
  loader = (name) => import(name),
  options = {},
} = {}) {
  if (!PLATFORMS.has(platform))
    throw new TypeError(`unsupported native binding platform: ${platform}`);
  const name = required(packageName, 'packageName');
  if (typeof loader !== 'function') throw new TypeError('loader must be a function');
  let module;
  try {
    module = await loader(name);
  } catch (error) {
    return Object.freeze({
      status: 'unavailable',
      platform,
      packageName: name,
      reason:
        error?.code === 'ERR_MODULE_NOT_FOUND'
          ? 'native package is not installed'
          : 'native package failed to load',
    });
  }
  if (typeof module?.createBindings !== 'function')
    return Object.freeze({
      status: 'unavailable',
      platform,
      packageName: name,
      reason: 'native package does not export createBindings',
    });
  let bindings;
  try {
    bindings = await module.createBindings({ platform, ...options });
  } catch {
    return Object.freeze({
      status: 'unavailable',
      platform,
      packageName: name,
      reason: 'native package binding initialization failed',
    });
  }
  if (!bindings || bindings.platform !== platform || typeof bindings.capabilities !== 'object')
    return Object.freeze({
      status: 'unavailable',
      platform,
      packageName: name,
      reason: 'native package returned invalid bindings',
    });
  return Object.freeze({
    status: 'available',
    platform,
    packageName: name,
    capabilities: Object.freeze(bindings.capabilities),
    bindings,
  });
}

/** Load and adapt one verified platform capability from the optional binary. */
export async function loadPlatformNativeAdapter({
  platform,
  kind,
  packageName,
  loader,
  options,
} = {}) {
  if (!KINDS.has(kind)) throw new TypeError(`unsupported native binding kind: ${kind}`);
  const result = await loadPlatformNativeBindings({ platform, packageName, loader, options });
  if (result.status !== 'available') return result;
  const bindings = result.bindings[kind];
  try {
    return Object.freeze({
      ...result,
      adapter: createPlatformNativeAdapter({ platform, kind, bindings }),
    });
  } catch {
    return Object.freeze({
      status: 'unavailable',
      platform,
      packageName: result.packageName,
      reason: `native package does not provide a usable ${kind} binding`,
    });
  }
}

export const PLATFORM_NATIVE_PACKAGES = DEFAULT_PACKAGES;
