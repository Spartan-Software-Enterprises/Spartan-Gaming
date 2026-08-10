/** Return whether the Electron process should expose a background tray entry. */
export function shouldCreateTray({backgroundApps = false} = {}) {
  return backgroundApps === true;
}

/** Build the platform-neutral actions consumed by Electron's native Tray menu. */
export function createTrayMenuTemplate({onShow = () => {}, onQuit = () => {}} = {}) {
  return [
    {label: 'Show Spartan Gaming', click: onShow},
    {type: 'separator'},
    {label: 'Quit Spartan Gaming', click: onQuit},
  ];
}
