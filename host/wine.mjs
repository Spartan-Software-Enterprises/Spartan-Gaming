import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const BACKENDS = Object.freeze(['wine', 'playonlinux']);

function available(command, probe = spawnSync) {
  if (!command) return false;
  try {
    return probe(command, ['--version'], { stdio: 'ignore', shell: false }).status === 0;
  } catch {
    return existsSync(command);
  }
}

export function resolveWineBackend({
  preference = 'auto',
  wineBinary = 'wine',
  playOnLinuxBinary = 'playonlinux',
  platform = process.platform,
  probe = spawnSync,
} = {}) {
  if (platform !== 'linux')
    return Object.freeze({
      backend: null,
      available: false,
      reason: 'Wine compatibility is only enabled on Linux',
    });
  if (!['auto', ...BACKENDS].includes(preference))
    throw new TypeError(`unsupported Wine backend preference: ${preference}`);
  const wine = available(wineBinary, probe);
  const playonlinux = available(playOnLinuxBinary, probe);
  const backend =
    preference === 'wine'
      ? wine
        ? 'wine'
        : null
      : preference === 'playonlinux'
        ? playonlinux
          ? 'playonlinux'
          : null
        : wine
          ? 'wine'
          : playonlinux
            ? 'playonlinux'
            : null;
  return Object.freeze({
    backend,
    available: Boolean(backend),
    wine,
    playonlinux,
    reason: backend
      ? `${backend} compatibility backend is available`
      : 'Install wine or PlayOnLinux to launch Windows emulator binaries',
  });
}

export function createWineLaunch({
  backend = 'wine',
  executable,
  args = [],
  wineBinary = 'wine',
  playOnLinuxBinary = 'playonlinux',
  playOnLinuxProfile = '',
} = {}) {
  if (!['wine', 'playonlinux'].includes(backend))
    throw new TypeError('unsupported Wine launch backend');
  if (typeof executable !== 'string' || !executable.trim())
    throw new TypeError('Windows executable is required');
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== 'string'))
    throw new TypeError('Wine launch arguments must be strings');
  if (backend === 'playonlinux') {
    if (typeof playOnLinuxProfile !== 'string' || !playOnLinuxProfile.trim())
      throw new TypeError('PlayOnLinux launches require a configured program profile');
    return Object.freeze({
      executable: playOnLinuxBinary,
      args: Object.freeze(['--run', playOnLinuxProfile.trim(), executable.trim(), ...args]),
      backend,
    });
  }
  return Object.freeze({
    executable: wineBinary,
    args: Object.freeze([executable.trim(), ...args]),
    backend,
  });
}
