function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizePlayerConnection(values = {}) {
  return Object.freeze({
    endpoint: text(values.endpoint),
    sessionId: text(values.sessionId),
    ticket: text(values.ticket),
  });
}

export function hasAuthenticatedPlayerConnection(values = {}) {
  const connection = normalizePlayerConnection(values);
  return Boolean(connection.endpoint && connection.sessionId && connection.ticket);
}
