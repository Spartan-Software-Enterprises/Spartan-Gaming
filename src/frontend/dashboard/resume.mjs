export function resolveResumePresentation(record) {
  if (!record)
    return Object.freeze({
      title: 'Desktop stream',
      copy: 'Pick up where you left off with your Spartan Host session.',
      actionLabel: '▶ Resume session',
    });
  const title = record.name;
  const copy = `Continue with your last ${record.backendType === 'emulator' ? 'emulation' : 'gaming'} connection.`;
  const actionLabel =
    record.action === 'open-url'
      ? 'Open service'
      : record.action === 'choose-runtime'
        ? 'Configure runtime'
        : 'Resume connection';
  return Object.freeze({ title, copy, actionLabel });
}

export function resolveRecoveryPresentation(handoff) {
  if (!handoff) return null;
  const title = handoff.backendName || 'Secure Spartan session';
  return Object.freeze({
    title,
    copy: 'A short-lived Spartan Host connection is ready to continue in this browser session.',
    actionLabel: '▶ Resume secure session',
  });
}

export function resolveResumeEntry(record, catalog = []) {
  if (!record || !Array.isArray(catalog)) return undefined;
  return catalog.find((entry) => entry.id === record.backendId);
}
