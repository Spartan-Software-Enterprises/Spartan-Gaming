import { createSettingsStore } from '../settings/profile.mjs';
import { applyRuntimeUiSettings } from '../settings/runtime-ui.mjs';
import { syncRuntimeControllerNavigation } from '../input/navigation.mjs';
import { createPwaInstallController } from './install.mjs';

const manifestUrl = new URL('./manifest.webmanifest', import.meta.url);
if (typeof document !== 'undefined') {
  try {
    applyRuntimeUiSettings(document, createSettingsStore().read());
  } catch {
    applyRuntimeUiSettings(document);
  }
  syncRuntimeControllerNavigation(document);
  if (globalThis.spartanElectron?.isElectron !== true) {
    const installButton = document.createElement('button');
    installButton.type = 'button';
    installButton.hidden = true;
    installButton.textContent = 'Install Spartan Gaming';
    installButton.setAttribute('aria-label', 'Install Spartan Gaming');
    installButton.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:1000;padding:10px 13px;border:1px solid #50e1d1;border-radius:8px;background:#101a20;color:#d8fff8;font:700 12px system-ui;box-shadow:0 8px 24px #0008;cursor:pointer';
    document.body.append(installButton);
    const installController = createPwaInstallController({
      windowRef: globalThis,
      onState: (state) => {
        installButton.hidden = state !== 'available';
      },
    });
    installButton.addEventListener('click', async () => {
      const result = await installController.prompt();
      if (result.status !== 'accepted') installButton.hidden = true;
    });
    globalThis.spartanPwaInstall = installController;
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = manifestUrl.href;
      document.head.append(link);
    }
    if (location.protocol === 'http:' || location.protocol === 'https:')
      navigator.serviceWorker
        ?.register(new URL('../service-worker.mjs', import.meta.url), {
          scope: new URL('../', import.meta.url).pathname,
          type: 'module',
        })
        .catch(() => {});
  }
}
