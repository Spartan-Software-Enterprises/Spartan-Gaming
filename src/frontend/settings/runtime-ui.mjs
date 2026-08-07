const ACCENTS = Object.freeze({Cyan: '#50e1d1', Violet: '#9a84ff', Lime: '#b8ef65', Amber: '#f5c563', Red: '#ff8f9c'});
const THEMES = Object.freeze({'Spartan Dark': 'dark', 'Spartan Light': 'light', System: 'system', 'OLED Black': 'oled'});
const DENSITIES = Object.freeze({Comfortable: 'comfortable', Compact: 'compact', 'Controller-first': 'controller'});

export function resolveRuntimeUiSettings(settings = {}) {
  const accent = ACCENTS[settings['appearance.accent']] || ACCENTS.Cyan;
  const theme = THEMES[settings['appearance.theme']] || 'dark';
  const density = DENSITIES[settings['appearance.density']] || 'comfortable';
  const opacity = Number(settings['gaming.overlayOpacity']);
  return Object.freeze({
    accent,
    theme,
    density,
    uiScale: Math.max(80, Math.min(140, Number(settings['appearance.uiScale']) || 100)),
    reduceMotion: settings['appearance.reduceMotion'] === true || settings['accessibility.reduceMotion'] === true,
    highContrast: settings['accessibility.highContrast'] === true,
    largeText: settings['accessibility.largeText'] === true,
    focusRing: settings['accessibility.focusRing'] !== false,
    colorVision: typeof settings['accessibility.colorVision'] === 'string' ? settings['accessibility.colorVision'] : 'None',
    showOverlay: settings['gaming.showOverlay'] !== false,
    overlayPosition: settings['gaming.overlayPosition'] || 'Top right',
    overlayOpacity: Number.isFinite(opacity) ? Math.max(20, Math.min(100, opacity)) : 92,
  });
}

const STYLE_ID = 'spartan-runtime-ui-styles';
const RUNTIME_STYLES = `
html[data-spartan-reduce-motion] *,html[data-spartan-reduce-motion] *::before,html[data-spartan-reduce-motion] *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}
html[data-spartan-large-text]{font-size:110%}
html body{font-size:calc(1em * var(--spartan-ui-scale,1))}
html[data-spartan-theme="light"]{color-scheme:light}
html[data-spartan-theme="light"] body{background:#f3f6f8!important;color:#14202a!important}
html[data-spartan-theme="light"] .panel,html[data-spartan-theme="light"] .card,html[data-spartan-theme="light"] .hero,html[data-spartan-theme="light"] .rail,html[data-spartan-theme="light"] .sidebar,html[data-spartan-theme="light"] .stage,html[data-spartan-theme="light"] .provider-dialog{background:#fff!important;color:#14202a!important;border-color:#c7d3dc!important}
html[data-spartan-theme="oled"] body{background:#000!important}
html[data-spartan-theme="oled"] .panel,html[data-spartan-theme="oled"] .card,html[data-spartan-theme="oled"] .hero,html[data-spartan-theme="oled"] .rail,html[data-spartan-theme="oled"] .sidebar,html[data-spartan-theme="oled"] .stage{background:#050505!important}
html[data-spartan-high-contrast] body{filter:contrast(1.16)}
html[data-spartan-focus-ring] :focus-visible{outline:3px solid var(--spartan-accent,#50e1d1)!important;outline-offset:3px!important}
html[data-spartan-overlay="hidden"] .overlay-top,html[data-spartan-overlay="hidden"] .overlay-bottom{display:none!important}
html[data-spartan-overlay] .overlay-top,html[data-spartan-overlay] .overlay-bottom{opacity:var(--spartan-overlay-opacity,.92)}
html[data-spartan-overlay-position="Top left"] .overlay-top{right:auto}
html[data-spartan-overlay-position="Top right"] .overlay-top{left:auto}
html[data-spartan-overlay-position="Bottom left"] .overlay-top{right:auto;top:auto;bottom:22px}
html[data-spartan-overlay-position="Bottom right"] .overlay-top{left:auto;top:auto;bottom:22px}
html[data-spartan-density="compact"] .card,html[data-spartan-density="compact"] .panel,html[data-spartan-density="compact"] .setting-row{padding-top:12px;padding-bottom:12px}
html[data-spartan-density="controller"] button,html[data-spartan-density="controller"] select,html[data-spartan-density="controller"] input{min-height:44px}
`;

export function applyRuntimeUiSettings(documentRef, settings = {}) {
  if (!documentRef?.documentElement) return resolveRuntimeUiSettings(settings);
  const resolved = resolveRuntimeUiSettings(settings);
  const root = documentRef.documentElement;
  root.dataset.spartanTheme = resolved.theme;
  root.dataset.spartanDensity = resolved.density;
  root.dataset.spartanColorVision = resolved.colorVision;
  root.dataset.spartanOverlay = resolved.showOverlay ? 'visible' : 'hidden';
  root.dataset.spartanOverlayPosition = resolved.overlayPosition;
  if (resolved.reduceMotion) root.dataset.spartanReduceMotion = ''; else delete root.dataset.spartanReduceMotion;
  if (resolved.highContrast) root.dataset.spartanHighContrast = ''; else delete root.dataset.spartanHighContrast;
  if (resolved.largeText) root.dataset.spartanLargeText = ''; else delete root.dataset.spartanLargeText;
  if (resolved.focusRing) root.dataset.spartanFocusRing = ''; else delete root.dataset.spartanFocusRing;
  root.style.setProperty('--spartan-accent', resolved.accent);
  root.style.setProperty('--accent', resolved.accent);
  root.style.setProperty('--cyan', resolved.accent);
  root.style.setProperty('--spartan-ui-scale', `${resolved.uiScale / 100}`);
  root.style.setProperty('--spartan-overlay-opacity', `${resolved.overlayOpacity / 100}`);
  if (!documentRef.getElementById(STYLE_ID)) {
    const style = documentRef.createElement('style'); style.id = STYLE_ID; style.textContent = RUNTIME_STYLES; documentRef.head?.append(style);
  }
  return resolved;
}
