function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function displayLabel(display) {
  if (display === 'ask') return 'Choose display';
  if (display?.kind === 'index' && Number.isInteger(display.index) && display.index >= 0) return `Display ${display.index + 1}`;
  return 'Browser default display';
}

function resolveDisplayStatus(display, displayCount) {
  if (display === 'ask') return 'selection-required';
  if (display?.kind === 'index' && displayCount > 0 && display.index >= displayCount) return 'unavailable';
  if (display?.kind === 'index') return 'local-target';
  return 'browser-default';
}

function resolveFeature({requested, negotiated, enabledLabel, disabledLabel}) {
  if (requested !== true) return {requested: false, negotiated: negotiated === true, status: 'not-requested', label: disabledLabel};
  if (negotiated === true) return {requested: true, negotiated: true, status: 'enabled', label: enabledLabel};
  if (negotiated === false) return {requested: true, negotiated: false, status: 'downgraded', label: disabledLabel};
  return {requested: true, negotiated: null, status: 'pending', label: 'Pending host negotiation'};
}

export function resolveDisplayNegotiation({preferences = {}, requestedCapabilities = {}, negotiatedCapabilities = null, displayCapabilities = {}} = {}) {
  const requestedVideo = requestedCapabilities.video || {};
  const negotiatedVideo = negotiatedCapabilities?.video || {};
  const display = preferences.display || 'automatic';
  const displayCount = Math.max(0, Math.floor(Number(displayCapabilities.count ?? preferences.displayPolicy?.displayCount ?? 0)) || 0);
  const targetStatus = resolveDisplayStatus(display, displayCount);
  const requestedRefreshRate = positive(requestedVideo.maxFramerate);
  const negotiatedRefreshRate = positive(negotiatedVideo.maxFramerate);
  const refreshStatus = !requestedRefreshRate ? 'not-requested' : !negotiatedCapabilities ? 'pending' : !negotiatedRefreshRate ? 'unreported' : negotiatedRefreshRate < requestedRefreshRate ? 'capped' : 'preserved';
  const hdr = resolveFeature({requested: requestedVideo.hdr === true, negotiated: negotiatedCapabilities ? negotiatedVideo.hdr === true : undefined, enabledLabel: 'HDR enabled', disabledLabel: 'HDR off'});
  const refreshLabel = negotiatedRefreshRate ? `${negotiatedRefreshRate} Hz` : requestedRefreshRate ? `${requestedRefreshRate} Hz requested` : 'Refresh automatic';
  const targetLabel = displayLabel(display);
  const targetNote = targetStatus === 'unavailable' ? `${targetLabel} unavailable` : targetStatus === 'selection-required' ? 'Display selection required' : targetLabel;
  return Object.freeze({display: Object.freeze({requested: display, count: displayCount, label: targetLabel, status: targetStatus, note: targetNote}), hdr: Object.freeze(hdr), refreshRate: Object.freeze({requested: requestedRefreshRate, negotiated: negotiatedRefreshRate, status: refreshStatus, label: refreshLabel}), summary: `${targetNote} · ${hdr.label} · ${refreshLabel}`});
}

export function formatDisplayNegotiation(outcome) { return outcome?.summary || 'Display outcome pending'; }
