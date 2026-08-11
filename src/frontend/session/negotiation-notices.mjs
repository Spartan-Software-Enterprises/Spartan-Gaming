function positive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
}

export function describeNegotiationAdjustments({ requested = {}, negotiated = {} } = {}) {
  const items = [];
  const requestedVideo = requested.video || {};
  const negotiatedVideo = negotiated.video || {};
  const requestedAudio = requested.audio || {};
  const negotiatedAudio = negotiated.audio || {};
  const requestedInput = requested.input || {};
  const negotiatedInput = negotiated.input || {};
  if (
    requested.transports?.[0] &&
    negotiated.transports?.[0] &&
    requested.transports[0] !== negotiated.transports[0]
  )
    items.push(`transport ${negotiated.transports[0]}`);
  const requestedCodec = requestedVideo.codecs?.[0] || requestedVideo.codec;
  if (requestedCodec && negotiatedVideo.codec && requestedCodec !== negotiatedVideo.codec)
    items.push(`codec ${negotiatedVideo.codec.toUpperCase()}`);
  const requestedWidth = positive(requestedVideo.maxWidth);
  const negotiatedWidth = positive(negotiatedVideo.maxWidth);
  const requestedHeight = positive(requestedVideo.maxHeight);
  const negotiatedHeight = positive(negotiatedVideo.maxHeight);
  if (
    requestedWidth &&
    negotiatedWidth &&
    requestedHeight &&
    negotiatedHeight &&
    (negotiatedWidth < requestedWidth || negotiatedHeight < requestedHeight)
  )
    items.push(`resolution ${negotiatedWidth}×${negotiatedHeight}`);
  const requestedFramerate = positive(requestedVideo.maxFramerate);
  const negotiatedFramerate = positive(negotiatedVideo.maxFramerate);
  if (requestedFramerate && negotiatedFramerate && negotiatedFramerate < requestedFramerate)
    items.push(`${negotiatedFramerate} FPS`);
  if (requestedVideo.hdr === true && negotiatedVideo.hdr === false) items.push('HDR disabled');
  const requestedChannels = positive(requestedAudio.channels);
  const negotiatedChannels = positive(negotiatedAudio.channels);
  if (requestedChannels && negotiatedChannels && negotiatedChannels < requestedChannels)
    items.push(`${negotiatedChannels}-channel audio`);
  if (
    requestedInput.virtualGamepadBackend &&
    requestedInput.virtualGamepadBackend !== 'Automatic' &&
    negotiatedInput.virtualGamepadBackend === 'Automatic'
  )
    items.push('virtual gamepad driver unavailable');
  if (
    requestedInput.hapticsBackend &&
    requestedInput.hapticsBackend !== 'Automatic' &&
    negotiatedInput.hapticsBackend === 'Automatic'
  )
    items.push('haptics backend unavailable');
  return Object.freeze(items);
}

export function formatNegotiationAdjustments(items = []) {
  return Array.isArray(items) && items.length
    ? `Session adjusted for host limits: ${items.join(' · ')}.`
    : '';
}
