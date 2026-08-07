const SOURCES = Object.freeze({gamepad: 'gamepad', keyboard: 'keyboard', pointer: 'pointer', touch: 'touch', host: 'host'});

export function createInputPermissionPolicy(capabilities = {}) {
  const input = capabilities.input || capabilities;
  const allowed = Object.freeze({gamepad: input.gamepad !== false, keyboard: input.keyboard !== false, pointer: input.pointer !== false, touch: input.touch !== false, rumble: input.rumble !== false, host: false});
  return Object.freeze({
    allowed,
    allows(source) { return allowed[SOURCES[source] || source] === true; },
    reason(source) { return this.allows(source) ? null : `${source} input is disabled by the active session policy`; },
  });
}
