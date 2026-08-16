// Import standards
import { randomBytes } from 'node:crypto';

// Protocol constants
export const PROTOCOL = 'spartan-gaming/1-friends';
const FRIEND_STATE_CHANGES = new Set([
  'friend.online',
  'friend.offline',
  'friend.request',
  'friend.accepted',
  'friend.rejected',
  'friend.removed',
  'activity.update',
]);

// Friend status
export const FRIEND_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  BUSY: 'busy',
});

// Friend structure
export const Friend = class {
  constructor(id, name, avatarUrl = null, status = FRIEND_STATUS.OFFLINE) {
    this.id = id;
    this.name = name;
    this.avatarUrl = avatarUrl;
    this.status = status;
    this.lastSeen = Date.now();
    this.currentActivity = null; // { gameId, gameName, system, sessionId }
    this.requests = new Set(); // Pending friend requests from this user
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      avatarUrl: this.avatarUrl,
      status: this.status,
      lastSeen: this.lastSeen,
      currentActivity: this.currentActivity,
    };
  }
};

// Activity structure
export const GameActivity = class {
  constructor(gameId, gameName, system, sessionId = null, mode = 'single') {
    this.gameId = gameId;
    this.gameName = gameName;
    this.system = system;
    this.sessionId = sessionId;
    this.mode = mode; // 'single' or 'multiplayer'
    this.startedAt = Date.now();
  }

  toJSON() {
    return {
      gameId: this.gameId,
      gameName: this.gameName,
      system: this.system,
      sessionId: this.sessionId,
      mode: this.mode,
      startedAt: this.startedAt,
    };
  }
};

// Friend request message
class FriendRequestMessage {
  constructor(fromId, fromName, reason = '') {
    this.type = 'friend.request';
    this.fromId = fromId;
    this.fromName = fromName;
    this.reason = reason;
    this.timestamp = Date.now();
    this.id = randomBytes(4).toString('hex');
  }

  serialize() {
    return JSON.stringify({
      protocol: PROTOCOL,
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      fromId: this.fromId,
      fromName: this.fromName,
      reason: this.reason,
    });
  }

  static deserialize(data) {
    const parsed = JSON.parse(data);
    const msg = new this(parsed.fromId, parsed.fromName, parsed.reason);
    msg.timestamp = parsed.timestamp;
    msg.id = parsed.id;
    return msg;
  }
}

// Activity update message
class ActivityUpdateMessage {
  constructor(userId, gameActivity) {
    this.type = 'activity.update';
    this.userId = userId;
    this.gameActivity = gameActivity;
    this.timestamp = Date.now();
    this.id = randomBytes(4).toString('hex');
  }

  serialize() {
    return JSON.stringify({
      protocol: PROTOCOL,
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      userId: this.userId,
      gameActivity: this.gameActivity,
    });
  }

  static deserialize(data) {
    const parsed = JSON.parse(data);
    const msg = new this(parsed.userId, parsed.gameActivity);
    msg.timestamp = parsed.timestamp;
    msg.id = parsed.id;
    return msg;
  }
}

// Friend manager - in-memory state with persistence hooks
class FriendManager {
  constructor() {
    this.friends = new Map(); // id -> Friend
    this.pendingRequests = new Map(); // id -> FriendRequestMessage
    this.listeners = {
      onFriendChange: new Set(),
      onActivityUpdate: new Set(),
      onRequest: new Set(),
    };
    this.lastFriendId = 0;
  }

  // Subscribe to friend changes
  subscribe(onFriendChange) {
    this.listeners.onFriendChange.add(onFriendChange);
    return () => this.listeners.onFriendChange.delete(onFriendChange);
  }

  // Subscribe to activity updates
  subscribeActivity(onActivityUpdate) {
    this.listeners.onActivityUpdate.add(onActivityUpdate);
    return () => this.listeners.onActivityUpdate.delete(onActivityUpdate);
  }

  // Subscribe to friend requests
  subscribeRequest(onRequest) {
    this.listeners.onRequest.add(onRequest);
    return () => this.listeners.onRequest.delete(onRequest);
  }

  // Add a friend
  addFriend(friend) {
    const id = friend.id || `friend_${this.lastFriendId++}`;
    const friendWithId = { ...friend, id };
    this.friends.set(id, friendWithId);
    this.notifyFriendChange('add', friendWithId);
    return id;
  }

  // Remove a friend
  removeFriend(friendId) {
    const removed = this.friends.delete(friendId);
    if (removed) {
      this.notifyFriendChange('remove', friendId);
    }
    return removed;
  }

  // Update friend status
  updateFriendStatus(friendId, status) {
    const friend = this.friends.get(friendId);
    if (friend) {
      friend.status = status;
      friend.lastSeen = Date.now();
      this.notifyFriendChange('update', friend);
      return true;
    }
    return false;
  }

  // Update friend activity
  updateFriendActivity(friendId, gameActivity) {
    const friend = this.friends.get(friendId);
    if (friend) {
      friend.currentActivity = gameActivity;
      this.notifyActivityUpdate(friendId, gameActivity);
      return true;
    }
    return false;
  }

  // Add pending friend request
  addPendingRequest(request) {
    const id = request.fromId || request.id;
    this.pendingRequests.set(id, request);
    this.notifyRequest('add', request);
    return id;
  }

  // Remove pending friend request
  removePendingRequest(requestId) {
    const removed = this.pendingRequests.delete(requestId);
    if (removed) {
      this.notifyRequest('remove', requestId);
    }
    return removed;
  }

  // Get friend by ID
  getFriend(friendId) {
    return this.friends.get(friendId) || null;
  }

  // Get all friends
  getAllFriends() {
    return Array.from(this.friends.values());
  }

  // Get pending requests
  getPendingRequests() {
    return Array.from(this.pendingRequests.values());
  }

  // Notify friend change to all listeners
  notifyFriendChange(type, data) {
    for (const listener of this.listeners.onFriendChange) {
      try {
        listener(type, data);
      } catch (error) {
        console.warn('Friend change listener error:', error);
      }
    }
  }

  // Notify activity update to all listeners
  notifyActivityUpdate(userId, gameActivity) {
    for (const listener of this.listeners.onActivityUpdate) {
      try {
        listener(userId, gameActivity);
      } catch (error) {
        console.warn('Activity update listener error:', error);
      }
    }
  }

  // Notify request to all listeners
  notifyRequest(type, data) {
    for (const listener of this.listeners.onRequest) {
      try {
        listener(type, data);
      } catch (error) {
        console.warn('Friend request listener error:', error);
      }
    }
  }
}

// Export
export {
  PROTOCOL,
  FRIEND_STATUS,
  Friend,
  GameActivity,
  FriendRequestMessage,
  ActivityUpdateMessage,
  FRIEND_STATE_CHANGES,
  FriendManager,
};
