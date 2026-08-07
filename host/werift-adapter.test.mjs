import assert from 'node:assert/strict';
import test from 'node:test';
import {createWeriftVideoTransport, loadWerift} from './werift-adapter.mjs';

function fakeWerift() {
  class Track { constructor(options) { this.options = options; this.packets = []; } writeRtp(packet) { this.packets.push(packet); } stop() { this.stopped = true; } }
  class Peer { constructor(config) { this.config = config; this.tracks = []; } addTrack(track) { this.tracks.push(track); return {track}; } close() { this.closed = true; } }
  return {RTCPeerConnection: Peer, MediaStreamTrack: Track, useH264: () => ({mimeType: 'video/H264'})};
}

test('Werift adapter creates a video track and forwards RTP packets', () => { const module = fakeWerift(); const adapter = createWeriftVideoTransport({module, peerConfig: {iceServers: []}, ssrc: 42}); const packet = {header: {timestamp: 10}, payload: Buffer.from('frame')}; adapter.transport.send(packet); assert.equal(adapter.track.options.kind, 'video'); assert.equal(adapter.track.options.ssrc, 42); assert.deepEqual(adapter.track.packets, [packet]); assert.equal(adapter.sender.track, adapter.track); adapter.close(); assert.equal(adapter.track.stopped, true); assert.equal(adapter.peer.closed, true); assert.throws(() => adapter.transport.send(packet), /closed/); });
test('Werift loader is optional and preserves the injected package boundary', async () => { const module = await loadWerift({loader: async name => { assert.equal(name, 'werift'); return {ready: true}; }}); assert.equal(module.ready, true); });
