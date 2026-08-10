const CONSOLE_DEVICE_MODES = new Set(['handheld', 'television']);
export function resolveConsoleMode({settings = {}, deviceMode = 'desktop'} = {}) { if (settings['appearance.consoleMode'] === true) return true; if (settings['appearance.consoleMode'] === false) return false; return CONSOLE_DEVICE_MODES.has(deviceMode); }
export function nextConsoleMode(current) { return !Boolean(current); }

