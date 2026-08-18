import '../pwa/register.mjs';
import '../console-mode-init.mjs';
import { collectCapabilities, redactDiagnostics } from './capabilities.mjs';
import { collectPermissionStates, collectPerformanceSnapshot } from './focus.mjs';

let report = null;
const capabilityContainer = document.querySelector('[data-capabilities]');
const recommendationContainer = document.querySelector('[data-recommendation-list]');
const focus = new URLSearchParams(globalThis.location?.search || '').get('focus');
const labels = {
  transports: { webrtc: 'WebRTC', webtransport: 'WebTransport', websocket: 'WebSocket' },
  graphics: {
    webgpu: 'WebGPU',
    webgpuAdapter: 'WebGPU adapter',
    webgl: 'WebGL',
    hdr: 'HDR output',
  },
  input: { gamepad: 'Gamepad API', hid: 'WebHID' },
  media: { hardwareDecodeApi: 'Hardware decode API', mediaDevices: 'Media devices' },
  codecs: { h264: 'H.264', vp9: 'VP9', av1: 'AV1', opus: 'Opus' },
};
function flattenCapabilities(value) {
  const cards = [];
  for (const group of ['transports', 'graphics', 'input'])
    for (const [key, status] of Object.entries(value[group] || {}))
      cards.push({
        group,
        key,
        label: labels[group]?.[key] || key,
        status: typeof status === 'boolean' ? status : null,
      });
  const display = value.display || {};
  if (Number.isFinite(display.count))
    cards.push({
      group: 'display',
      key: 'display-count',
      label: 'Displays detected',
      status: display.count > 0,
      message: `${display.count} display${display.count === 1 ? '' : 's'} available`,
    });
  if (typeof display.extended === 'boolean')
    cards.push({
      group: 'display',
      key: 'extended-display',
      label: 'Extended display',
      status: display.extended,
      message: display.extended
        ? 'Multi-monitor surface detected'
        : 'Single display surface detected',
    });
  if (display.maxRefreshRate)
    cards.push({
      group: 'display',
      key: 'refresh-ceiling',
      label: 'Refresh ceiling',
      status: true,
      message: `Observed up to ${display.maxRefreshRate} Hz`,
    });
  for (const [key, status] of Object.entries(value.media || {})) {
    if (key === 'codecs')
      for (const [codec, supported] of Object.entries(status))
        cards.push({
          group: 'codecs',
          key: codec,
          label: labels.codecs[codec] || codec,
          status: Boolean(supported),
        });
    else if (key === 'hardwareDecode')
      for (const [codec, result] of Object.entries(status))
        cards.push({
          group: 'hardware decode',
          key: `hardware-${codec}`,
          label: `${labels.codecs[codec] || codec} hardware decode`,
          status: result.powerEfficient ? true : result.supported ? null : false,
        });
    else
      cards.push({
        group: 'media',
        key,
        label: labels.media?.[key] || key,
        status: typeof status === 'boolean' ? status : null,
      });
  }
  return cards;
}
function render() {
  const capabilities = flattenCapabilities(report);
  capabilityContainer.innerHTML = capabilities
    .map((item) => {
      const optional =
        [
          'webtransport',
          'webgpuAdapter',
          'hid',
          'hardwareDecodeApi',
          'mediaDevices',
          'av1',
          'vp9',
          'opus',
          'extended-display',
          'refresh-ceiling',
        ].includes(item.key) || item.group === 'hardware decode';
      const statusClass =
        item.status === false ? (optional ? 'warn' : 'bad') : item.status === null ? 'warn' : '';
      const message =
        item.message ||
        (item.status === null
          ? 'Supported; efficiency unknown'
          : item.status
            ? 'Detected and available'
            : 'Not detected');
      return `<article class="cap-card"><div><h3>${item.label}</h3><p>${item.group.toUpperCase()} · ${message}</p></div><span class="cap-status ${statusClass}">${item.status === false ? '!' : item.status === null ? '—' : '✓'}</span></article>`;
    })
    .join('');
  recommendationContainer.innerHTML = report.recommendations.length
    ? report.recommendations
        .map(
          (item) =>
            `<div class="recommendation"><strong class="${item.severity}">${item.severity}</strong><span>${item.message}</span></div>`,
        )
        .join('')
    : '<div class="recommendation"><strong class="info">Ready</strong><span>No compatibility warnings were detected.</span></div>';
  const errors = report.recommendations.filter((item) => item.severity === 'error').length;
  const warnings = report.recommendations.filter((item) => item.severity === 'warning').length;
  document.querySelector('[data-summary-title]').textContent = errors
    ? `${errors} blocking issue${errors === 1 ? '' : 's'} detected`
    : warnings
      ? `${warnings} compatibility note${warnings === 1 ? '' : 's'}`
      : 'Ready for compatible sessions';
  document.querySelector('[data-summary-copy]').textContent =
    `${report.browser.engine} · ${report.browser.platform} · checked ${new Date(report.collectedAt).toLocaleTimeString()}`;
}
function formatMetric(value, suffix = '') {
  return value === null || value === undefined ? 'Unavailable' : `${value}${suffix}`;
}
async function renderFocus() {
  if (!['permissions', 'performance'].includes(focus)) return;
  document.querySelector('[data-focus-panel]')?.remove();
  const panel = document.createElement('section');
  panel.className = 'recommendations';
  panel.setAttribute('data-focus-panel', '');
  const content = document.createElement('div');
  content.className = 'capability-grid';
  panel.innerHTML = `<p class="eyebrow">${focus === 'permissions' ? 'PERMISSION REVIEW' : 'PERFORMANCE SNAPSHOT'}</p><h2>${focus === 'permissions' ? 'Browser permission state' : 'Runtime performance signals'}</h2><p class="privacy-note">Read-only local inspection. Spartan Gaming does not request or grant permissions from this view.</p>`;
  panel.append(content);
  capabilityContainer.before(panel);
  if (focus === 'permissions') {
    const states = await collectPermissionStates();
    content.innerHTML = states
      .map(
        (item) =>
          `<article class="cap-card"><div><h3>${item.label}</h3><p>Permission API · ${item.state}</p></div><span class="cap-status ${item.state === 'denied' ? 'bad' : item.state === 'unavailable' ? 'warn' : ''}">${item.state === 'granted' ? '✓' : item.state === 'denied' ? '!' : '—'}</span></article>`,
      )
      .join('');
    return;
  }
  const snapshot = collectPerformanceSnapshot();
  const metrics = [
    ['Logical processors', formatMetric(snapshot.logicalProcessors)],
    ['Device memory', formatMetric(snapshot.memoryGb, ' GB')],
    ['Network type', formatMetric(snapshot.effectiveType)],
    ['Downlink estimate', formatMetric(snapshot.downlinkMbps, ' Mbps')],
    ['Network RTT', formatMetric(snapshot.networkRttMs, ' ms')],
    [
      'JS heap',
      snapshot.jsHeapUsedMb === null
        ? 'Unavailable'
        : `${snapshot.jsHeapUsedMb} / ${snapshot.jsHeapLimitMb ?? '?'} MB`,
    ],
  ];
  content.innerHTML = metrics
    .map(
      ([label, value]) =>
        `<article class="cap-card"><div><h3>${label}</h3><p>Browser-provided estimate</p></div><span class="cap-status">${value}</span></article>`,
    )
    .join('');
}
async function run() {
  document.querySelector('[data-summary-title]').textContent = 'Checking capabilities…';
  report = await collectCapabilities();
  render();
  await renderFocus();
}
document.querySelector('[data-run]').addEventListener('click', run);
document.querySelector('[data-export]').addEventListener('click', () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(redactDiagnostics(report), null, 2)], {
    type: 'application/json',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'spartan-gaming-diagnostics.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
run();
