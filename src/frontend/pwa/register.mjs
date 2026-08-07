import {createSettingsStore} from '../settings/profile.mjs';
import {applyRuntimeUiSettings} from '../settings/runtime-ui.mjs';

const manifestUrl = new URL('./manifest.webmanifest', import.meta.url);
if (typeof document !== 'undefined') {
  try { applyRuntimeUiSettings(document, createSettingsStore().read()); } catch { applyRuntimeUiSettings(document); }
  if (!document.querySelector('link[rel="manifest"]')) { const link = document.createElement('link'); link.rel = 'manifest'; link.href = manifestUrl.href; document.head.append(link); }
  if (location.protocol === 'http:' || location.protocol === 'https:') navigator.serviceWorker?.register(new URL('./service-worker.mjs', import.meta.url), {scope: new URL('../', import.meta.url).pathname}).catch(() => {});
}
