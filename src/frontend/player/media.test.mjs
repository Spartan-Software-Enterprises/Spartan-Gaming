import assert from 'node:assert/strict';
import test from 'node:test';
import {applyCaptionPreference, attachMediaStreamTarget, canUsePictureInPicture, describeMediaStream, normalizeCaptionPreference, observeMediaStream, setMediaAudioEnabled, togglePictureInPicture} from './media.mjs';

const stream = {getTracks: () => [{kind: 'video'}, {kind: 'audio'}]};

test('media coordinator describes and attaches audio/video tracks', () => {
  assert.deepEqual(describeMediaStream(stream), {videoTracks: 1, audioTracks: 1, hasVideo: true, hasAudio: true});
  const video = {};
  const state = attachMediaStreamTarget({video, stream});
  assert.equal(video.srcObject, stream);
  assert.equal(video.playsInline, true);
  assert.equal(video.muted, false);
  assert.equal(state.hasAudio, true);
});

test('media coordinator toggles audio without changing the media stream', () => {
  const video = {srcObject: stream, muted: false};
  assert.equal(setMediaAudioEnabled(video, false), false);
  assert.equal(video.muted, true);
  assert.equal(setMediaAudioEnabled(video, true), true);
  assert.equal(video.srcObject, stream);
});

test('media coordinator gates and toggles Picture-in-Picture', async () => {
  const documentRef = {pictureInPictureEnabled: true, pictureInPictureElement: null, async exitPictureInPicture() { this.pictureInPictureElement = null; }};
  const video = {requestPictureInPicture: async () => { documentRef.pictureInPictureElement = video; }};
  assert.equal(canUsePictureInPicture(video, documentRef), true);
  assert.equal(await togglePictureInPicture(video, documentRef), true);
  assert.equal(await togglePictureInPicture(video, documentRef), false);
  assert.equal(canUsePictureInPicture({}, documentRef), false);
  await assert.rejects(() => togglePictureInPicture({}, documentRef), /unavailable/);
});

test('media coordinator tracks dynamic add/remove events', () => {
  const listeners = new Map();
  const tracks = [{kind: 'video'}];
  const dynamicStream = {
    getTracks: () => tracks,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const states = [];
  const observer = observeMediaStream(dynamicStream, state => states.push(state));
  assert.equal(states.at(-1).hasAudio, false);
  tracks.push({kind: 'audio'});
  listeners.get('addtrack')();
  assert.equal(states.at(-1).hasAudio, true);
  observer.disconnect();
  assert.equal(listeners.size, 0);
});

test('media coordinator rejects missing targets and streams', () => {
  assert.throws(() => attachMediaStreamTarget({video: {}, stream: {}}), /MediaStream/);
  assert.throws(() => setMediaAudioEnabled(null, true), /video target/);
  assert.throws(() => observeMediaStream(stream, null), /onChange/);
});

test('caption preferences select one matching text track and fail safely without tracks', () => {
  assert.deepEqual(normalizeCaptionPreference({mode: 'On', language: 'Spanish'}), {mode: 'On', language: 'Spanish'});
  const tracks = [{kind: 'captions', language: 'en', default: true, mode: 'disabled'}, {kind: 'subtitles', language: 'es', mode: 'disabled'}];
  const video = {textTracks: tracks};
  assert.deepEqual(applyCaptionPreference(video, {mode: 'On', language: 'Spanish'}), {supported: true, active: 'es', preference: {mode: 'On', language: 'Spanish'}});
  assert.equal(tracks[0].mode, 'disabled'); assert.equal(tracks[1].mode, 'showing');
  assert.equal(applyCaptionPreference({}, {mode: 'On'}).supported, false);
});
