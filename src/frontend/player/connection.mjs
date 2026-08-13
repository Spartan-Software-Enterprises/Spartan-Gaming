function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function endpoint(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (url.username || url.password || !['https:', 'wss:'].includes(url.protocol) && !(url.protocol === 'ws:' && loopback)) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function normalizePlayerConnection(values = {}) {
  return Object.freeze({
    endpoint: endpoint(values.endpoint),
    sessionId: text(values.sessionId),
    ticket: text(values.ticket),
  });
}

export function hasAuthenticatedPlayerConnection(values = {}) {
  const connection = normalizePlayerConnection(values);
  return Boolean(connection.endpoint && connection.sessionId && connection.ticket);
}
