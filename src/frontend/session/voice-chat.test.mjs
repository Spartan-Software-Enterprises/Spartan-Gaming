import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeVoiceChatState,
  isVoiceChatReason,
  resolveVoiceChatPolicy,
} from './voice-chat.mjs';

test('voice chat fails closed without the explicit setting', () => {
  assert.deepEqual(resolveVoiceChatPolicy({ enabled: false }), {
    available: false,
    enabled: false,
    reason: 'disabled',
  });
  assert.deepEqual(resolveVoiceChatPolicy(), {
    available: false,
    enabled: false,
    reason: 'disabled',
  });
});

test('voice chat requires a real microphone selection', () => {
  assert.deepEqual(
    resolveVoiceChatPolicy({
      enabled: true,
      audioInput: 'No microphone',
      micPermission: 'granted',
    }),
    { available: false, enabled: false, reason: 'no-microphone' },
  );
  assert.deepEqual(
    resolveVoiceChatPolicy({
      enabled: true,
      audioInput: 'System default',
      micPermission: 'granted',
    }),
    { available: true, enabled: true, reason: 'ready' },
  );
});

test('voice chat requires explicit microphone permission', () => {
  assert.deepEqual(resolveVoiceChatPolicy({ enabled: true, audioInput: 'System default' }), {
    available: false,
    enabled: false,
    reason: 'permission-required',
  });
  assert.deepEqual(
    resolveVoiceChatPolicy({
      enabled: true,
      audioInput: 'System default',
      micPermission: 'denied',
    }),
    { available: false, enabled: false, reason: 'permission-required' },
  );
});

test('voice chat state descriptions stay bounded', () => {
  for (const reason of ['disabled', 'no-microphone', 'permission-required', 'ready']) {
    assert.ok(isVoiceChatReason(reason));
    assert.ok(describeVoiceChatState({ reason }).length > 0);
  }
  assert.equal(isVoiceChatReason('unsupported'), false);
  assert.ok(describeVoiceChatState({ reason: 'unsupported' }).length > 0);
});
