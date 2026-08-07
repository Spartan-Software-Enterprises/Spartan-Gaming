export const WORKSPACE_STORAGE_KEY = 'spartan-gaming.workspaces.v1';

export const DEFAULT_WORKSPACES = Object.freeze([
  Object.freeze({id: 'gaming', name: 'Gaming', description: 'Low-latency play with the full Spartan overlay.', quality: 'balanced', controllerProfile: 'auto', launchBehavior: 'current', overlay: true, pinned: true}),
  Object.freeze({id: 'family', name: 'Family', description: 'Simple, safe access to shared games and services.', quality: 'balanced', controllerProfile: 'auto', launchBehavior: 'current', overlay: false, pinned: false}),
  Object.freeze({id: 'guest', name: 'Guest', description: 'Temporary browsing with isolated preferences.', quality: 'low', controllerProfile: 'keyboard', launchBehavior: 'new-tab', overlay: true, pinned: false}),
]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`); }
function normalize(workspace) { required(workspace?.id, 'workspace.id'); required(workspace?.name, 'workspace.name'); return Object.freeze({id: workspace.id.trim().toLowerCase(), name: workspace.name.trim(), description: String(workspace.description || ''), quality: ['ultra', 'high', 'balanced', 'low'].includes(workspace.quality) ? workspace.quality : 'balanced', controllerProfile: String(workspace.controllerProfile || 'auto'), launchBehavior: ['current', 'new-tab', 'new-window'].includes(workspace.launchBehavior) ? workspace.launchBehavior : 'current', overlay: workspace.overlay !== false, pinned: workspace.pinned === true}); }
function validCollection(value) { return Array.isArray(value) && value.length > 0 && value.every(item => item && typeof item === 'object'); }

export function createWorkspaceStore({storage = globalThis.localStorage, initial = DEFAULT_WORKSPACES} = {}) {
  let workspaces = initial.map(normalize); let activeId = workspaces[0]?.id || 'gaming';
  try { const saved = JSON.parse(storage?.getItem(WORKSPACE_STORAGE_KEY) || 'null'); if (validCollection(saved?.workspaces)) workspaces = saved.workspaces.map(normalize); if (saved?.activeId && workspaces.some(item => item.id === saved.activeId)) activeId = saved.activeId; } catch { /* Corrupt local state falls back to safe defaults. */ }
  const persist = () => storage?.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({version: 1, activeId, workspaces: workspaces.map(clone)}));
  const uniqueId = name => { const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'; let id = base; let suffix = 2; while (workspaces.some(item => item.id === id)) id = `${base}-${suffix++}`; return id; };
  return {
    list() { return workspaces.map(clone); },
    get active() { return clone(workspaces.find(item => item.id === activeId) || workspaces[0]); },
    setActive(id) { if (!workspaces.some(item => item.id === id)) throw new Error(`Unknown workspace: ${id}`); activeId = id; persist(); return this.active; },
    create(values = {}) { const workspace = normalize({...values, id: values.id || uniqueId(values.name || 'Workspace')}); if (workspaces.some(item => item.id === workspace.id)) throw new Error(`Workspace already exists: ${workspace.id}`); workspaces = [...workspaces, workspace]; activeId = workspace.id; persist(); return clone(workspace); },
    update(id, values = {}) { const index = workspaces.findIndex(item => item.id === id); if (index < 0) throw new Error(`Unknown workspace: ${id}`); const workspace = normalize({...workspaces[index], ...values, id}); workspaces = workspaces.with(index, workspace); persist(); return clone(workspace); },
    remove(id) { if (workspaces.length <= 1) throw new Error('At least one workspace must remain'); if (!workspaces.some(item => item.id === id)) throw new Error(`Unknown workspace: ${id}`); workspaces = workspaces.filter(item => item.id !== id); if (activeId === id) activeId = workspaces[0].id; persist(); return this.active; },
    export() { return JSON.stringify({version: 1, activeId, workspaces: workspaces.map(clone)}, null, 2); },
    import(serialized) { const parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized; if (!validCollection(parsed?.workspaces)) throw new TypeError('workspace export is invalid'); const imported = parsed.workspaces.map(normalize); workspaces = imported; activeId = imported.some(item => item.id === parsed.activeId) ? parsed.activeId : imported[0].id; persist(); return this.list(); },
  };
}
