const VOICE_CHAT_REASONS = new Set(['disabled', 'no-microphone', 'permission-required', 'ready']);

/**
 * Resolve whether the client can join the session voice channel. Voice chat
 * fails closed: it requires the explicit voice-chat setting, a real microphone
 * input selection, and an explicit origin-scoped microphone permission grant.
 * Bidirectional audio relay itself remains a host/signaling boundary.
 */
export function resolveVoiceChatPolicy({
  enabled = false,
  audioInput = 'System default',
  micPermission = 'unknown',
} = {}) {
  if (enabled !== true)
    return Object.freeze({ available: false, enabled: false, reason: 'disabled' });
  if (audioInput === 'No microphone')
    return Object.freeze({ available: false, enabled: false, reason: 'no-microphone' });
  if (micPermission !== 'granted')
    return Object.freeze({ available: false, enabled: false, reason: 'permission-required' });
  return Object.freeze({ available: true, enabled: true, reason: 'ready' });
}

export function describeVoiceChatState(policy = {}) {
  switch (policy.reason) {
    case 'disabled':
      return 'Voice chat is off.';
    case 'no-microphone':
      return 'Choose a microphone to join the voice channel.';
    case 'permission-required':
      return 'Microphone permission is required to join the voice channel.';
    case 'ready':
      return 'Voice chat is active.';
    default:
      return 'Voice chat is unavailable.';
  }
}

export function isVoiceChatReason(value) {
  return VOICE_CHAT_REASONS.has(value);
}
