import '../pwa/register.mjs';
import { createProviderIntegration } from '../providers/integration.mjs';
import { setupStreamServices, renderStreamServices } from './streaming.mjs';

const STORAGE_PREFIX = 'spartan-gaming.social.v1.';

function safeId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(normalized))
    throw new TypeError('social id must use a safe identifier');
  return normalized;
}

export function createSocialStore({ storage = globalThis.localStorage } = {}) {
  const read = (key) => {
    try {
      const raw = storage?.getItem(`${STORAGE_PREFIX}${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    storage?.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  };
  return Object.freeze({
    getFriends() {
      return read('friends') || [];
    },
    setFriends(friends) {
      write('friends', friends);
    },
    getMessages() {
      return read('messages') || [];
    },
    addMessage(message) {
      const messages = read('messages') || [];
      messages.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        ...message,
      });
      write('messages', messages.slice(-500));
    },
    getParties() {
      return read('parties') || [];
    },
    setParties(parties) {
      write('parties', parties);
    },
    getPresence() {
      return read('presence') || { status: 'online', activity: null, updatedAt: new Date().toISOString() };
    },
    setPresence(presence) {
      write('presence', { ...read('presence'), ...presence, updatedAt: new Date().toISOString() });
    },
    getStreamSettings() {
      return read('streamSettings') || { service: null, key: null, title: '', game: '' };
    },
    setStreamSettings(settings) {
      write('streamSettings', settings);
    },
  });
}

const socialStore = createSocialStore();

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
  );
}

function showToast(message) {
  const toast = document.querySelector('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function renderFriends() {
  const cards = document.querySelector('[data-cards]');
  const friends = socialStore.getFriends();
  const parties = socialStore.getParties();
  const presence = socialStore.getPresence();

  document.querySelector('[data-presence-title]').textContent =
    presence.status === 'online' ? 'Online' : presence.status === 'away' ? 'Away' : presence.status === 'busy' ? 'Busy' : 'Offline';
  document.querySelector('[data-presence-copy]').textContent =
    presence.activity ? `Playing ${presence.activity}` : 'Set your status to let friends know what you\'re playing.';

  const entries = [
    ...friends.map((friend) => ({
      id: friend.id,
      name: friend.name,
      type: 'friend',
      status: friend.status || 'offline',
      activity: friend.activity,
      summary: friend.status === 'online' ? `Online${friend.activity ? ` · ${friend.activity}` : ''}` : 'Offline',
    })),
    ...parties.map((party) => ({
      id: party.id,
      name: party.name,
      type: 'party',
      status: party.open ? 'open' : 'closed',
      members: party.members?.length || 0,
      summary: `${party.members?.length || 0} members · ${party.open ? 'Open to join' : 'Invite only'}`,
    })),
  ];

  document.querySelector('[data-result-count]').textContent = `${entries.length} connection${entries.length === 1 ? '' : 's'}`;

  cards.innerHTML = entries.length
    ? entries
        .map((entry) => {
          const tag =
            entry.type === 'friend'
              ? entry.status
              : `${entry.members} members`;
          const actionLabel =
            entry.type === 'friend'
              ? entry.status === 'online'
                ? 'Message'
                : 'Invite'
              : entry.status === 'open'
                ? 'Join'
                : 'Request invite';
          return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(entry.type)}</span><button class="favorite" data-favorite="${escapeHtml(entry.id)}" aria-label="Favorite ${escapeHtml(entry.name)}">★</button></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(entry.summary)}</p><div class="chips"><span class="chip">${escapeHtml(tag)}</span></div><div class="card-actions"><button class="launch" data-action="${entry.type === 'friend' ? 'message' : 'join'}" data-id="${escapeHtml(entry.id)}">${actionLabel}</button><span class="details">${entry.type === 'friend' ? 'Friend' : 'Party'}</span></div></article>`;
        })
        .join('')
    : '<div class="empty">No social connections yet. Add friends or create a party to get started.</div>';
}

function openChat(friendId) {
  const dialog = document.querySelector('[data-social-dialog]');
  const title = document.querySelector('[data-social-title]');
  const detail = document.querySelector('[data-social-detail]');
  const body = document.querySelector('[data-social-body]');
  const friends = socialStore.getFriends();
  const friend = friends.find((f) => f.id === friendId);
  if (!friend) return;

  title.textContent = friend.name;
  detail.textContent = friend.status === 'online' ? 'Online now' : 'Offline';

  const messages = socialStore.getMessages().filter((m) => m.with === friendId);
  body.innerHTML = `
    <div class="chat-history">
      ${messages.length ? messages.map((m) => `<div class="chat-message"><div class="chat-message-header"><strong>${escapeHtml(m.from === 'you' ? 'You' : friend.name)}</strong><span class="chat-message-time">${escapeHtml(new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span></div><span>${escapeHtml(m.text)}</span></div>`).join('') : '<p class="empty">No messages yet. Say hello!</p>'}
    </div>
    <div class="chat-input">
      <input data-chat-input type="text" placeholder="Type a message..." autocomplete="off" />
      <button data-send-message data-id="${escapeHtml(friendId)}">Send</button>
    </div>
  `;

  const history = body.querySelector('.chat-history');
  if (history) history.scrollTop = history.scrollHeight;

  const input = body.querySelector('[data-chat-input]');
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const text = input.value.trim();
      if (text) {
        socialStore.addMessage({ with: friendId, from: 'you', text });
        openChat(friendId);
        showToast('Message sent');
      }
    }
  });

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function setupSocial() {
  const search = document.querySelector('[data-search]');
  const filterButtons = document.querySelectorAll('[data-filter]');
  let currentFilter = 'all';
  let providerEntries = [];

  filterButtons.forEach((button) =>
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter;
      filterButtons.forEach((item) => item.classList.toggle('is-active', item === button));
      render();
    }),
  );

  search?.addEventListener('input', () => render());

  async function loadProviders() {
    try {
      const response = await fetch('../../../providers/catalog.json');
      const data = await response.json();
      providerEntries = data.providers || [];
    } catch {
      providerEntries = [];
    }
    renderStreamServices(providerEntries);
  }

  function render() {
    const query = search?.value?.toLowerCase().trim() || '';
    const cards = document.querySelector('[data-cards]');

    if (currentFilter === 'streaming') {
      const services = providerEntries.filter((entry) =>
        ['twitch', 'youtube-live', 'kick', 'steam-broadcasting', 'discord'].includes(entry.id),
      );
      document.querySelector('[data-result-count]').textContent = `${services.length} service${services.length === 1 ? '' : 's'}`;
      cards.innerHTML = services.length
        ? services
            .map((entry) => {
              const integration = createProviderIntegration(entry, {});
              const caps = integration.surfaces.map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('');
              const authLabel = entry.id === 'steam-broadcasting' ? 'Steam OpenID' : entry.id === 'discord' ? 'OAuth' : 'Official';
              return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(entry.kind)}</span><button class="favorite" data-favorite="${escapeHtml(entry.id)}" aria-label="Favorite ${escapeHtml(entry.name)}">★</button></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(entry.description || 'Official streaming or social surface. Opens in an isolated provider view.')}</p><div class="chips">${caps}</div><div class="card-actions"><button class="launch" data-stream="${escapeHtml(entry.id)}">Open ${escapeHtml(entry.name)}</button><span class="details">${entry.secure !== false ? 'Secure' : 'Standard'} · ${authLabel}</span></div></article>`;
            })
            .join('')
        : '<div class="empty">No streaming services available.</div>';
      return;
    }

    const friends = socialStore.getFriends().filter((f) =>
      f.name.toLowerCase().includes(query),
    );
    const parties = socialStore.getParties().filter((p) =>
      p.name.toLowerCase().includes(query),
    );
    const messages = socialStore.getMessages();
    const messageThreads = currentFilter === 'messages'
      ? friends
          .map((friend) => {
            const threadMessages = messages.filter((m) => m.with === friend.id);
            const lastMessage = threadMessages[threadMessages.length - 1];
            return {
              id: friend.id,
              name: friend.name,
              type: 'message',
              status: friend.status || 'offline',
              summary: lastMessage ? lastMessage.text : 'No messages yet',
              messageCount: threadMessages.length,
            };
          })
          .filter((thread) => thread.messageCount > 0)
      : [];
    const entries = [
      ...(currentFilter === 'all' || currentFilter === 'friends'
        ? friends.map((friend) => ({
            id: friend.id,
            name: friend.name,
            type: 'friend',
            status: friend.status || 'offline',
            activity: friend.activity,
            summary: friend.status === 'online' ? `Online${friend.activity ? ` · ${friend.activity}` : ''}` : 'Offline',
          }))
        : []),
      ...(currentFilter === 'all' || currentFilter === 'parties'
        ? parties.map((party) => ({
            id: party.id,
            name: party.name,
            type: 'party',
            status: party.open ? 'open' : 'closed',
            members: party.members?.length || 0,
            summary: `${party.members?.length || 0} members · ${party.open ? 'Open to join' : 'Invite only'}`,
          }))
        : []),
      ...messageThreads,
    ];

    document.querySelector('[data-result-count]').textContent = `${entries.length} connection${entries.length === 1 ? '' : 's'}`;
    cards.innerHTML = entries.length
      ? entries
          .map((entry) => {
            const tag = entry.type === 'friend' ? entry.status : entry.type === 'message' ? 'message' : `${entry.members} members`;
            const actionLabel =
              entry.type === 'friend'
                ? entry.status === 'online'
                  ? 'Message'
                  : 'Invite'
                : entry.type === 'message'
                  ? 'Open chat'
                  : entry.status === 'open'
                    ? 'Join'
                    : 'Request invite';
            return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(entry.type)}</span><button class="favorite" data-favorite="${escapeHtml(entry.id)}" aria-label="Favorite ${escapeHtml(entry.name)}">★</button></div><h3>${escapeHtml(entry.name)}</h3><p>${escapeHtml(entry.summary)}</p><div class="chips"><span class="chip">${escapeHtml(tag)}</span></div><div class="card-actions"><button class="launch" data-action="${entry.type === 'friend' || entry.type === 'message' ? 'message' : 'join'}" data-id="${escapeHtml(entry.id)}">${actionLabel}</button><span class="details">${entry.type === 'friend' ? 'Friend' : entry.type === 'message' ? 'Message' : 'Party'}</span></div></article>`;
          })
          .join('')
      : '<div class="empty">No social connections match this view.</div>';
  }

  document.addEventListener('click', (event) => {
    const messageButton = event.target.closest('[data-action="message"]');
    if (messageButton) {
      openChat(messageButton.dataset.id);
      return;
    }
    const joinButton = event.target.closest('[data-action="join"]');
    if (joinButton) {
      showToast(`Joined ${joinButton.dataset.id}`);
      return;
    }
    const sendButton = event.target.closest('[data-send-message]');
    if (sendButton) {
      const input = document.querySelector('[data-chat-input]');
      const text = input?.value?.trim();
      if (text) {
        socialStore.addMessage({ with: sendButton.dataset.id, from: 'you', text });
        input.value = '';
        openChat(sendButton.dataset.id);
        showToast('Message sent');
      }
      return;
    }
    const closeButton = event.target.closest('[data-social-close]');
    if (closeButton) {
      const dialog = document.querySelector('[data-social-dialog]');
      if (typeof dialog.close === 'function') dialog.close();
      else dialog?.removeAttribute('open');
      return;
    }
  });

  document.querySelector('[data-action="set-status"]')?.addEventListener('click', () => {
    const statuses = ['online', 'away', 'busy', 'offline'];
    const current = socialStore.getPresence().status;
    const next = statuses[(statuses.indexOf(current) + 1) % statuses.length];
    socialStore.setPresence({ status: next });
    render();
    showToast(`Status set to ${next}`);
  });

  render();
  loadProviders();
}

if (typeof document !== 'undefined') {
  setupSocial();
}
