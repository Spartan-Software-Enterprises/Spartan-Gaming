export const FAVORITES_STORAGE_PREFIX = 'spartan-gaming.favorites.v2.';
const LEGACY_FAVORITES_KEY = 'spartan-gaming.favorites.v1';

const ROM_LIBRARY_KEY = 'spartan-gaming.rom-library.v1';

function workspaceId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(normalized))
    throw new TypeError('workspaceId must use a safe profile identifier');
  return normalized;
}

function normalizeIds(value) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item) => typeof item === 'string' && /^[a-z0-9][a-z0-9._-]{1,127}$/.test(item))
            .slice(0, 500),
        ),
      ]
    : [];
}

function validRomRecord(value) {
  if (typeof value !== 'object' || value === null) return false;
  const keys = Object.keys(value);
  return (
    keys.includes('romPath') &&
    typeof value.romPath === 'string' &&
    keys.includes('system') &&
    typeof value.system === 'string' &&
    keys.includes('extension') &&
    typeof value.extension === 'string' &&
    keys.includes('name') &&
    typeof value.name === 'string' &&
    keys.includes('mime') &&
    typeof value.mime === 'string'
  );
}

function normalizeRomRecord(value) {
  if (!validRomRecord(value)) throw new TypeError('invalid rom record');
  return Object.freeze({
    romPath: String(value.romPath).trim(),
    system: String(value.system).trim().toLowerCase(),
    extension: String(value.extension).trim().toLowerCase(),
    name: String(value.name).trim(),
    mime: String(value.mime).trim(),
  });
}

export function createFavoritesStore({ storage = globalThis.localStorage, workspaceId: id } = {}) {
  const normalizedWorkspaceId = workspaceId(id);
  const key = `${FAVORITES_STORAGE_PREFIX}${normalizedWorkspaceId}`;
  const read = () => {
    try {
      const current = storage?.getItem(key);
      if (current === null && normalizedWorkspaceId === 'gaming') {
        const legacy = normalizeIds(JSON.parse(storage?.getItem(LEGACY_FAVORITES_KEY) || '[]'));
        if (legacy.length) storage?.setItem(key, JSON.stringify(legacy));
        return legacy;
      }
      return normalizeIds(JSON.parse(current || '[]'));
    } catch {
      return [];
    }
  };
  const write = (ids) => {
    const normalized = normalizeIds(ids);
    storage?.setItem(key, JSON.stringify(normalized));
    return normalized;
  };
  return Object.freeze({
    key,
    list() {
      return Object.freeze(read());
    },
    has(backendId) {
      return read().includes(backendId);
    },
    set(ids) {
      return Object.freeze(write(ids));
    },
    toggle(backendId) {
      const ids = read();
      const next = ids.includes(backendId)
        ? ids.filter((idValue) => idValue !== backendId)
        : [...ids, backendId];
      return Object.freeze(write(next));
    },
    clear() {
      storage?.removeItem?.(key);
      return [];
    },
  });
}

function detectRomSystem(path) {
  const ext = path.split('.').pop().toLowerCase();
  const systemMap = {
    'smc': 'snes', 'sfc': 'snes',
    'nes': 'nes',
    'gba': 'gba',
    'gb': 'game-boy', 'gbc': 'game-boy-color',
    'n64': 'nintendo-64',
    'z64': 'nintendo-64',
    'iso': 'playstation-1', 'cue': 'playstation-1', 'bin': 'playstation-1',
    'chd': 'playstation-2',
    'wbfs': 'wii',
    'gcm': 'gamecube',
    'iso': 'playstation-3',
    'cso': 'psp',
    'nds': 'nintendo-ds',
    '3ds': 'nintendo-3ds',
    'zip': 'arcade',
    'a26': 'atari-2600',
    'vec': 'vectrex',
    'smd': 'genesis', 'md': 'genesis',
    'sms': 'sms', 'gg': 'game-gear',
    'pce': 'pc-engine',
    'ws': 'wonderswan',
    'rom': 'multi-system',
  };
  return systemMap[ext] || 'multi-system';
}

function detectRomMime(path) {
  const ext = path.split('.').pop().toLowerCase();
  const mimeMap = {
    'smc': 'application/x-snes-rom', 'sfc': 'application/x-snes-rom',
    'nes': 'application/x-nes-rom',
    'gba': 'application/x-gba-rom',
    'gb': 'application/x-gameboy-rom', 'gbc': 'application/x-gameboy-color-rom',
    'n64': 'application/x-n64-rom', 'z64': 'application/x-n64-rom',
    'iso': 'application/x-iso9660-image', 'cue': 'application/x-cue', 'bin': 'application/octet-stream',
    'chd': 'application/x-chd',
    'wbfs': 'application/x-wbfs',
    'gcm': 'application/x-gcm',
    'cso': 'application/x-cso',
    'nds': 'application/x-nds-rom',
    '3ds': 'application/x-3ds-rom',
    'zip': 'application/zip',
    'a26': 'application/x-atari2600-rom',
    'vec': 'application/x-vectrex-rom',
    'smd': 'application/x-genesis-rom', 'md': 'application/x-genesis-rom',
    'sms': 'application/x-sms-rom', 'gg': 'application/x-gg-rom',
    'pce': 'application/x-pce-rom',
    'ws': 'application/x-wonderswan-rom',
    'rom': 'application/octet-stream',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function detectRomSystem(path) {
  const ext = path.split('.').pop().toLowerCase();
  const systemMap = {
    'smc': 'snes', 'sfc': 'snes',
    'nes': 'nes',
    'gba': 'gba',
    'gb': 'game-boy', 'gbc': 'game-boy-color',
    'n64': 'nintendo-64',
    'z64': 'nintendo-64',
    'iso': 'playstation-1', 'cue': 'playstation-1', 'bin': 'playstation-1',
    'chd': 'playstation-2',
    'wbfs': 'wii',
    'gcm': 'gamecube',
    'iso': 'playstation-3',
    'cso': 'psp',
    'nds': 'nintendo-ds',
    '3ds': 'nintendo-3ds',
    'zip': 'arcade',
    'a26': 'atari-2600',
    'vec': 'vectrex',
    'smd': 'genesis', 'md': 'genesis',
    'sms': 'sms', 'gg': 'game-gear',
    'pce': 'pc-engine',
    'ws': 'wonderswan',
    'rom': 'multi-system',
  };
  return systemMap[ext] || 'multi-system';
}

function detectRomMime(path) {
  const ext = path.split('.').pop().toLowerCase();
  const mimeMap = {
    'smc': 'application/x-snes-rom', 'sfc': 'application/x-snes-rom',
    'nes': 'application/x-nes-rom',
    'gba': 'application/x-gba-rom',
    'gb': 'application/x-gameboy-rom', 'gbc': 'application/x-gameboy-color-rom',
    'n64': 'application/x-n64-rom', 'z64': 'application/x-n64-rom',
    'iso': 'application/x-iso9660-image', 'cue': 'application/x-cue', 'bin': 'application/octet-stream',
    'chd': 'application/x-chd',
    'wbfs': 'application/x-wbfs',
    'gcm': 'application/x-gcm',
    'cso': 'application/x-cso',
    'nds': 'application/x-nds-rom',
    '3ds': 'application/x-3ds-rom',
    'zip': 'application/zip',
    'a26': 'application/x-atari2600-rom',
    'vec': 'application/x-vectrex-rom',
    'smd': 'application/x-genesis-rom', 'md': 'application/x-genesis-rom',
    'sms': 'application/x-sms-rom', 'gg': 'application/x-gg-rom',
    'pce': 'application/x-pce-rom',
    'ws': 'application/x-wonderswan-rom',
    'rom': 'application/octet-stream',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function walkDirectoryFiles(directoryHandle, extensionFilter) {
  const romExtensions = new Set([
    'smc', 'sfc', 'nes', 'gba', 'gb', 'gbc', 'n64', 'z64',
    'iso', 'cue', 'bin', 'chd', 'wbfs', 'gcm', 'cso',
    'nds', '3ds', 'zip', 'a26', 'vec', 'smd', 'md', 'sms', 'gg',
    'pce', 'ws', 'rom'
  ]);
  const result = [];
  async function readEntries(handle) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        const name = entry.name;
        const ext = name.split('.').pop().toLowerCase();
        if (romExtensions.has(ext)) {
          const path = await entry.path();
          result.push(path);
        }
      } else if (entry.kind === 'directory') {
        await readEntries(entry);
      }
    }
  }
  await readEntries(directoryHandle);
  return result;
}

export function createRomLibraryStore({
  storage = globalThis.localStorage,
  key = ROM_LIBRARY_KEY,
  maxEntries = 100,
} = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 500)
    throw new RangeError('maxEntries must be between 1 and 500');
  const read = () => {
    try {
      const parsed = JSON.parse(storage?.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed.map(normalizeRomRecord) : [];
    } catch {
      return [];
    }
  };
  const write = (records) =>
    storage?.setItem(key, JSON.stringify(records.map((record) => ({
      ...record,
    }))));
  return Object.freeze({
    list() {
      return read().slice(0, maxEntries);
    },
    add(record) {
      const records = read();
      records.push(normalizeRomRecord(record));
      write(records);
      return record;
    },
    get(id) {
      return read().find((r) => r.romPath === id);
    },
    remove(path) {
      const before = read().length;
      const records = read().filter((r) => r.romPath !== path);
      write(records);
      return records.length !== before;
    },
    find(query) {
      const lower = query.toLowerCase();
      return read().filter((r) =>
        r.name.toLowerCase().includes(lower) ||
        r.system.toLowerCase().includes(lower) ||
        r.extension.toLowerCase().includes(lower)
      );
    },
    importFromPaths(paths) {
      const results = [];
      for (const path of paths) {
        results.push(normalizeRomRecord({
          romPath: path,
          system: detectRomSystem(path),
          extension: path.split('.').pop().toLowerCase(),
          name: path.split('/').pop().split('.').shift(),
          mime: detectRomMime(path),
        }));
      }
      const records = read();
      records.push(...results);
      write(records);
      return results;
    },
    import fs from 'fs';
import path from 'path';

export async function scanFolderForRoms(folderPath) {
  const romExtensions = new Set([
    'smc', 'sfc', 'nes', 'gba', 'gb', 'gbc', 'n64', 'z64',
    'iso', 'cue', 'bin', 'chd', 'wbfs', 'gcm', 'cso',
    'nds', '3ds', 'zip', 'a26', 'vec', 'smd', 'md', 'sms', 'gg',
    'pce', 'ws', 'rom'
  ]);
  const results = [];

  async function scan(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (romExtensions.has(ext.slice(1))) {
          results.push(fullPath);
        }
      }
    }
  }

  await scan(folderPath);
  return results;
}

export function createRomLibraryStore({
  storage = globalThis.localStorage,
  key = ROM_LIBRARY_KEY,
  maxEntries = 100,
} = {}) {

export {
  validRomRecord,
  normalizeRomRecord,
  detectRomSystem,
  detectRomMime,
};
