import assert from 'node:assert/strict';
import test from 'node:test';
import {attachMediaStreamTarget, describeMediaStream, observeMediaStream, setMediaAudioEnabled} from './media.mjs';

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
