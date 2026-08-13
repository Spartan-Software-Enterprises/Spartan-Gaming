import {homedir} from 'node:os';

function join(parts, separator) { return parts.join(separator); }
function separatorFor(platform) { return platform === 'win32' ? '\\' : '/'; }

/**
 * Resolve the per-user adapter install root for a platform. The app bundles
 * signed emulator adapters as a seed, but user installs always land in a
 * writable per-user directory so online feed updates can supersede them.
 */
export function resolveAdapterHome({platform = process.platform, env = process.env, osHome = homedir()} = {}) {
  const explicit = env.SPARTAN_ADAPTER_HOME;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  const separator = separatorFor(platform);
  if (platform === 'win32') return join([osHome, 'AppData', 'Local', 'SpartanGaming', 'adapters'], separator);
  if (platform === 'darwin') return join([osHome, 'Library', 'Application Support', 'Spartan Gaming', 'adapters'], separator);
  return join([osHome, '.config', 'spartan-gaming', 'adapters'], separator);
}

/** Bundled seed lives next to the app resources; the install root stays per-user. */
export function resolveBundledSeedRoot({appRoot, platform = process.platform} = {}) {
  const base = appRoot || process.cwd();
  return join([base, 'seed'], separatorFor(platform));
}
