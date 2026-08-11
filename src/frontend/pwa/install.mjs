const OUTCOMES = new Set(['accepted', 'dismissed']);

function standalone(windowRef) {
  try {
    return Boolean(windowRef?.matchMedia?.('(display-mode: standalone)')?.matches);
  } catch {
    return false;
  }
}

export function createPwaInstallController({ windowRef = globalThis, onState = () => {} } = {}) {
  let deferred = null;
  let state = standalone(windowRef) ? 'installed' : 'unavailable';
  const publish = (next) => {
    state = next;
    onState(state);
    return state;
  };
  const onBeforeInstallPrompt = (event) => {
    event.preventDefault?.();
    deferred = event;
    publish('available');
  };
  const onInstalled = () => {
    deferred = null;
    publish('installed');
  };
  windowRef?.addEventListener?.('beforeinstallprompt', onBeforeInstallPrompt);
  windowRef?.addEventListener?.('appinstalled', onInstalled);
  return Object.freeze({
    get state() {
      return state;
    },
    get canInstall() {
      return Boolean(deferred) && state === 'available';
    },
    async prompt() {
      if (!deferred || state !== 'available') return Object.freeze({ status: 'unavailable' });
      const event = deferred;
      deferred = null;
      try {
        await event.prompt?.();
        const choice = await event.userChoice;
        const outcome = OUTCOMES.has(choice?.outcome) ? choice.outcome : 'dismissed';
        publish(outcome);
        return Object.freeze({ status: outcome });
      } catch (error) {
        publish('dismissed');
        return Object.freeze({
          status: 'dismissed',
          reason: error?.message || 'install prompt failed',
        });
      }
    },
    close() {
      windowRef?.removeEventListener?.('beforeinstallprompt', onBeforeInstallPrompt);
      windowRef?.removeEventListener?.('appinstalled', onInstalled);
      deferred = null;
      return this;
    },
  });
}
