const route = (href) => Object.freeze({ kind: 'navigate', href });

export const SETTINGS_ACTIONS = Object.freeze({
  'general.reset': Object.freeze({ kind: 'reset' }),
  'controllers.manageProfiles': route('../input/profiles.html'),
  'controllers.test': route('../input/inspector.html'),
  'emulation.importFirmware': route('../emulation/index.html'),
  'emulation.manageCores': route('../adapters/index.html'),
  'providers.manageProfiles': route('../providers/index.html'),
  'providers.manageHosts': route('../host/index.html'),
  'providers.clearSessions': Object.freeze({ kind: 'clear-provider-sessions' }),
  'host.exportConfig': Object.freeze({ kind: 'export-host-config' }),
  'performance.taskManager': route('../diagnostics/index.html?focus=performance'),
  'performance.diagnostics': route('../diagnostics/index.html'),
  'privacy.permissions': route('../diagnostics/index.html?focus=permissions'),
  'privacy.exportData': Object.freeze({ kind: 'export-privacy' }),
  'sync.manageProfiles': route('../workspaces/index.html'),
  'sync.exportSettings': Object.freeze({ kind: 'export-settings' }),
  'sync.importSettings': Object.freeze({ kind: 'import-settings' }),
  'accessibility.remapShortcuts': route('../input/profiles.html?focus=shortcuts'),
  'advanced.exportDiagnostics': Object.freeze({ kind: 'export-diagnostics' }),
  'advanced.clearDiagnostics': Object.freeze({ kind: 'clear-diagnostics' }),
  'advanced.flags': Object.freeze({ kind: 'developer-tools' }),
  'updates.checkNow': Object.freeze({
    kind: 'status',
    message:
      'Update service is not configured in this frontend build; use the signed release channel when available.',
  }),
  'updates.releaseNotes': Object.freeze({
    kind: 'external',
    href: 'https://github.com/Spartan-Software-Enterprises/Spartan-Gaming/releases',
  }),
});

export function resolveSettingsAction(key) {
  return SETTINGS_ACTIONS[key];
}
