import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRuntimeUiSettings, resolveRuntimeUiSettings} from './runtime-ui.mjs';

test('runtime UI settings normalize appearance, accessibility, and overlay preferences', () => {
  const settings = resolveRuntimeUiSettings({'appearance.accent': 'Amber', 'appearance.theme': 'Spartan Light', 'appearance.density': 'Controller-first', 'appearance.uiScale': 200, 'accessibility.reduceMotion': true, 'accessibility.highContrast': true, 'gaming.showOverlay': false, 'gaming.hideBrowserChrome': false, 'gaming.overlayOpacity': 5, 'gaming.overlayPosition': 'Bottom left'}, {navigatorRef: {userAgent: '', platform: ''}});
  assert.deepEqual(settings, {accent: '#f5c563', theme: 'light', density: 'controller', tabLayout: 'top', locale: 'en', translucentChrome: true, showStatusBar: false, uiScale: 140, deviceMode: 'desktop', navigation: 'pointer-keyboard', touchControls: false, preferFullscreen: false, effectiveUiScale: 140, layoutColumns: 3, platform: 'unknown', enginePolicy: 'chromium-capable', supportLevel: 'platform-adapted', featureGates: {webFrontend: true, remoteStreaming: true, browserEmulation: false, nativeChromiumShell: true, nativeHostPackaging: true, tvRemoteNavigation: false}, narrowViewport: false, reduceMotion: true, highContrast: true, largeText: false, focusRing: true, screenReaderHints: false, colorVision: 'None', showOverlay: false, hideBrowserChrome: false, overlayPosition: 'Bottom left', overlayOpacity: 20});
});

test('runtime UI applies the configured document locale with a safe fallback', () => {
  const root = {dataset: {}, style: {setProperty() {}}};
  const nodes = new Map();
  const documentRef = {defaultView: {navigator: {userAgent: '', platform: ''}}, documentElement: root, head: {append(node) { nodes.set(node.id, node); }}, getElementById(id) { return nodes.get(id); }, createElement() { return {id: '', textContent: ''}; }};
  assert.equal(resolveRuntimeUiSettings({'general.language': 'Japanese'}).locale, 'ja');
  applyRuntimeUiSettings(documentRef, {'general.language': 'Japanese'});
  assert.equal(root.lang, 'ja');
  applyRuntimeUiSettings(documentRef, {'general.language': 'unsupported'});
  assert.equal(root.lang, 'en');
});

test('runtime UI settings apply data attributes, CSS variables, and one shared style element', () => {
  const root = {dataset: {}, style: {values: new Map(), setProperty(key, value) { this.values.set(key, value); }}};
  const nodes = new Map();
  const documentRef = {defaultView: {navigator: {userAgent: '', platform: ''}}, documentElement: root, head: {append(node) { nodes.set(node.id, node); }}, getElementById(id) { return nodes.get(id); }, createElement() { return {id: '', textContent: ''}; }};
  applyRuntimeUiSettings(documentRef, {'appearance.accent': 'Violet', 'gaming.showOverlay': false, 'accessibility.largeText': true});
  applyRuntimeUiSettings(documentRef, {'appearance.accent': 'Violet', 'gaming.showOverlay': false, 'accessibility.largeText': true});
  assert.equal(root.dataset.spartanOverlay, 'hidden');
  assert.equal(root.dataset.spartanDeviceMode, 'desktop');
  assert.equal(root.dataset.spartanTabLayout, 'top');
  assert.equal(root.dataset.spartanStatusBar, 'hidden');
  assert.equal(root.dataset.spartanTranslucentChrome, '');
  assert.equal(root.dataset.spartanNavigation, 'pointer-keyboard');
  assert.equal(root.dataset.spartanPlatform, 'unknown');
  assert.equal(root.dataset.spartanEnginePolicy, 'chromium-capable');
  assert.equal(root.dataset.spartanLargeText, '');
  assert.equal(root.dataset.spartanScreenReaderHints, undefined);
  assert.equal(root.style.values.get('--spartan-accent'), '#9a84ff');
  assert.equal(root.style.values.get('--cyan'), '#9a84ff');
  assert.equal(nodes.size, 1);
});

test('runtime UI exposes Fire TV remote-navigation metadata', () => {
  const root = {dataset: {}, style: {values: new Map(), setProperty(key, value) { this.values.set(key, value); }}};
  const nodes = new Map();
  const navigatorRef = {userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTSSS Build/PS7292)', platform: 'Linux armv7l'};
  const documentRef = {defaultView: {navigator: navigatorRef, innerWidth: 1920}, documentElement: root, head: {append(node) { nodes.set(node.id, node); }}, getElementById(id) { return nodes.get(id); }, createElement() { return {id: '', textContent: ''}; }};
  const settings = resolveRuntimeUiSettings({}, {navigatorRef, viewport: {width: 1920}});
  applyRuntimeUiSettings(documentRef, {});
  assert.equal(settings.platform, 'fire-tv');
  assert.equal(settings.enginePolicy, 'chromium-capable');
  assert.equal(settings.featureGates.tvRemoteNavigation, true);
  assert.equal(root.dataset.spartanPlatform, 'fire-tv');
});

test('runtime UI settings toggle the player chrome dataset', () => {
  const root = {dataset: {}, style: {setProperty() {}}};
  const nodes = new Map();
  const documentRef = {defaultView: {navigator: {userAgent: '', platform: ''}}, documentElement: root, head: {append(node) { nodes.set(node.id, node); }}, getElementById(id) { return nodes.get(id); }, createElement() { return {id: '', textContent: ''}; }};
  applyRuntimeUiSettings(documentRef, {'gaming.hideBrowserChrome': false});
  assert.equal(root.dataset.spartanHideBrowserChrome, undefined);
  applyRuntimeUiSettings(documentRef, {'gaming.hideBrowserChrome': true});
  assert.equal(root.dataset.spartanHideBrowserChrome, '');
});
