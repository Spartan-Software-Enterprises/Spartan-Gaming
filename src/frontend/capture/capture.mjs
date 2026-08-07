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
