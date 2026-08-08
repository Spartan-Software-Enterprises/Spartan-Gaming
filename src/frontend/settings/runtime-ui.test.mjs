import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRuntimeUiSettings, resolveRuntimeUiSettings} from './runtime-ui.mjs';

test('runtime UI settings normalize appearance, accessibility, and overlay preferences', () => {
  const settings = resolveRuntimeUiSettings({'appearance.accent': 'Amber', 'appearance.theme': 'Spartan Light', 'appearance.density': 'Controller-first', 'appearance.uiScale': 200, 'accessibility.reduceMotion': true, 'accessibility.highContrast': true, 'gaming.showOverlay': false, 'gaming.overlayOpacity': 5, 'gaming.overlayPosition': 'Bottom left'}, {navigatorRef: {userAgent: '', platform: ''}});
  assert.deepEqual(settings, {accent: '#f5c563', theme: 'light', density: 'controller', uiScale: 140, deviceMode: 'desktop', navigation: 'pointer-keyboard', touchControls: false, preferFullscreen: false, effectiveUiScale: 140, layoutColumns: 3, platform: 'unknown', enginePolicy: 'chromium-capable', supportLevel: 'platform-adapted', featureGates: {webFrontend: true, remoteStreaming: true, browserEmulation: false, nativeChromiumShell: true, nativeHostPackaging: true}, narrowViewport: false, reduceMotion: true, highContrast: true, largeText: false, focusRing: true, colorVision: 'None', showOverlay: false, overlayPosition: 'Bottom left', overlayOpacity: 20});
});

test('runtime UI settings apply data attributes, CSS variables, and one shared style element', () => {
  const root = {dataset: {}, style: {values: new Map(), setProperty(key, value) { this.values.set(key, value); }}};
  const nodes = new Map();
  const documentRef = {defaultView: {navigator: {userAgent: '', platform: ''}}, documentElement: root, head: {append(node) { nodes.set(node.id, node); }}, getElementById(id) { return nodes.get(id); }, createElement() { return {id: '', textContent: ''}; }};
  applyRuntimeUiSettings(documentRef, {'appearance.accent': 'Violet', 'gaming.showOverlay': false, 'accessibility.largeText': true});
  applyRuntimeUiSettings(documentRef, {'appearance.accent': 'Violet', 'gaming.showOverlay': false, 'accessibility.largeText': true});
  assert.equal(root.dataset.spartanOverlay, 'hidden');
  assert.equal(root.dataset.spartanDeviceMode, 'desktop');
  assert.equal(root.dataset.spartanNavigation, 'pointer-keyboard');
  assert.equal(root.dataset.spartanPlatform, 'unknown');
  assert.equal(root.dataset.spartanEnginePolicy, 'chromium-capable');
  assert.equal(root.dataset.spartanLargeText, '');
  assert.equal(root.style.values.get('--spartan-accent'), '#9a84ff');
  assert.equal(root.style.values.get('--cyan'), '#9a84ff');
  assert.equal(nodes.size, 1);
});

test('runtime UI exposes iOS engine policy metadata without enabling a false Chromium claim', () => {
  const root = {dataset: {}, style: {values: new Map(), setProperty(key, value) { this.values.set(key, value); }}};
  const nodes = new Map();
  const navigatorRef = {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5};
  const documentRef = {defaultView: {navigator: navigatorRef, innerWidth: 390}, documentElement: root, head: {append(node) { nodes.set(node.id, node); }}, getElementById(id) { return nodes.get(id); }, createElement() { return {id: '', textContent: ''}; }};
  const settings = resolveRuntimeUiSettings({}, {navigatorRef, viewport: {width: 390}});
  applyRuntimeUiSettings(documentRef, {});
  assert.equal(settings.platform, 'ios');
  assert.equal(settings.enginePolicy, 'webkit-required');
  assert.equal(root.dataset.spartanPlatform, 'ios');
});
