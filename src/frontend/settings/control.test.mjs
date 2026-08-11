import assert from 'node:assert/strict';
import test from 'node:test';
import {escapeHtml, renderSettingControl} from './control.mjs';

test('settings control renderer escapes imported text and option values', () => {
  assert.equal(escapeHtml(`<&>\"'`), '&lt;&amp;&gt;&quot;&#39;');
  const control = renderSettingControl({key: 'advanced.customSignalingUrl', type: 'text'}, `\"><img src=x onerror=alert(1)>`);
  assert.doesNotMatch(control, /<img/);
  assert.match(control, /&quot;&gt;&lt;img/);
});

test('settings control renderer preserves safe control semantics', () => {
  const control = renderSettingControl({key: 'controllers.inputMode', type: 'select', options: ['Auto-detect', 'XInput'], default: 'Auto-detect'}, 'XInput');
  assert.match(control, /value="XInput" selected/);
  assert.match(control, /data-key="controllers.inputMode"/);
  assert.doesNotMatch(control, /undefined/);
});

test('settings control renderer labels stable custom select values without changing their value', () => {
  const control = renderSettingControl({key: 'controllers.defaultProfile', type: 'select', options: ['custom-living-room'], optionLabels: {'custom-living-room': 'Living room pad (custom)'}}, 'custom-living-room');
  assert.match(control, /value="custom-living-room"/);
  assert.match(control, />Living room pad \(custom\)<\/option>/);
});
