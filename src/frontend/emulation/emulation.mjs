const EXTENSION = /(?:\.([a-z0-9]{1,8}))?$/i;
import {createEmulatorIntegration} from './integration.mjs';

function requiredString(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

export const DEFAULT_EMULATION_POLICY = Object.freeze({shipRoms: false, shipBios: false, allowUserSelectedFiles: true, requireLicenseMetadata: true});
export const EMULATION_LIBRARY_KEY = 'spartan-gaming.emulation-library.v1';

const FRONTEND_PREFERENCES = Object.freeze({'Automatic': 'automatic', 'Spartan runtime': 'spartan-runtime', 'Libretro host': 'libretro-host', 'Native adapter': 'native-adapter'});

export function resolveEmulationPreferences(settings = {}) {
  const frontend = FRONTEND_PREFERENCES[settings['emulation.frontend']] || 'automatic';
  const renderer = typeof settings['emulation.renderer'] === 'string' && settings['emulation.renderer'].trim() ? settings['emulation.renderer'] : 'Automatic';
  return Object.freeze({preference: frontend, renderer});
}

export function createUserFileRecord(file, {kind = 'game', userSelected = true} = {}) {
  const name = requiredString(file?.name, 'file.name'); if (!['game', 'firmware', 'save', 'media'].includes(kind)) throw new TypeError('unsupported emulation file kind'); const size = Math.max(0, Number(file.size) || 0); const lastModified = Math.max(0, Number(file.lastModified) || 0); const extension = (name.match(EXTENSION)?.[1] || '').toLowerCase();
  return Object.freeze({id: `${kind}:${name}:${size}:${lastModified}`, name, kind, extension, size, lastModified, userSelected: Boolean(userSelected)});
}

export function createEmulationLibraryIndex(files = []) {
  if (!Array.isArray(files)) throw new TypeError('files must be an array'); const unique = new Map(); for (const file of files) { const record = file.id ? Object.freeze({...file}) : createUserFileRecord(file); unique.set(record.id, record); } return Object.freeze([...unique.values()]);
}

export function createEmulationLibraryStore({storage = globalThis.localStorage, maxEntries = 200} = {}) {
  const entryLimit = Math.max(1, Math.min(1000, Number(maxEntries) || 200));
  let files = [];
  try {
    const saved = JSON.parse(storage?.getItem(EMULATION_LIBRARY_KEY) || '[]');
    if (Array.isArray(saved)) files = createEmulationLibraryIndex(saved.filter(file => file?.kind === 'game' || file?.kind === 'firmware')).map(file => Object.freeze({...file, userSelected: false}));
  } catch { files = []; }
  const persist = () => { try { storage?.setItem(EMULATION_LIBRARY_KEY, JSON.stringify(files.slice(0, entryLimit).map(file => ({...file, userSelected: false})))); } catch { /* Storage can be unavailable in private or restricted contexts. */ } };
  return Object.freeze({
    list() { return files.map(file => Object.freeze({...file})); },
    add(records = []) { if (!Array.isArray(records)) throw new TypeError('library records must be an array'); const remembered = records.map(record => createUserFileRecord(record, {kind: record.kind, userSelected: false})); files = createEmulationLibraryIndex([...remembered, ...files]).slice(0, entryLimit).map(file => Object.freeze({...file, userSelected: false})); persist(); return this.list(); },
    remove(id) { files = files.filter(file => file.id !== id); persist(); return this.list(); },
    clear() { files = []; persist(); return this.list(); },
  });
}

export function createEmulationLaunchPlan({core, gameFile, firmwareFiles = [], policy = DEFAULT_EMULATION_POLICY, preference = 'automatic', renderer = 'Automatic', report} = {}) {
  if (!core?.id || !core.mode) throw new TypeError('a normalized emulator core is required'); if (policy.shipRoms || policy.shipBios || !policy.allowUserSelectedFiles) throw new Error('emulation content policy does not allow this launch'); if (policy.requireLicenseMetadata && !core.license) throw new Error('core license metadata is required');
  const integration = createEmulatorIntegration(core, {preference, renderer, report});
  const game = gameFile?.id ? gameFile : createUserFileRecord(gameFile, {kind: 'game', userSelected: gameFile?.userSelected !== false}); if (!game.userSelected) throw new Error('game files must be explicitly selected by the user'); const firmware = firmwareFiles.map(file => file.id ? file : createUserFileRecord(file, {kind: 'firmware', userSelected: file?.userSelected !== false})); if (firmware.some(file => !file.userSelected)) throw new Error('firmware files must be explicitly selected by the user'); if (integration.content.firmwareFiles && !firmware.length) throw new Error('this runtime requires user-selected firmware files');
  return Object.freeze({status: 'ready', coreId: core.id, runtime: integration.runtime, systems: Object.freeze([...(core.systems || [])]), license: core.license, files: Object.freeze([game, ...firmware]), policy: Object.freeze({shipRoms: false, shipBios: false, allowUserSelectedFiles: true}), integration});
}

export function formatFileSize(bytes) { const value = Number(bytes) || 0; if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${(value / 1024 ** 3).toFixed(1)} GB`; }
