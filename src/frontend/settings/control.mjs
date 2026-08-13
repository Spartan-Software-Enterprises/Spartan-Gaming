export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

export function renderSettingControl(setting, value) {
  const key = escapeHtml(setting.key);
  if (setting.type === 'toggle')
    return `<button class="toggle ${value ? 'is-on' : ''}" role="switch" aria-checked="${Boolean(value)}" data-key="${key}"><span></span><b>${value ? 'On' : 'Off'}</b></button>`;
  if (setting.type === 'select')
    return `<select data-key="${key}">${setting.options.map((option) => `<option value="${escapeHtml(option)}"${option === value ? ' selected' : ''}>${escapeHtml(setting.optionLabels?.[option] || option)}</option>`).join('')}</select>`;
  if (setting.type === 'range')
    return `<div class="range-control"><input type="range" min="${escapeHtml(setting.min)}" max="${escapeHtml(setting.max)}" step="${escapeHtml(setting.step)}" value="${escapeHtml(value)}" data-key="${key}"><output>${escapeHtml(value)}${escapeHtml(setting.unit)}</output></div>`;
  if (setting.type === 'text' || setting.type === 'secret')
    return `<input class="text-input" type="${setting.type === 'secret' ? 'password' : 'text'}" value="${escapeHtml(value)}" placeholder="Not configured" autocomplete="${setting.type === 'secret' ? 'new-password' : 'off'}" data-key="${key}">`;
  return `<button class="action-button" data-action="${key}">${escapeHtml(setting.actionLabel)}</button>`;
}
