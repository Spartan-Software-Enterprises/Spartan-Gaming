import '../pwa/register.mjs';
import {createEmulationLaunchPlan, createUserFileRecord, formatFileSize} from './emulation.mjs';
import {createEmulatorIntegration, emulatorTroubleshooting} from './integration.mjs';

const state = {cores: [], gameFiles: [], firmwareFiles: []};
const coreList = document.querySelector('[data-core-list]');
const fileList = document.querySelector('[data-file-list]');
const notice = document.querySelector('[data-notice]');
function toast(message) { notice.textContent = message; notice.classList.add('visible'); setTimeout(() => notice.classList.remove('visible'), 2500); }
function allFiles() { return [...state.gameFiles, ...state.firmwareFiles]; }
function renderFiles() { const files = allFiles(); document.querySelector('[data-file-count]').textContent = `${files.length} file${files.length === 1 ? '' : 's'}`; fileList.innerHTML = files.length ? files.map(file => `<div class="file-entry"><strong>${file.name}</strong><small>${file.kind} · ${formatFileSize(file.size)}</small></div>`).join('') : '<p class="empty">No files selected. Your files stay local to this browser.</p>'; }
function renderCores() { document.querySelector('[data-core-count]').textContent = `${state.cores.length} runtimes`; coreList.innerHTML = state.cores.map(core => { const integration = createEmulatorIntegration(core); const issues = emulatorTroubleshooting(integration); return `<article class="core-card"><h3>${core.name}</h3><p>${integration.runtime} · ${integration.renderer}</p><div class="core-tags">${core.systems.map(system => `<span class="tag">${system}</span>`).join('')}${integration.features.slice(0, 2).map(feature => `<span class="tag">${feature}</span>`).join('')}</div><small class="core-note">${issues[0]?.message || integration.notes[0] || 'User-selected files only'}</small><button class="launch" data-launch="${core.id}" ${state.gameFiles.length ? '' : 'disabled'}>Prepare launch plan</button></article>`; }).join(''); coreList.querySelectorAll('[data-launch]').forEach(button => button.addEventListener('click', () => { const core = state.cores.find(item => item.id === button.dataset.launch); try { const plan = createEmulationLaunchPlan({core, gameFile: state.gameFiles[0], firmwareFiles: state.firmwareFiles}); toast(`${core.name}: ${plan.integration.runtime} · ${plan.integration.renderer} plan ready for ${plan.files.length} user-selected file${plan.files.length === 1 ? '' : 's'}.`); } catch (error) { toast(error.message); } })); }
async function loadCores() { try { const manifest = await fetch('../../../emulators/catalog.json').then(response => response.json()); state.cores = manifest.projects; renderCores(); } catch { coreList.innerHTML = '<p class="empty">The emulator catalog could not be loaded.</p>'; } }
function addFiles(files, kind) { const records = [...files].map(file => createUserFileRecord(file, {kind})); if (kind === 'game') state.gameFiles.push(...records); else state.firmwareFiles.push(...records); renderFiles(); renderCores(); toast(`${records.length} user-selected ${kind} file${records.length === 1 ? '' : 's'} added.`); }
document.querySelector('[data-game-files]').addEventListener('change', event => addFiles(event.target.files, 'game'));
document.querySelector('[data-firmware-files]').addEventListener('change', event => addFiles(event.target.files, 'firmware'));
loadCores();
renderFiles();
