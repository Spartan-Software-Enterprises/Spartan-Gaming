import {detectDeviceMode, resolvePresentationProfile} from '../platform/device-mode.mjs';
import {detectRuntimePlatform, resolvePlatformCompatibility} from '../platform/compatibility.mjs';
import {syncRuntimeControllerNavigation} from '../input/navigation.mjs';

const ACCENTS = Object.freeze({Cyan: '#50e1d1', Violet: '#9a84ff', Lime: '#b8ef65', Amber: '#f5c563', Red: '#ff8f9c'});
const THEMES = Object.freeze({'Spartan Dark': 'dark', 'Spartan Light': 'light', System: 'system', 'OLED Black': 'oled'});
const DENSITIES = Object.freeze({Comfortable: 'comfortable', Compact: 'compact', 'Controller-first': 'controller'});
const TAB_LAYOUTS = Object.freeze({'Top tabs': 'top', 'Vertical tabs': 'vertical', 'Compact tabs': 'compact', 'Hidden in gaming mode': 'hidden-gaming'});
const LOCALES = Object.freeze({English: 'en', Spanish: 'es', French: 'fr', German: 'de', Japanese: 'ja', Korean: 'ko'});

export function resolveRuntimeUiSettings(settings = {}, environment = {}) {
  const accent = ACCENTS[settings['appearance.accent']] || ACCENTS.Cyan;
  const theme = THEMES[settings['appearance.theme']] || 'dark';
  const density = DENSITIES[settings['appearance.density']] || 'comfortable';
  const opacity = Number(settings['gaming.overlayOpacity']);
  const detectedMode = environment.deviceMode || detectDeviceMode(environment);
  const presentation = resolvePresentationProfile({settings, detectedMode, viewport: environment.viewport});
  const platform = detectRuntimePlatform({navigatorRef: environment.navigatorRef, userAgent: environment.userAgent, viewport: environment.viewport});
  const compatibility = resolvePlatformCompatibility({platform, capabilities: environment.capabilities});
  return Object.freeze({
    accent,
    theme,
    density,
    tabLayout: TAB_LAYOUTS[settings['appearance.tabLayout']] || 'top',
    locale: LOCALES[settings['general.language']] || 'en',
    translucentChrome: settings['appearance.translucentChrome'] !== false,
    showStatusBar: settings['appearance.showStatusBar'] === true,
    uiScale: Math.max(80, Math.min(140, Number(settings['appearance.uiScale']) || 100)),
    deviceMode: presentation.mode,
    navigation: presentation.navigation,
    touchControls: presentation.touchControls,
    preferFullscreen: presentation.preferFullscreen,
    effectiveUiScale: presentation.effectiveUiScale,
    layoutColumns: presentation.columns,
    narrowViewport: presentation.narrowViewport,
    platform,
    enginePolicy: compatibility.enginePolicy,
    supportLevel: compatibility.supportLevel,
    featureGates: compatibility.gates,
    reduceMotion: settings['appearance.reduceMotion'] === true || settings['accessibility.reduceMotion'] === true,
    highContrast: settings['accessibility.highContrast'] === true,
    largeText: settings['accessibility.largeText'] === true,
    focusRing: settings['accessibility.focusRing'] !== false,
    screenReaderHints: settings['accessibility.screenReaderHints'] === true,
    colorVision: typeof settings['accessibility.colorVision'] === 'string' ? settings['accessibility.colorVision'] : 'None',
    showOverlay: settings['gaming.showOverlay'] !== false,
    hideBrowserChrome: settings['gaming.hideBrowserChrome'] !== false,
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
html[data-spartan-hide-browser-chrome] .player-topbar{display:none!important}
html[data-spartan-hide-browser-chrome] .stage{min-height:calc(100vh - 45px)}
html[data-spartan-density="compact"] .card,html[data-spartan-density="compact"] .panel,html[data-spartan-density="compact"] .setting-row{padding-top:12px;padding-bottom:12px}
html[data-spartan-density="controller"] button,html[data-spartan-density="controller"] select,html[data-spartan-density="controller"] input{min-height:44px}
html[data-spartan-tab-layout="vertical"] .sidebar{width:270px}
html[data-spartan-tab-layout="compact"] .sidebar{width:190px;padding-left:12px;padding-right:12px}
html[data-spartan-tab-layout="compact"] .main-nav{gap:3px;margin-top:38px}
html[data-spartan-tab-layout="compact"] .nav-item{padding-top:8px;padding-bottom:8px;font-size:12px}
html[data-spartan-status-bar="hidden"] .status-pill,html[data-spartan-status-bar="hidden"] .session-label{display:none!important}
html[data-spartan-translucent-chrome] .sidebar,html[data-spartan-translucent-chrome] .topbar,html[data-spartan-translucent-chrome] .player-topbar{background:color-mix(in srgb,var(--panel,#171e26) 78%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
html[data-spartan-navigation="remote-controller"] button,html[data-spartan-navigation="remote-controller"] select,html[data-spartan-navigation="remote-controller"] input{min-height:52px;font-size:1.08em}
html[data-spartan-navigation="remote-controller"] :focus-visible{outline-width:4px;outline-offset:5px}
html[data-spartan-device-mode="television"] .content,html[data-spartan-device-mode="television"] .main{max-width:1440px;padding-left:6vw;padding-right:6vw}
html[data-spartan-device-mode="television"] .cards{grid-template-columns:repeat(4,minmax(0,1fr))}
html[data-spartan-device-mode="television"] .hero h2{font-size:clamp(36px,4vw,58px)}
html[data-spartan-device-mode="mobile"] body,html[data-spartan-device-mode="handheld"] body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
html[data-spartan-device-mode="mobile"] .content,html[data-spartan-device-mode="handheld"] .content,html[data-spartan-device-mode="mobile"] .main,html[data-spartan-device-mode="handheld"] .main{padding-bottom:calc(45px + env(safe-area-inset-bottom))}
`;

export function applyRuntimeUiSettings(documentRef, settings = {}, {navigation = {}} = {}) {
  if (!documentRef?.documentElement) return resolveRuntimeUiSettings(settings);
  globalThis.spartanElectron?.setQuitGuard?.(settings['general.askBeforeQuit'] !== false);
  const resolved = resolveRuntimeUiSettings(settings, {navigatorRef: documentRef.defaultView?.navigator || globalThis.navigator, viewport: {width: documentRef.defaultView?.innerWidth}});
  const root = documentRef.documentElement;
  root.dataset.spartanTheme = resolved.theme;
  root.lang = resolved.locale;
  root.dataset.spartanDensity = resolved.density;
  root.dataset.spartanTabLayout = resolved.tabLayout;
  root.dataset.spartanStatusBar = resolved.showStatusBar ? 'visible' : 'hidden';
  if (resolved.translucentChrome) root.dataset.spartanTranslucentChrome = ''; else delete root.dataset.spartanTranslucentChrome;
  root.dataset.spartanDeviceMode = resolved.deviceMode;
  root.dataset.spartanNavigation = resolved.navigation;
  root.dataset.spartanPlatform = resolved.platform;
  root.dataset.spartanEnginePolicy = resolved.enginePolicy;
  root.dataset.spartanColorVision = resolved.colorVision;
  if (resolved.screenReaderHints) root.dataset.spartanScreenReaderHints = ''; else delete root.dataset.spartanScreenReaderHints;
  root.dataset.spartanOverlay = resolved.showOverlay ? 'visible' : 'hidden';
  if (resolved.hideBrowserChrome) root.dataset.spartanHideBrowserChrome = ''; else delete root.dataset.spartanHideBrowserChrome;
  root.dataset.spartanOverlayPosition = resolved.overlayPosition;
  if (resolved.reduceMotion) root.dataset.spartanReduceMotion = ''; else delete root.dataset.spartanReduceMotion;
  if (resolved.highContrast) root.dataset.spartanHighContrast = ''; else delete root.dataset.spartanHighContrast;
  if (resolved.largeText) root.dataset.spartanLargeText = ''; else delete root.dataset.spartanLargeText;
  if (resolved.focusRing) root.dataset.spartanFocusRing = ''; else delete root.dataset.spartanFocusRing;
  root.style.setProperty('--spartan-accent', resolved.accent);
  root.style.setProperty('--accent', resolved.accent);
  root.style.setProperty('--cyan', resolved.accent);
  root.style.setProperty('--spartan-ui-scale', `${resolved.effectiveUiScale / 100}`);
  root.style.setProperty('--spartan-overlay-opacity', `${resolved.overlayOpacity / 100}`);
  if (!documentRef.getElementById(STYLE_ID)) {
    const style = documentRef.createElement('style'); style.id = STYLE_ID; style.textContent = RUNTIME_STYLES; documentRef.head?.append(style);
  }
  syncRuntimeControllerNavigation(documentRef, navigation);
  return resolved;
}
