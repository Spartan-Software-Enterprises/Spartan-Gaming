import '../pwa/register.mjs';
import { bindPrimaryNavigation } from '../primary-navigation.mjs';

const STORAGE_PREFIX = 'spartan-gaming.multiplayer.v1.';

function safeId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(normalized))
    throw new TypeError('multiplayer id must use a safe identifier');
  return normalized;
}

export function createMultiplayerStore({ storage = globalThis.localStorage } = {}) {
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
    getSessions() {
      return read('sessions') || [];
    },
    setSessions(sessions) {
      write('sessions', sessions);
    },
    addSession(session) {
      const sessions = read('sessions') || [];
      const normalized = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'open',
        ...session,
      };
      sessions.push(normalized);
      write('sessions', sessions.slice(-100));
      return normalized;
    },
    updateSession(id, updates) {
      const sessions = read('sessions') || [];
      const index = sessions.findIndex((s) => s.id === id);
      if (index === -1) return null;
      sessions[index] = { ...sessions[index], ...updates, updatedAt: new Date().toISOString() };
      write('sessions', sessions);
      return sessions[index];
    },
    removeSession(id) {
      const sessions = read('sessions') || [];
      const filtered = sessions.filter((s) => s.id !== id);
      write('sessions', filtered);
      return filtered.length !== sessions.length;
    },
    getInvitations() {
      return read('invitations') || [];
    },
    addInvitation(invitation) {
      const invitations = read('invitations') || [];
      invitations.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        status: 'pending',
        ...invitation,
      });
      write('invitations', invitations.slice(-200));
    },
    updateInvitation(id, updates) {
      const invitations = read('invitations') || [];
      const index = invitations.findIndex((i) => i.id === id);
      if (index === -1) return null;
      invitations[index] = { ...invitations[index], ...updates };
      write('invitations', invitations);
      return invitations[index];
    },
  });
}

const multiplayerStore = createMultiplayerStore();

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

function renderSessions() {
  const cards = document.querySelector('[data-cards]');
  const sessions = multiplayerStore.getSessions();
  const invitations = multiplayerStore.getInvitations();

  document.querySelector('[data-result-count]').textContent =
    `${sessions.length} session${sessions.length === 1 ? '' : 's'}`;

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  cards.innerHTML = pendingInvitations.length
    ? `<div class="invitations">${pendingInvitations.map((inv) => `<div class="invitation"><strong>${escapeHtml(inv.from || 'Someone')}</strong> invited you to <em>${escapeHtml(inv.game || 'a game')}</em><div class="invite-actions"><button class="launch" data-accept="${escapeHtml(inv.id)}">Accept</button><button class="secondary-button" data-decline="${escapeHtml(inv.id)}">Decline</button></div></div>`).join('')}</div>`
    : '';

  if (sessions.length === 0 && pendingInvitations.length === 0) {
    cards.innerHTML +=
      '<div class="empty">No active multiplayer sessions. Create one to get started.</div>';
    return;
  }

  cards.innerHTML += sessions
    .map((session) => {
      const statusClass =
        session.status === 'open'
          ? 'status-open'
          : session.status === 'in-progress'
            ? 'status-playing'
            : 'status-closed';
      return `<article class="card"><div class="card-top"><span class="card-type">${escapeHtml(session.game || 'Game session')}</span><span class="status ${statusClass}">${escapeHtml(session.status || 'open')}</span></div><h3>${escapeHtml(session.name || 'Untitled session')}</h3><p>${escapeHtml(session.description || 'No description')}</p><div class="chips"><span class="chip">${escapeHtml(session.players?.length || 0)}/${escapeHtml(session.maxPlayers || 4)} players</span><span class="chip">${escapeHtml(session.host || 'Unknown host')}</span></div><div class="card-actions"><button class="launch" data-join="${escapeHtml(session.id)}">${session.status === 'open' ? 'Join' : 'Spectate'}</button><button class="secondary-button" data-manage="${escapeHtml(session.id)}">Manage</button></div></article>`;
    })
    .join('');
}

function loadImportedGames() {
  try {
    const raw = globalThis.localStorage?.getItem('spartan-gaming.imported-games.v1');
    if (!raw) return [];
    const games = JSON.parse(raw);
    return Array.isArray(games) ? games.slice(0, 200) : [];
  } catch {
    return [];
  }
}

function populateGameSelect() {
  const select = document.querySelector('[data-session-game]');
  if (!select) return;
  const games = loadImportedGames();
  const existingOptions = new Set(Array.from(select.options).map((option) => option.value));
  games.forEach((game) => {
    if (!existingOptions.has(game.id)) {
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.name;
      select.appendChild(option);
    }
  });
}

function getSelectedGameName() {
  const select = document.querySelector('[data-session-game]');
  if (!select) return '';
  const selectedOption = select.options[select.selectedIndex];
  if (selectedOption && selectedOption.value && selectedOption.value !== '') {
    return selectedOption.textContent;
  }
  const customInput = document.querySelector('[data-session-game-custom]');
  return customInput?.value?.trim() || '';
}

function openManageDialog(sessionId) {
  const session = multiplayerStore.getSessions().find((s) => s.id === sessionId);
  if (!session) return;

  const dialog = document.querySelector('[data-manage-dialog]');
  const title = document.querySelector('[data-manage-title]');
  const detail = document.querySelector('[data-manage-detail]');
  const body = document.querySelector('[data-manage-body]');

  title.textContent = session.name;
  detail.textContent = `${session.game} · ${session.players?.length || 0}/${session.maxPlayers || 4} players`;

  const players = session.players || [];
  body.innerHTML = `
    <div class="player-list">
      ${players.length ? players.map((player) => `<div class="player"><div><div class="player-name">${escapeHtml(player.name)}</div><div class="player-role">${player.host ? 'Host' : 'Player'}</div></div></div>`).join('') : '<p class="empty">No players yet.</p>'}
    </div>
    <div class="actions">
      <button class="secondary-button" data-copy-invite="${escapeHtml(session.id)}">Copy invite link</button>
      <button class="secondary-button" data-close-session="${escapeHtml(session.id)}">Close session</button>
    </div>
  `;

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function setupMultiplayer() {
  bindPrimaryNavigation();
  populateGameSelect();
  renderSessions();

  document.querySelector('[data-action="create-session"]')?.addEventListener('click', () => {
    const dialog = document.querySelector('[data-multiplayer-dialog]');
    const nameInput = document.querySelector('[data-session-name]');
    const gameSelect = document.querySelector('[data-session-game]');
    const maxInput = document.querySelector('[data-session-max]');
    if (nameInput) nameInput.value = '';
    if (gameSelect) gameSelect.value = '';
    if (maxInput) maxInput.value = '4';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });

  document.querySelector('[data-session-save]')?.addEventListener('click', () => {
    const name = document.querySelector('[data-session-name]')?.value?.trim();
    const game = getSelectedGameName();
    const maxPlayers = Math.max(
      2,
      Math.min(64, Number(document.querySelector('[data-session-max]')?.value || 4)),
    );
    if (!name || !game) {
      showToast('Please enter a session name and select or enter a game.');
      return;
    }
    multiplayerStore.addSession({
      name,
      game,
      maxPlayers,
      players: [{ id: 'you', name: 'You', host: true }],
      host: 'You',
      description: '',
    });
    showToast(`Created session: ${name}`);
    renderSessions();
    const dialog = document.querySelector('[data-multiplayer-dialog]');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
  });

  document.addEventListener('click', (event) => {
    const joinButton = event.target.closest('[data-join]');
    if (joinButton) {
      const session = multiplayerStore.getSessions().find((s) => s.id === joinButton.dataset.join);
      if (session) {
        showToast(`Joined ${session.name}`);
      }
      return;
    }
    const manageButton = event.target.closest('[data-manage]');
    if (manageButton) {
      openManageDialog(manageButton.dataset.manage);
      return;
    }
    const acceptButton = event.target.closest('[data-accept]');
    if (acceptButton) {
      const invitation = multiplayerStore
        .getInvitations()
        .find((i) => i.id === acceptButton.dataset.accept);
      if (invitation) {
        multiplayerStore.updateInvitation(invitation.id, { status: 'accepted' });
        multiplayerStore.addSession({
          name: `${invitation.game} session`,
          game: invitation.game,
          maxPlayers: 4,
          players: [{ id: 'you', name: 'You', host: false }],
          host: invitation.from,
          description: `Invited by ${invitation.from}`,
        });
        showToast(`Joined ${invitation.game}`);
        renderSessions();
      }
      return;
    }
    const declineButton = event.target.closest('[data-decline]');
    if (declineButton) {
      const invitation = multiplayerStore
        .getInvitations()
        .find((i) => i.id === declineButton.dataset.decline);
      if (invitation) {
        multiplayerStore.updateInvitation(invitation.id, { status: 'declined' });
        showToast('Invitation declined');
        renderSessions();
      }
      return;
    }
    const closeButton = event.target.closest('[data-multiplayer-close]');
    if (closeButton) {
      const dialog = document.querySelector('[data-multiplayer-dialog]');
      if (typeof dialog.close === 'function') dialog.close();
      else dialog?.removeAttribute('open');
      return;
    }
    const manageCloseButton = event.target.closest('[data-manage-close]');
    if (manageCloseButton) {
      const dialog = document.querySelector('[data-manage-dialog]');
      if (typeof dialog.close === 'function') dialog.close();
      else dialog?.removeAttribute('open');
      return;
    }
    const manageCloseAction = event.target.closest('[data-manage-close-action]');
    if (manageCloseAction) {
      const dialog = document.querySelector('[data-manage-dialog]');
      if (typeof dialog.close === 'function') dialog.close();
      else dialog?.removeAttribute('open');
      return;
    }
    const copyInviteButton = event.target.closest('[data-copy-invite]');
    if (copyInviteButton) {
      const session = multiplayerStore
        .getSessions()
        .find((s) => s.id === copyInviteButton.dataset.copyInvite);
      if (session) {
        const inviteLink = `${globalThis.location.origin}/multiplayer?join=${session.id}`;
        navigator.clipboard?.writeText(inviteLink).then(
          () => showToast('Invite link copied to clipboard'),
          () => showToast('Failed to copy invite link'),
        );
      }
      return;
    }
    const closeSessionButton = event.target.closest('[data-close-session]');
    if (closeSessionButton) {
      const session = multiplayerStore
        .getSessions()
        .find((s) => s.id === closeSessionButton.dataset.closeSession);
      if (session) {
        multiplayerStore.updateSession(session.id, { status: 'closed' });
        renderSessions();
        showToast(`Session ${session.name} closed`);
        const dialog = document.querySelector('[data-manage-dialog]');
        if (typeof dialog.close === 'function') dialog.close();
        else dialog?.removeAttribute('open');
      }
      return;
    }
  });
}

if (typeof document !== 'undefined') {
  setupMultiplayer();
}
