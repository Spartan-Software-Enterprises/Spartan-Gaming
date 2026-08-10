const BEHAVIOR_TARGETS = Object.freeze({
  'Current workspace': Object.freeze({target: '_self', features: ''}),
  'New tab': Object.freeze({target: '_blank', features: 'noopener,noreferrer'}),
  'New gaming window': Object.freeze({target: '_blank', features: 'popup=yes,width=1440,height=900,noopener,noreferrer'}),
  'Fullscreen window': Object.freeze({target: '_blank', features: 'popup=yes,fullscreen=yes,width=1920,height=1080,noopener,noreferrer'}),
});

export function resolveLaunchTarget(value) {
  return BEHAVIOR_TARGETS[value] || BEHAVIOR_TARGETS['New tab'];
}

export function launchExternalSurface(url, {behavior = 'New tab', open = globalThis.open, assign = globalThis.location?.assign} = {}) {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new TypeError('launch URL must use HTTPS');
  const target = resolveLaunchTarget(behavior);
  if (target.target === '_self') {
    if (typeof assign !== 'function') throw new Error('current-workspace navigation is unavailable');
    assign(url);
    return Object.freeze({mode: 'current-workspace', url});
  }
  if (typeof open !== 'function') throw new Error('new-window navigation is unavailable');
  const windowRef = open(url, target.target, target.features);
  return Object.freeze({mode: target.target === '_blank' && target.features.startsWith('popup') ? 'window' : 'tab', url, opened: Boolean(windowRef)});
}
