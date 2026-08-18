import '../pwa/register.mjs';
import '../console-mode-init.mjs';
import { createLanHandoffPayload, openLanHandoffWindow } from './lan-handoff.mjs';

const form = document.querySelector('[data-form]');
const notice = document.querySelector('[data-notice]');
let timer;
function toast(message) {
  notice.textContent = message;
  notice.classList.add('visible');
  clearTimeout(timer);
  timer = setTimeout(() => notice.classList.remove('visible'), 3000);
}
function handoffId() {
  return `lan${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const id = handoffId();
    const endpoint = document.querySelector('[data-endpoint]').value;
    const sessionId = document.querySelector('[data-session]').value;
    const hostTicket = document.querySelector('[data-host-ticket]').value;
    const clientTicket = document.querySelector('[data-client-ticket]').value;
    const hostPayload = createLanHandoffPayload({
      handoffId: id,
      target: 'host',
      endpoint,
      sessionId,
      ticket: hostTicket,
    });
    const clientPayload = createLanHandoffPayload({
      handoffId: id,
      target: 'client',
      endpoint,
      sessionId,
      ticket: clientTicket,
    });
    const hostUrl = new URL('./browser-studio.html', location.href);
    hostUrl.searchParams.set('handoff', id);
    const playerUrl = new URL('../player/index.html', location.href);
    playerUrl.searchParams.set('handoff', id);
    openLanHandoffWindow({ url: hostUrl.href, name: 'spartan-lan-host', payload: hostPayload });
    openLanHandoffWindow({
      url: playerUrl.href,
      name: 'spartan-lan-player',
      payload: clientPayload,
    });
    toast('Host and player tabs opened. Tickets remain in memory only.');
  } catch (error) {
    toast(error.message);
  }
});
