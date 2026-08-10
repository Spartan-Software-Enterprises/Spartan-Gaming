import assert from 'node:assert/strict';
import test from 'node:test';
import {canUseMediaSession, createMediaSessionController} from './media-session.mjs';

function fakeVideo() {
  const listeners = new Map();
  return {currentTime: 30, duration: 120, addEventListener(type, handler) { listeners.set(type, handler); }, removeEventListener(type) { listeners.delete(type); }, play() { this.played = true; listeners.get('play')?.(); }, pause() { this.paused = true; listeners.get('pause')?.(); }, emit(type) { listeners.get(type)?.(); }};
}

test('Media Session controller exposes metadata and safe transport actions', async () => {
  const actions = new Map(); const mediaSession = {playbackState: 'none', setActionHandler(action, handler) { actions.set(action, handler); }}; const metadata = [];
  class Metadata { constructor(value) { metadata.push(value); Object.assign(this, value); } }
  const video = fakeVideo(); const controller = createMediaSessionController({navigatorRef: {mediaSession}, metadataFactory: Metadata, video});
  assert.equal(controller.supported, true); controller.update({title: 'Forza Horizon 5', artist: 'Spartan Gaming'}); assert.deepEqual(metadata[0], {title: 'Forza Horizon 5', artist: 'Spartan Gaming', album: 'Game session'});
  await actions.get('play')(); assert.equal(video.played, true); assert.equal(mediaSession.playbackState, 'playing'); actions.get('seekbackward')({seekOffset: 5}); assert.equal(video.currentTime, 25); actions.get('seekforward')({seekOffset: 8}); assert.equal(video.currentTime, 33); actions.get('stop')(); assert.equal(video.currentTime, 0); assert.equal(mediaSession.playbackState, 'paused'); controller.dispose(); assert.equal(mediaSession.playbackState, 'none');
});

test('Media Session gracefully degrades when the browser has no API', () => { const video = fakeVideo(); assert.equal(canUseMediaSession({}), false); const controller = createMediaSessionController({navigatorRef: {}, video}); assert.equal(controller.supported, false); controller.update({title: 'ignored'}); controller.dispose(); });
