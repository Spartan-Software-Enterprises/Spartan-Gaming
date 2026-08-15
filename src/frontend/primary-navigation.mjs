const ROUTES = Object.freeze({
  library: '../dashboard/index.html',
  providers: '../providers/index.html',
  emulation: '../emulation/index.html',
  watch: '../watch/index.html',
  social: '../social/index.html',
  multiplayer: '../multiplayer/index.html',
});

export function bindPrimaryNavigation(
  documentRef = globalThis.document,
  locationRef = globalThis.location,
) {
  documentRef?.querySelectorAll('[data-section]').forEach((button) => {
    button.addEventListener('click', () => {
      const href = ROUTES[button.dataset.section];
      if (href) locationRef.assign(href);
    });
  });
}
