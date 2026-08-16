// Import standards
import { randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';

// Protocol constants (match session.mjs convention)
export const PROTOCOL = 'spartan-gaming/1-multiplayer';
const MAX_SEEN_MESSAGE_IDS = 128;
const SIGNALING_STATE_CHANGES = new Set([
  'connection.open',
  'connection.closed',
  'connection.error',
  'session.created',
  'session.joined',
  'session.left',
  'player.joined',
  'player.left',
  'game.sync.start',
  'game.sync.stop',
]);

// Signaling message types
export const MESSAGE_TYPE = {
  HELLO: 'hello',
  SESSION_CREATE: 'session.create',
  SESSION_RESPONSE: 'session.response',
  SESSION_ACCEPT: 'session.accept',
  SESSION_REJECT: 'session.reject',
  PLAYER_JOIN: 'player.join',
  PLAYER_LEAVE: 'player.leave',
  INPUT: 'input',
  GAME_SYNC: 'game.sync',
  ICE_CANDIDATE: 'ice.candidate',
  ICE_COMPLETE: 'ice.complete',
};

// Session state machine
const SESSION_STATES = Object.freeze({
  IDLE: 'idle',
  CREATING: 'creating',
  OFFER_SENT: 'offer_sent',
  ANSWER_RECEIVED: 'answer_received',
  ACTIVE: 'active',
  CLOSING: 'closing',
  ERROR: 'error',
});

// Capabilities exported for UI negotiation
export const CAPABILITIES = Object.freeze({
  transports: ['webrtc'],
  input: {
    gamepad: true,
    keyboard: true,
    playerSlots: 2,
    virtualGamepadBackend: 'Automatic',
  },
  audio: { codecs: [], enabled: false }, // Disabled for low-latency gameplay
  video: { enabled: false }, // Handled by cloud/emitter
});

// Message envelope base class
class Envelope {
  constructor(type, payload = {}, id = null) {
    this.type = type;
    this.payload = payload;
    this.id = id || randomBytes(4).toString('hex');
    this.timestamp = Date.now();
  }

  serialize() {
    return JSON.stringify({
      protocol: PROTOCOL,
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      payload: this.payload,
    });
  }

  static deserialize(data) {
    const parsed = JSON.parse(data);
    const envelope = new this(parsed.type, parsed.payload, parsed.id);
    envelope.timestamp = parsed.timestamp;
    return envelope;
  }
}

// Hello message - initial connection
class HelloMessage extends Envelope {
  constructor(playerName, capabilities = {}) {
    super(MESSAGE_TYPE.HELLO, { playerName, capabilities });
  }
}

// Session create - initiate a multiplayer session
class SessionCreateMessage extends Envelope {
  constructor(sessionId, gameId, romHash, playerCount = 2) {
    super(MESSAGE_TYPE.SESSION_CREATE, {
      sessionId,
      gameId,
      romHash,
      playerCount,
    });
  }
}

// Session response - respond to session create
class SessionResponseMessage extends Envelope {
  constructor(sessionId, accepted) {
    super(MESSAGE_TYPE.SESSION_RESPONSE, { sessionId, accepted });
  }
}

// Session accept - accept a session invitation
class SessionAcceptMessage extends Envelope {
  constructor(sessionId, playerId) {
    super(MESSAGE_TYPE.SESSION_ACCEPT, { sessionId, playerId });
  }
}

// Player join - notify others a player joined
class PlayerJoinMessage extends Envelope {
  constructor(playerId, playerName, controllerSlots = 1) {
    super(MESSAGE_TYPE.PLAYER_JOIN, { playerId, playerName, controllerSlots });
  }
}

// Player leave - notify others a player left
class PlayerLeaveMessage extends Envelope {
  constructor(playerId, reason = 'disconnected') {
    super(MESSAGE_TYPE.PLAYER_LEAVE, { playerId, reason });
  }
}

// Input message - controller state synchronization
class InputMessage extends Envelope {
  constructor(frame, inputs, playerId) {
    super(MESSAGE_TYPE.INPUT, { frame, inputs, playerId });
  }
}

// Game sync message - frame synchronization
class GameSyncMessage extends Envelope {
  constructor(frame, stateHash) {
    super(MESSAGE_TYPE.GAME_SYNC, { frame, stateHash });
  }
}

// ICE candidate message - WebRTC signaling
class ICECandidateMessage extends Envelope {
  constructor(candidate, sdpMid, sdpMLineIndex) {
    super(MESSAGE_TYPE.ICE_CANDIDATE, {
      candidate,
      sdpMid,
      sdpMLineIndex,
    });
  }
}

// ICE complete message - WebRTC signaling finished
class ICECompleteMessage extends Envelope {
  constructor() {
    super(MESSAGE_TYPE.ICE_COMPLETE);
  }
}

// Rate limiting for signaling messages
class RateLimiter {
  constructor(maxPerSecond = 10) {
    this.maxPerSecond = maxPerSecond;
    this.lastSend = 0;
    this.queue = [];
    this.running = false;
  }

  async send(envelope) {
    const now = Date.now();
    const elapsed = now - this.lastSend;

    if (elapsed < 1000 / this.maxPerSecond) {
      await new Promise((resolve) => setTimeout(resolve, 1000 / this.maxPerSecond - elapsed));
    }

    this.lastSend = Date.now();
    return envelope;
  }

  enqueue(envelope) {
    this.queue.push(envelope);
    if (!this.running) {
      this.running = true;
      this.processQueue();
    }
    return this.queue.length;
  }

  async processQueue() {
    while (this.queue.length > 0 && this.running) {
      const envelope = this.queue.shift();
      await this.send(envelope);
    }
    this.running = this.queue.length > 0;
  }
}

// Export classes
export {
  PROTOCOL,
  SESSION_STATES,
  MESSAGE_TYPE,
  CAPABILITIES,
  Envelope,
  HelloMessage,
  SessionCreateMessage,
  SessionResponseMessage,
  SessionAcceptMessage,
  PlayerJoinMessage,
  PlayerLeaveMessage,
  InputMessage,
  GameSyncMessage,
  ICECandidateMessage,
  ICECompleteMessage,
  RateLimiter,
  SIGNALING_STATE_CHANGES,
};
