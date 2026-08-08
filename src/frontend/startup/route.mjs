const STARTUP_PAGES = new Set(['Gaming home', 'Continue playing', 'New tab', 'Last session']);

export function resolveStartupRoute(settings = {}, {recovery = null, lastLaunch = null} = {}) {
  const page = STARTUP_PAGES.has(settings['general.startupPage']) ? settings['general.startupPage'] : 'Gaming home';
  if (page === 'Gaming home' || page === 'New tab') return null;
  if (recovery) return '../player/index.html';
  if (lastLaunch) return './index.html?filter=recent&startup-resume=1';
  return null;
}
