// Shared console-mode initializer: loads the Xbox-style console-mode CSS and
// applies the console-mode class to the body. Import this from any page that
// should always display in full-time console mode.
if (typeof document === 'undefined' || typeof location === 'undefined') {
  // Node.js / test environment — skip DOM operations.
} else {
  const cssPath = (() => {
    const depth = (location.pathname.match(/\//g) || []).length;
    const prefix = depth > 2 ? '../..' : '..';
    if (location.pathname.includes('/player/')) return `${prefix}/player/player-console-mode.css`;
    return `${prefix}/dashboard/console-mode.css`;
  })();

  document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${cssPath}">`);
  document.body.classList.add('console-mode');
}
