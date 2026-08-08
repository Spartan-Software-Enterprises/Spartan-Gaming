const RECORDING_MIME_TYPES = Object.freeze(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']);

export function supportedRecordingMimeTypes({MediaRecorderImpl = globalThis.MediaRecorder} = {}) { return RECORDING_MIME_TYPES.filter(type => MediaRecorderImpl?.isTypeSupported?.(type)); }

export function captureVideoFrame(video, {documentLike = globalThis.document, type = 'image/png', quality} = {}) {
  if (!video || !documentLike?.createElement) return Promise.reject(new TypeError('video and document are required'));
  const width = video.videoWidth || video.clientWidth; const height = video.videoHeight || video.clientHeight; if (!width || !height) return Promise.reject(new Error('video has no drawable frame')); const canvas = documentLike.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d'); if (!context?.drawImage) return Promise.reject(new Error('canvas capture is unavailable')); context.drawImage(video, 0, 0, width, height); return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('screenshot encoding failed')), type, quality));
}

export function createRecordingController({stream, MediaRecorderImpl = globalThis.MediaRecorder, mimeTypes = RECORDING_MIME_TYPES} = {}) {
  if (!stream) throw new TypeError('a MediaStream is required for recording'); if (typeof MediaRecorderImpl !== 'function') throw new Error('MediaRecorder is unavailable in this browser');
  const mimeType = mimeTypes.find(type => MediaRecorderImpl.isTypeSupported?.(type)) || ''; let recorder = null; let chunks = []; let state = 'idle'; let result = null;
  return {
    get state() { return state; }, get mimeType() { return mimeType; }, get blob() { return result; },
    start() { if (state === 'recording') throw new Error('recording is already active'); chunks = []; result = null; recorder = new MediaRecorderImpl(stream, mimeType ? {mimeType} : undefined); state = 'recording'; recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); }; recorder.onerror = () => { state = 'error'; }; recorder.start(); },
    stop() { if (state !== 'recording' || !recorder) return Promise.resolve(result); state = 'stopping'; return new Promise((resolve, reject) => { recorder.onstop = () => { result = new Blob(chunks, {type: mimeType || 'video/webm'}); state = 'stopped'; resolve(result); }; recorder.onerror = error => { state = 'error'; reject(error instanceof Error ? error : new Error('recording failed')); }; recorder.stop(); }); },
  };
}

export function createInstantReplayController({stream, durationSeconds = 30, MediaRecorderImpl = globalThis.MediaRecorder, mimeTypes = RECORDING_MIME_TYPES} = {}) {
  if (!stream) throw new TypeError('a MediaStream is required for instant replay');
  if (typeof MediaRecorderImpl !== 'function') throw new Error('MediaRecorder is unavailable in this browser');
  const mimeType = mimeTypes.find(type => MediaRecorderImpl.isTypeSupported?.(type)) || '';
  const maxChunks = Math.max(15, Math.min(120, Math.round(Number(durationSeconds) || 30))) + 1;
  let recorder = null; let chunks = []; let state = 'idle'; let error = null;
  const result = () => chunks.length ? new Blob(chunks, {type: mimeType || 'video/webm'}) : null;
  return {
    get state() { return state; }, get mimeType() { return mimeType; }, get error() { return error; }, get bufferedChunks() { return chunks.length; },
    start() {
      if (state === 'recording') return this;
      chunks = []; error = null; recorder = new MediaRecorderImpl(stream, mimeType ? {mimeType} : undefined);
      recorder.ondataavailable = event => { if (event.data?.size) { chunks.push(event.data); while (chunks.length > maxChunks) chunks.shift(); } };
      recorder.onerror = event => { error = event instanceof Error ? event : new Error('instant replay recording failed'); state = 'error'; };
      recorder.start(1000); state = 'recording'; return this;
    },
    clip() { if (state !== 'recording') throw new Error('instant replay is not recording'); const blob = result(); if (!blob) throw new Error('instant replay buffer is empty'); return blob; },
    stop() { if (recorder && state === 'recording') recorder.stop?.(); state = state === 'error' ? state : 'stopped'; return result(); },
  };
}
