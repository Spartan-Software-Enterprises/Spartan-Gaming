import '../pwa/register.mjs';
import {detectInputCapabilities, inspectGamepad, listApprovedHidDevices, resolveControllerPreferences} from './inspector.mjs';
import {createSettingsStore} from '../settings/profile.mjs';

const devicesElement = document.querySelector('[data-devices]');
const selectedElement = document.querySelector('[data-selected]');
const liveElement = document.querySelector('[data-live]');
const axesElement = document.querySelector('[data-axes]');
const buttonsElement = document.querySelector('[data-buttons]');
const detailsElement = document.querySelector('[data-details]');
const capabilityElement = document.querySelector('[data-capabilities]');
const hidList = document.querySelector('[data-hid-list]');
const noticeElement = document.querySelector('[data-notice]');
const controllerPreferences = resolveControllerPreferences(createSettingsStore().read());
let selectedIndex = null;
let noticeTimer;

function showNotice(message) { noticeElement.textContent = message; noticeElement.classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => noticeElement.classList.remove('visible'), 2300); }
function gamepads() { return [...(navigator.getGamepads?.() || [])].filter(Boolean); }
function renderCapabilities() { const capabilities = detectInputCapabilities(); capabilityElement.innerHTML = Object.entries(capabilities).map(([name, supported]) => `<span class="capability"><strong>${supported ? '✓' : '—'}</strong> ${name}</span>`).join(''); }
function renderDevices() { const list = gamepads(); if (selectedIndex === null && list[0]) selectedIndex = list[0].index; if (!list.length) { devicesElement.className = 'empty'; devicesElement.textContent = 'No gamepads detected. Connect one and press a button to wake it.'; return; } devicesElement.className = ''; devicesElement.innerHTML = list.map(gamepad => `<button class="device ${gamepad.index === selectedIndex ? 'active' : ''}" data-device="${gamepad.index}"><strong>${String(gamepad.id || 'Unknown controller').replace(/[<>]/g, '')}</strong><small>Index ${gamepad.index} · ${gamepad.mapping || 'unmapped'} mapping</small></button>`).join(''); }
function renderSnapshot() { const gamepad = gamepads().find(item => item.index === selectedIndex); if (!gamepad) { selectedElement.textContent = 'No controller selected'; liveElement.textContent = 'WAITING'; liveElement.classList.remove('active'); axesElement.innerHTML = ''; buttonsElement.innerHTML = ''; detailsElement.innerHTML = ''; return; } const snapshot = inspectGamepad(gamepad); selectedElement.textContent = snapshot.id; liveElement.textContent = 'LIVE'; liveElement.classList.add('active'); axesElement.innerHTML = snapshot.axes.map((value, index) => `<div class="axis"><div class="axis-head"><span>Axis ${index}</span><strong>${value.toFixed(2)}</strong></div><div class="bar"><div class="fill" style="width:${Math.abs(value) * 100}%;transform:translateX(${value < 0 ? '-100%' : '0'})"></div></div></div>`).join(''); buttonsElement.innerHTML = snapshot.buttons.map((button, index) => `<div class="button-state ${button.pressed ? 'pressed' : ''}">${index}<br>${button.value.toFixed(1)}</div>`).join(''); detailsElement.innerHTML = `<div><dt>Mapping</dt><dd>${snapshot.mapping}</dd></div><div><dt>Haptics</dt><dd>${snapshot.haptics ? 'Available' : 'Unavailable'}</dd></div><div><dt>Battery</dt><dd>${snapshot.batteryLevel === null ? 'Unknown' : `${Math.round(snapshot.batteryLevel * 100)}%`}</dd></div>`; }
async function renderHid() { if (!controllerPreferences.allowHid) { hidList.className = 'empty'; hidList.textContent = 'HID access is disabled in Controller settings.'; return; } try { const devices = await listApprovedHidDevices(); hidList.className = devices.length ? '' : 'empty'; hidList.innerHTML = devices.length ? devices.map(device => `<div class="device"><strong>${device.productName}</strong><small>Vendor ${device.vendorId} · Product ${device.productId} · ${device.opened ? 'Open' : 'Closed'}</small></div>`).join('') : 'No approved HID devices.'; } catch (error) { hidList.className = 'empty'; hidList.textContent = error.message; } }
document.addEventListener('click', event => { const device = event.target.closest('[data-device]'); if (device) { selectedIndex = Number(device.dataset.device); renderDevices(); renderSnapshot(); } });
document.querySelector('[data-refresh]').addEventListener('click', () => { renderDevices(); renderSnapshot(); showNotice('Controller list refreshed'); });
document.querySelector('[data-hid]').addEventListener('click', renderHid);
window.addEventListener('gamepadconnected', event => { selectedIndex = event.gamepad.index; renderDevices(); showNotice('Controller connected'); });
window.addEventListener('gamepaddisconnected', event => { if (selectedIndex === event.gamepad.index) selectedIndex = null; renderDevices(); renderSnapshot(); showNotice('Controller disconnected'); });
renderCapabilities(); renderDevices(); renderSnapshot(); renderHid(); setInterval(() => { renderDevices(); renderSnapshot(); }, 100);
