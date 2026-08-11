/** Return true for the bounded desktop shortcuts that request application DevTools. */
export function isDeveloperToolsShortcut(input = {}, platform = process.platform) {
  if (input.type !== 'keyDown' || input.isAutoRepeat === true) return false;
  if (input.key === 'F12') return !input.control && !input.meta && !input.alt && !input.shift;
  const primaryModifier = platform === 'darwin' ? input.meta === true : input.control === true;
  const otherPrimaryModifier = platform === 'darwin' ? input.control === true : input.meta === true;
  return (
    input.key?.toLowerCase() === 'i' &&
    input.shift === true &&
    primaryModifier &&
    !otherPrimaryModifier &&
    !input.alt
  );
}

/** Build a platform-neutral menu that never targets a focused provider surface. */
export function createApplicationMenuTemplate({ developerMode = false, onToggleDevTools } = {}) {
  const viewItems = [{ role: 'togglefullscreen' }, { role: 'reload' }];
  if (developerMode)
    viewItems.push({
      id: 'spartan-developer-tools',
      label: 'Toggle Developer Tools',
      accelerator: 'CommandOrControl+Shift+I',
      click: onToggleDevTools,
    });
  return [
    {
      label: 'Spartan Gaming',
      submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
    },
    { label: 'View', submenu: viewItems },
  ];
}

/** Toggle only the supplied application WebContents when developer mode is enabled. */
export function toggleDeveloperTools(contents, developerMode = false) {
  if (!developerMode) return Object.freeze({ opened: false, reason: 'disabled' });
  if (!contents || contents.isDestroyed?.())
    return Object.freeze({ opened: false, reason: 'unavailable' });
  if (contents.isDevToolsOpened()) {
    contents.closeDevTools();
    return Object.freeze({ opened: false });
  }
  contents.openDevTools({ mode: 'detach', title: 'Spartan Gaming Developer Tools' });
  return Object.freeze({ opened: true });
}

export function closeDeveloperToolsWhenDisabled(contents, developerMode = false) {
  if (developerMode || !contents || contents.isDestroyed?.() || !contents.isDevToolsOpened())
    return false;
  contents.closeDevTools();
  return true;
}
