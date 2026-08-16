// Keep every route inside the physical viewport when its content cannot be
// reduced further by the route-specific responsive rules.
const root = document.documentElement;
const body = document.body;
let fitting = false;

function fitViewport() {
  if (fitting || !body) return;
  fitting = true;
  body.style.zoom = '';
  body.style.height = '';
  const width = Math.max(body.scrollWidth, root.scrollWidth, 1);
  const height = Math.max(body.scrollHeight, root.scrollHeight, 1);
  const scale = Math.min(1, innerWidth / width, innerHeight / height);
  body.style.zoom = String(Math.max(scale, 0.01));
  body.style.height = `${100 / Math.max(scale, 0.01)}dvh`;
  root.dataset.viewportScale = scale.toFixed(3);
  fitting = false;
}

new ResizeObserver(fitViewport).observe(body);
new MutationObserver(fitViewport).observe(body, { childList: true, subtree: true });
addEventListener('resize', fitViewport, { passive: true });
addEventListener('load', fitViewport, { once: true });
requestAnimationFrame(fitViewport);
