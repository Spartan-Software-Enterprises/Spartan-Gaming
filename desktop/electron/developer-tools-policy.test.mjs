import assert from 'node:assert/strict';
import test from 'node:test';
import {
  closeDeveloperToolsWhenDisabled,
  createApplicationMenuTemplate,
  isDeveloperToolsShortcut,
  toggleDeveloperTools,
} from './developer-tools-policy.mjs';

test('developer shortcuts are explicit, platform-aware, and ignore repeats', () => {
  assert.equal(isDeveloperToolsShortcut({ type: 'keyDown', key: 'F12' }, 'linux'), true);
  assert.equal(
    isDeveloperToolsShortcut({ type: 'keyDown', key: 'i', shift: true, control: true }, 'win32'),
    true,
  );
  assert.equal(
    isDeveloperToolsShortcut({ type: 'keyDown', key: 'I', shift: true, meta: true }, 'darwin'),
    true,
  );
  assert.equal(
    isDeveloperToolsShortcut({ type: 'keyDown', key: 'i', shift: true, meta: true }, 'linux'),
    false,
  );
  assert.equal(isDeveloperToolsShortcut({ type: 'keyDown', key: 'F12', alt: true }), false);
  assert.equal(
    isDeveloperToolsShortcut({ type: 'keyDown', key: 'F12', isAutoRepeat: true }),
    false,
  );
});

test('application menu exposes the primary-window developer action only when enabled', () => {
  const disabled = createApplicationMenuTemplate();
  assert.deepEqual(
    disabled[1].submenu.map((item) => item.role),
    ['togglefullscreen', 'reload'],
  );
  const handler = () => {};
  const enabled = createApplicationMenuTemplate({ developerMode: true, onToggleDevTools: handler });
  assert.equal(enabled[1].submenu[2].id, 'spartan-developer-tools');
  assert.equal(enabled[1].submenu[2].click, handler);
});

test('developer tools never open while disabled and toggle the supplied contents when enabled', () => {
  let opened = false;
  const contents = {
    isDestroyed: () => false,
    isDevToolsOpened: () => opened,
    openDevTools: (options) => {
      assert.equal(options.mode, 'detach');
      opened = true;
    },
    closeDevTools: () => {
      opened = false;
    },
  };
  assert.deepEqual(toggleDeveloperTools(contents), { opened: false, reason: 'disabled' });
  assert.equal(opened, false);
  assert.deepEqual(toggleDeveloperTools(contents, true), { opened: true });
  assert.equal(opened, true);
  assert.deepEqual(toggleDeveloperTools(contents, true), { opened: false });
  assert.equal(opened, false);
  opened = true;
  assert.equal(closeDeveloperToolsWhenDisabled(contents), true);
  assert.equal(opened, false);
});
