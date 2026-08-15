const PLATFORMS = new Set(['win32', 'darwin', 'linux']);

const CLIENT_REGISTRY = Object.freeze({
  'nvidia-geforce-now': Object.freeze({
    id: 'geforce-now-desktop',
    name: 'GeForce NOW',
    providerId: 'nvidia-geforce-now',
    officialUrl: 'https://www.nvidia.com/en-us/geforce-now/download/',
    platforms: Object.freeze({
      win32: Object.freeze({
        executableCandidates: Object.freeze(['GeForceNOW.exe', 'GeForceNOW']),
        appName: 'GeForce NOW',
      }),
      darwin: Object.freeze({
        executableCandidates: Object.freeze(['GeForce NOW.app/Contents/MacOS/GeForceNOW']),
        appName: 'GeForce NOW',
      }),
    }),
  }),
  'xbox-cloud-gaming': Object.freeze({
    id: 'xbox-app',
    name: 'Xbox',
    providerId: 'xbox-cloud-gaming',
    officialUrl: 'https://www.xbox.com/en-US/apps',
    platforms: Object.freeze({
      win32: Object.freeze({
        executableCandidates: Object.freeze(['Xbox.exe', 'Xbox']),
        appName: 'Xbox',
      }),
    }),
  }),
  'steam-remote-play': Object.freeze({
    id: 'steam-client',
    name: 'Steam',
    providerId: 'steam-remote-play',
    officialUrl: 'https://store.steampowered.com/about/',
    platforms: Object.freeze({
      win32: Object.freeze({
        executableCandidates: Object.freeze(['steam.exe', 'steam']),
        appName: 'Steam',
      }),
      darwin: Object.freeze({
        executableCandidates: Object.freeze(['Steam.app/Contents/MacOS/steam_osx']),
        appName: 'Steam',
      }),
      linux: Object.freeze({ executableCandidates: Object.freeze(['steam']), appName: 'Steam' }),
    }),
  }),
  'steam-broadcasting': Object.freeze({
    id: 'steam-client',
    name: 'Steam',
    providerId: 'steam-broadcasting',
    officialUrl: 'https://store.steampowered.com/about/',
    platforms: Object.freeze({
      win32: Object.freeze({
        executableCandidates: Object.freeze(['steam.exe', 'steam']),
        appName: 'Steam',
      }),
      darwin: Object.freeze({
        executableCandidates: Object.freeze(['Steam.app/Contents/MacOS/steam_osx']),
        appName: 'Steam',
      }),
      linux: Object.freeze({ executableCandidates: Object.freeze(['steam']), appName: 'Steam' }),
    }),
  }),
  parsec: Object.freeze({
    id: 'parsec-client',
    name: 'Parsec',
    providerId: 'parsec',
    officialUrl: 'https://parsec.app/downloads',
    platforms: Object.freeze({
      win32: Object.freeze({
        executableCandidates: Object.freeze(['parsec.exe', 'parsec']),
        appName: 'Parsec',
      }),
      darwin: Object.freeze({
        executableCandidates: Object.freeze(['Parsec.app/Contents/MacOS/parsec']),
        appName: 'Parsec',
      }),
      linux: Object.freeze({
        executableCandidates: Object.freeze(['parsecd', 'parsec']),
        appName: 'Parsec',
      }),
    }),
  }),
  'sunshine-moonlight': Object.freeze({
    id: 'moonlight-client',
    name: 'Moonlight',
    providerId: 'sunshine-moonlight',
    officialUrl: 'https://moonlight-stream.org/',
    platforms: Object.freeze({
      win32: Object.freeze({
        executableCandidates: Object.freeze(['Moonlight.exe', 'moonlight']),
        appName: 'Moonlight',
      }),
      darwin: Object.freeze({
        executableCandidates: Object.freeze(['Moonlight.app/Contents/MacOS/Moonlight']),
        appName: 'Moonlight',
      }),
      linux: Object.freeze({
        executableCandidates: Object.freeze(['moonlight']),
        appName: 'Moonlight',
      }),
    }),
  }),
  'shadow-pc': Object.freeze({
    id: 'shadow-client',
    name: 'Shadow',
    providerId: 'shadow-pc',
    officialUrl: 'https://shadow.tech/en/desktop-app',
    platforms: Object.freeze({
      win32: Object.freeze({
        executableCandidates: Object.freeze(['Shadow.exe', 'shadow']),
        appName: 'Shadow',
      }),
      darwin: Object.freeze({
        executableCandidates: Object.freeze(['Shadow.app/Contents/MacOS/Shadow']),
        appName: 'Shadow',
      }),
      linux: Object.freeze({ executableCandidates: Object.freeze(['shadow']), appName: 'Shadow' }),
    }),
  }),
  'playstation-remote-play': Object.freeze({
    id: 'ps-remote-play-client',
    name: 'PS Remote Play',
    providerId: 'playstation-remote-play',
    officialUrl: 'https://remoteplay.dl.playstation.net/remoteplay/lang/en/index.html',
    platforms: Object.freeze({
      win32: Object.freeze({
        executableCandidates: Object.freeze(['RemotePlay.exe', 'RemotePlay']),
        appName: 'PS Remote Play',
      }),
      darwin: Object.freeze({
        executableCandidates: Object.freeze(['Remote Play.app/Contents/MacOS/Remote Play']),
        appName: 'PS Remote Play',
      }),
    }),
  }),
  discord: Object.freeze({
    id: 'discord-client',
    name: 'Discord',
    providerId: 'discord',
    officialUrl: 'https://discord.com/download',
    platforms: Object.freeze({
      win32: Object.freeze({
        executableCandidates: Object.freeze(['Discord.exe', 'discord']),
        appName: 'Discord',
      }),
      darwin: Object.freeze({
        executableCandidates: Object.freeze(['Discord.app/Contents/MacOS/Discord']),
        appName: 'Discord',
      }),
      linux: Object.freeze({
        executableCandidates: Object.freeze(['discord']),
        appName: 'Discord',
      }),
    }),
  }),
});

function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

export function normalizeNativeClientDescriptor(record) {
  if (!record || typeof record !== 'object')
    throw new TypeError('native client descriptor must be an object');
  const id = required(record.id, 'native client.id');
  const name = required(record.name, 'native client.name');
  const providerId = required(record.providerId, 'native client.providerId');
  const officialUrl = required(record.officialUrl, 'native client.officialUrl');
  if (!/^https:\/\//i.test(officialUrl))
    throw new TypeError('native client.officialUrl must use https');
  if (
    !record.platforms ||
    typeof record.platforms !== 'object' ||
    Object.keys(record.platforms).length === 0
  )
    throw new TypeError('native client.platforms must define at least one platform');
  const platforms = Object.fromEntries(
    Object.entries(record.platforms).map(([platform, details]) => {
      if (!PLATFORMS.has(platform))
        throw new TypeError(`unsupported native client platform: ${platform}`);
      if (
        !details ||
        typeof details !== 'object' ||
        !Array.isArray(details.executableCandidates) ||
        !details.executableCandidates.length
      )
        throw new TypeError(`native client.platforms.${platform} requires executableCandidates`);
      return [
        platform,
        Object.freeze({
          appName: required(details.appName, `native client.platforms.${platform}.appName`),
          executableCandidates: Object.freeze([
            ...new Set(
              details.executableCandidates.map((value) =>
                required(value, 'executableCandidates entry').replaceAll('\\', '/'),
              ),
            ),
          ]),
          launchArgs: details.launchArgs
            ? Object.freeze([...details.launchArgs])
            : Object.freeze([]),
        }),
      ];
    }),
  );
  return Object.freeze({
    id,
    name,
    providerId,
    officialUrl,
    platforms: Object.freeze(platforms),
    notes: Object.freeze([...(record.notes || [])]),
  });
}

export function getNativeClientDescriptor(providerId) {
  return normalizeNativeClientDescriptor(CLIENT_REGISTRY[providerId]);
}

export function selectNativeClient(providerId, platform) {
  if (!PLATFORMS.has(platform)) return null;
  const descriptor = CLIENT_REGISTRY[providerId];
  if (!descriptor) return null;
  const normalized = normalizeNativeClientDescriptor(descriptor);
  const target = normalized.platforms[platform];
  return target ? Object.freeze({ ...normalized, platform, ...target }) : null;
}

export function createNativeClientLaunchPlan({ providerId, platform, discovery = null } = {}) {
  const client = selectNativeClient(providerId, platform);
  if (!client)
    return Object.freeze({
      status: 'unsupported',
      providerId,
      platform,
      reason: 'No official native client is available for this provider on this platform',
    });
  return Object.freeze({
    status: 'ready',
    kind: 'native-client',
    providerId,
    platform,
    client: Object.freeze({
      id: client.id,
      name: client.name,
      officialUrl: client.officialUrl,
      appName: client.appName,
      executableCandidates: client.executableCandidates,
    }),
    discovery: discovery
      ? Object.freeze({
          found: discovery.found === true,
          path: discovery.path || null,
          checked: discovery.checked || false,
        })
      : null,
    launch: Object.freeze({
      id: client.id,
      executableCandidates: client.executableCandidates,
      launchArgs: client.launchArgs,
      officialUrl: client.officialUrl,
      consent: true,
    }),
    requires: Object.freeze(['official-native-client-installed', 'native-process-permission']),
  });
}

export const nativeClientProviderIds = Object.freeze([
  ...new Set(Object.values(CLIENT_REGISTRY).map((client) => client.providerId)),
]);
