const ROUTES = Object.freeze({
  library: Object.freeze({kind: 'filter', filter: 'all'}),
  providers: Object.freeze({kind: 'navigate', href: '../providers/index.html'}),
  emulation: Object.freeze({kind: 'navigate', href: '../emulation/index.html'}),
  watch: Object.freeze({kind: 'filter', filter: 'watch'}),
  browser: Object.freeze({kind: 'filter', filter: 'browser'}),
});

export function resolveDashboardSection(section) { return ROUTES[section]; }
