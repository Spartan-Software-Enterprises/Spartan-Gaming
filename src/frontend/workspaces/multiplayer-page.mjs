import '../pwa/register.mjs';
import { createFriendManager } from './friends.mjs';
import { createSessionManager } from './matchmaking.mjs';
import { FRIEND_STATUS, Friend, GameActivity } from './friends.mjs';
import { MESSAGE_TYPE, CAPABILITIES } from './matchmaking.mjs';

const friendManager = createFriendManager();
const sessionManager = createSessionManager();

let multiplayerGrid = document.querySelector('[data-multiplayer]');
let toast = document.querySelector('[data-toast]');
let timer;

if (!multiplayerGrid || !toast) {
  console.error('Multiplayer page: required elements not found');
  export {};
}

// --- UI Helpers ---

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function formatActivity(activity) {
  if (!activity) return 'Playing locally';
  return ` ${activity.gameName} (${activity.system})${activity.mode === 'multi' ? ' • Multiplayer' : ''}`;
}

// --- State Rendering ---

function renderFriendsList(friends) {
  if (friends.length === 0) {
    multiplayerGrid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="21" x2="15" y2="21"/>
        </svg>
        <p>No friends added yet</p>
        <p>Add friends from the library to see their activity</p>
      </div>`;
    return;
  }

  multiplayerGrid.innerHTML = friends
    .map(
      (friend) => `
    <div class="friend-card ${friend.status === FRIEND_STATUS.ONLINE ? 'online' : 'offline'}" data-friend-id="${friend.id}">
      <div class="friend-status ${friend.status === FRIEND_STATUS.ONLINE ? 'dot-online' : 'dot-offline'}"></div>
      <span class="friend-name">${escapeHtml(friend.name)}</span>
      ${
        friend.currentActivity
          ? `
        <div class="friend-activity">
          <span class="activity-icon">${formatActivity(friend.currentActivity)}</span>
        </div>`
          : ''
      }
      <button class="friend-invite" data-friend-id="${friend.id}">
        Invite to multiplayer
      </button>
    </div>`,
    )
    .join('');
}

function renderEmptyState() {
  multiplayerGrid.innerHTML = `
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h6l8 8h6a2 2 0 0 1 2 2z"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="9"/>
        <line x1="12" y1="9" x2="15" y2="15"/>
      </svg>
      <p>Start a multiplayer session</p>
      <p>Invite friends or create a session to join</p>
    </div>`;
}

// --- Event Handlers ---

function handleFriendInvite_click(event) {
  const friendId = event.target.dataset.friendId;
  const friend = friendManager.getFriend(friendId);
  if (!friend) return;

  // Initiate a session with this friend
  initiateSessionWithFriend(friend);
}

function initiateSessionWithFriend(friend) {
  // Create a session via the session manager
  const session = sessionManager.createSession({
    name: `${friend.name}'s Game`,
    gameId: null,
    playerCount: 2,
    onSessionCreated: (session) => {
      showToast(`Session created: ${session.name}`);
    },
    onError: (error) => {
      showToast('Failed to create session: ' + error);
    },
  });

  showToast(`Inviting ${friend.name} to multiplayer session`);
}

// --- Initialization ---

function init() {
  // Render initial state
  renderFriendsList(friendManager.getAllFriends());

  // Subscribe to friend changes
  const unsubscribe = friendManager.subscribe((type, data) => {
    if (type === 'add' || type === 'update') {
      renderFriendsList(friendManager.getAllFriends());
    }
  });

  // Subscribe to activity updates
  friendManager.subscribeActivity((userId, activity) => {
    renderFriendsList(friendManager.getAllFriends());
  });

  // Subscribe to friend requests
  friendManager.subscribeRequest((type, request) => {
    if (type === 'add') {
      showToast(`New friend request from ${request.fromName}`);
    }
  });

  // Event delegation for invite buttons
  document.addEventListener('click', (event) => {
    const inviteBtn = event.target.closest('.friend-invite');
    if (inviteBtn) {
      handleFriendInvite_click(event);
    }
  });

  // Show empty state when no friends
  setTimeout(() => {
    const friends = friendManager.getAllFriends();
    if (friends.length === 0) {
      renderEmptyState();
    }
  }, 100);
}

init();

// Export for testing/integration
export {
  init,
  friendManager,
  sessionManager,
  CAPABILITIES,
  FRIEND_STATUS,
  GameActivity,
  escapeHtml,
  showToast,
};
