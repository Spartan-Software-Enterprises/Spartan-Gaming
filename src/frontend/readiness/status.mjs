const STATUS_ORDER = Object.freeze([
  'loading',
  'ready',
  'attention',
  'degraded',
  'offline',
  'connecting',
  'connected',
  'error',
]);

function count(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function createReadinessStatus({
  catalogLoaded = false,
  compatibility = null,
  capabilityReport = null,
  online = true,
  activeSession = 'idle',
} = {}) {
  if (!STATUS_ORDER.includes(activeSession) && activeSession !== 'idle')
    throw new TypeError(`unsupported session status: ${activeSession}`);
  if (!online)
    return Object.freeze({
      id: 'offline',
      label: 'Offline mode',
      detail: 'Cached library and local features remain available.',
    });
  if (activeSession === 'connected')
    return Object.freeze({
      id: 'connected',
      label: 'Session connected',
      detail: 'Streaming controls and diagnostics are active.',
    });
  if (activeSession === 'connecting')
    return Object.freeze({
      id: 'connecting',
      label: 'Connecting…',
      detail: 'Negotiating the selected session.',
    });
  if (activeSession === 'error')
    return Object.freeze({
      id: 'error',
      label: 'Connection error',
      detail: 'Open diagnostics or choose another integration.',
    });
  if (!catalogLoaded)
    return Object.freeze({
      id: 'loading',
      label: 'Loading library…',
      detail: 'Reading provider and emulator catalogs.',
    });
  if (!compatibility || !capabilityReport)
    return Object.freeze({
      id: 'loading',
      label: 'Checking device…',
      detail: 'Probing graphics, media, input, and transport capabilities.',
    });
  const counts = compatibility.counts || {};
  const setup = count(counts['configuration-required']);
  const native = count(counts['native-adapter-required']);
  const missing = count(counts['browser-capability-missing']);
  if (missing || native)
    return Object.freeze({
      id: 'degraded',
      label: 'Action needed',
      detail: `${missing + native} integration${missing + native === 1 ? '' : 's'} need device or adapter setup.`,
      counts: Object.freeze({ setup, native, missing }),
    });
  if (setup)
    return Object.freeze({
      id: 'attention',
      label: 'Ready with setup',
      detail: `${setup} provider${setup === 1 ? '' : 's'} need account, host, or subscription setup.`,
      counts: Object.freeze({ setup, native, missing }),
    });
  return Object.freeze({
    id: 'ready',
    label: 'All systems ready',
    detail: 'Browser capabilities and catalog integrations are available.',
    counts: Object.freeze({ setup, native, missing }),
  });
}

export function statusClass(status) {
  return `status-${createReadinessStatus(status).id}`;
}
