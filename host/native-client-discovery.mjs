import { promises as defaultFs } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { selectNativeClient } from '../src/frontend/providers/native-client.mjs';

function defaultBaseDirs(platform, env, home) {
  const dirs = new Set([
    home,
    '/usr/local/bin',
    '/usr/bin',
    '/opt',
    '/Applications',
    env.PROGRAMFILES,
    env['PROGRAMFILES(X86)'],
    env.LOCALAPPDATA,
    env.PROGRAMDATA,
  ]);
  if (platform === 'linux')
    for (const path of String(env.PATH || '')
      .split(':')
      .filter(Boolean))
      dirs.add(path);
  return [...dirs].filter(Boolean);
}

/** Discover an installed official native client by probing known locations. */
export function createNativeClientDiscovery({
  platform,
  fsImpl = defaultFs,
  env = process.env,
  home = homedir(),
  baseDirs = null,
} = {}) {
  if (!['win32', 'darwin', 'linux'].includes(platform))
    throw new TypeError(`unsupported native client discovery platform: ${platform}`);
  if (!fsImpl || typeof fsImpl.access !== 'function')
    throw new TypeError('filesystem adapter must implement access');
  const roots = Array.isArray(baseDirs)
    ? baseDirs.map(String).filter(Boolean)
    : defaultBaseDirs(platform, env, home);
  return Object.freeze({
    async discover(providerId) {
      const client = selectNativeClient(providerId, platform);
      if (!client)
        return Object.freeze({
          found: false,
          providerId,
          platform,
          checked: false,
          reason: 'No official native client is declared for this provider and platform',
        });
      const probes = client.executableCandidates.flatMap((relative) =>
        roots.map((root) => (isAbsolute(relative) ? relative : join(root, relative))),
      );
      for (const path of probes) {
        try {
          await fsImpl.access(path);
          return Object.freeze({
            found: true,
            path,
            providerId,
            platform,
            checked: true,
            client: Object.freeze({ id: client.id, name: client.name, appName: client.appName }),
          });
        } catch {
          /* continue probing */
        }
      }
      return Object.freeze({
        found: false,
        providerId,
        platform,
        checked: true,
        client: Object.freeze({ id: client.id, name: client.name, appName: client.appName }),
        reason: 'No official native client executable was found in known locations',
      });
    },
  });
}
