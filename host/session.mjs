import { negotiateCapabilities } from '../src/frontend/session/session.mjs';

function advertised(result) {
  return {
    transports: [...result.transports],
    video: {
      codecs: [result.video.codec],
      maxWidth: result.video.maxWidth,
      maxHeight: result.video.maxHeight,
      maxFramerate: result.video.maxFramerate,
      hdr: result.video.hdr,
    },
    audio: { codecs: [result.audio.codec], channels: result.audio.channels },
    input: { ...result.input },
  };
}

export function negotiateHostOffer({ offer, hostCapabilities } = {}) {
  try {
    const result = negotiateCapabilities(offer, hostCapabilities);
    return Object.freeze({
      accepted: true,
      capabilities: Object.freeze(advertised(result)),
      negotiated: result,
    });
  } catch (error) {
    return Object.freeze({
      accepted: false,
      reason: error instanceof Error ? error.message : 'Host cannot satisfy session offer',
    });
  }
}
