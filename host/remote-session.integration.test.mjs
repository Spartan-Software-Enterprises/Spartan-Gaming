import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createSessionEnvelope } from '../src/frontend/session/session.mjs';
import { loadWerift } from './werift-adapter.mjs';
import { createNativeWeriftHost } from './native-host.mjs';
import { createRtpPacketizer } from './rtp-packetizer.mjs';
import { createNativeMediaPipeline } from './native-media.mjs';
import { createEncoderPlan } from './media.mjs';
import { createProcessLaunchPlan } from './adapters.mjs';

let werift = null;
try {
  werift = await loadWerift();
} catch {
  werift = null;
}
const weriftAvailable = Boolean(werift?.RTCPeerConnection);
const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

const LOOPBACK_CONFIG = Object.freeze({ iceServers: [], iceUseIpv6: false, iceUseTcp: true });
function opusFactory() {
  return (werift.useOPUS || werift.useOpus)?.() || undefined;
}
const VIDEO_CHUNK = Buffer.concat([
  Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0xc0, 0x1e, 0xd9, 0x01, 0x40, 0x7c, 0x0f, 0x88, 0x80]),
  Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x3c, 0x80]),
  Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x02, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]),
]);
const OPUS_FRAME = Buffer.from([0xf8, 0xff, 0xfe, 0x00, 0x00, 0x00, 0x00, 0x00]);

function inMemorySignaling() {
  let handler = null;
  return {
    sent: [],
    on(type, fn) {
      if (type === 'message') handler = fn;
      return () => {
        if (handler === fn) handler = null;
      };
    },
    async connect() {},
    send(message) {
      this.sent.push(message);
    },
    receive(message) {
      if (handler) void handler(message);
    },
    close() {
      handler = null;
    },
  };
}

function waitFor(check, timeoutMs = 15_000, label = 'condition') {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`timed out waiting for ${label}`));
      }
    }, 40);
  });
}

function fakeMediaPipeline() {
  const videoOutput = new EventEmitter();
  const audioOutput = new EventEmitter();
  let running = false;
  return {
    videoOutput,
    audioOutput,
    get state() {
      return running ? 'running' : 'idle';
    },
    async start() {
      running = true;
    },
    async stop() {
      running = false;
    },
  };
}

test(
  'remote session streams H.264 video and Opus audio over a real Werift loopback',
  { skip: !weriftAvailable },
  async () => {
    const sessionId = 'ses-remote-loopback';
    const hostSignaling = inMemorySignaling();
    const clientMessages = [];
    const hostErrors = [];
    const clientErrors = [];
    const inputCalls = [];
    const qualityResults = [];
    const pipeline = fakeMediaPipeline();
    const host = createNativeWeriftHost({
      signaling: hostSignaling,
      module: werift,
      pipeline,
      packetizer: createRtpPacketizer({
        codec: 'h264',
        ssrc: 1,
        RtpPacket: werift.RtpPacket,
        RtpHeader: werift.RtpHeader,
      }),
      audioPipeline: pipeline,
      audioPacketizer: createRtpPacketizer({
        codec: 'opus',
        ssrc: 2,
        RtpPacket: werift.RtpPacket,
        RtpHeader: werift.RtpHeader,
      }),
      audioPermissionGranted: true,
      sessionId,
      peerConfig: LOOPBACK_CONFIG,
      inputAdapter: {
        platform: 'linux',
        async execute(operation) {
          inputCalls.push(operation);
        },
      },
      inputPermissions: { 'remote-input': true, 'virtual-gamepad': true },
      capabilities: {
        transports: ['webrtc'],
        video: { codecs: ['h264'], maxWidth: 1920, maxHeight: 1080, maxFramerate: 60, hdr: false },
        audio: { codecs: ['opus'], channels: 2 },
        input: { gamepad: true, keyboard: true, pointer: true, rumble: true },
      },
    });
    host.on('error', (error) => hostErrors.push(error));
    host.on('quality', (event) => qualityResults.push(event));

    const clientPeer = new werift.RTCPeerConnection(LOOPBACK_CONFIG);
    const receivedVideo = [];
    const receivedAudio = [];
    const payloadTypes = new Set();
    clientPeer.onTrack.subscribe((track) => {
      track.onReceiveRtp.subscribe((packet) => {
        payloadTypes.add(packet.header.payloadType);
        (track.kind === 'video' ? receivedVideo : receivedAudio).push(packet);
      });
    });
    const clientVideo = new werift.MediaStreamTrack({
      kind: 'video',
      ssrc: 101,
      streamId: 'spartan-stream',
      label: 'Spartan Gaming',
      codec: werift.useH264(),
    });
    const clientAudio = new werift.MediaStreamTrack({
      kind: 'audio',
      ssrc: 102,
      streamId: 'spartan-stream',
      label: 'Spartan Gaming Audio',
      codec: opusFactory(),
    });
    clientPeer.addTrack(clientVideo);
    clientPeer.addTrack(clientAudio);

    clientPeer.onIceCandidate.subscribe((candidate) => {
      hostSignaling.receive(
        createSessionEnvelope({ sessionId, type: 'session.ice-candidate', payload: { candidate } }),
      );
    });

    const handleClientMessage = async (message) => {
      clientMessages.push(message.type);
      try {
        if (message.type === 'session.answer') {
          if (!message.payload.accepted)
            throw new Error(`host rejected the offer: ${message.payload.reason}`);
          await clientPeer.setRemoteDescription(message.payload.sdp);
        } else if (message.type === 'session.ice-candidate') {
          await clientPeer.addIceCandidate(message.payload.candidate);
        }
      } catch (error) {
        clientErrors.push(error);
      }
    };

    await host.start();
    const offer = await clientPeer.createOffer();
    await clientPeer.setLocalDescription(offer);
    hostSignaling.receive(
      createSessionEnvelope({
        sessionId,
        type: 'session.offer',
        payload: {
          sdp: offer,
          transports: ['webrtc'],
          video: { codecs: ['h264'] },
          audio: { codecs: ['opus'] },
          input: { gamepad: true, keyboard: true, pointer: true, rumble: true },
        },
      }),
    );

    const inbound = () =>
      hostSignaling.sent.splice(0).forEach((message) => void handleClientMessage(message));
    await waitFor(
      () => {
        inbound();
        return clientPeer.connectionState === 'connected';
      },
      20_000,
      'client WebRTC connection',
    );
    assert.equal(
      clientPeer.connectionState,
      'connected',
      `host errors: ${hostErrors.map((error) => error.message).join('; ')}; client errors: ${clientErrors.map((error) => error.message).join('; ')}`,
    );

    pipeline.videoOutput.emit('data', VIDEO_CHUNK);
    pipeline.videoOutput.emit('data', VIDEO_CHUNK);
    pipeline.audioOutput.emit('data', OPUS_FRAME);
    pipeline.audioOutput.emit('data', OPUS_FRAME);
    // Werift's DTLS SRTP send context can lag the `connected` state by a few
    // hundred milliseconds on constrained hosts; a single-shot burst can land
    // entirely inside that window and be dropped. Real capture never stops, so
    // keep feeding the pipeline like a genuine source and only stop once the
    // client has observed both tracks. The packet assertions below stay strict.
    const mediaEmitter = setInterval(() => {
      pipeline.videoOutput.emit('data', VIDEO_CHUNK);
      pipeline.audioOutput.emit('data', OPUS_FRAME);
    }, 100);
    try {
      // Werift's RTP delivery can be delayed by concurrent Node test workers on
      // constrained hosts. Keep the packet assertions strict while allowing
      // the real loopback enough time to drain under that scheduling pressure.
      await waitFor(
        () => receivedVideo.length > 0 && receivedAudio.length > 0,
        30_000,
        'client media packets',
      );
    } finally {
      clearInterval(mediaEmitter);
    }
    assert.ok(receivedVideo.length > 0, 'client received no H.264 RTP packets');
    assert.ok(receivedAudio.length > 0, 'client received no Opus RTP packets');
    assert.equal(
      receivedVideo[0].payload[0],
      0x67,
      'first H.264 RTP packet should carry the SPS NAL unit',
    );
    assert.ok(host.mediaPublisher.packetsSent >= 4, 'host should have packetized and sent media');
    assert.ok(clientMessages.includes('session.answer'), 'client never observed the host answer');
    assert.ok(
      payloadTypes.size >= 2,
      'client should receive distinct video and audio payload types',
    );

    hostSignaling.receive(
      createSessionEnvelope({
        sessionId,
        type: 'input.event',
        payload: {
          type: 'input.event',
          kind: 'key',
          action: 'press',
          control: 'KeyA',
          pressed: true,
          source: 'keyboard',
        },
      }),
    );
    await waitFor(() => inputCalls.length > 0, 5_000, 'host input dispatch');
    assert.equal(inputCalls[0].kind, 'key');
    assert.equal(inputCalls[0].control, 'KeyA');
    assert.equal(inputCalls[0].pressed, true);

    hostSignaling.receive(
      createSessionEnvelope({
        sessionId,
        type: 'quality.request',
        payload: {
          profile: 'balanced',
          maxWidth: 1280,
          maxHeight: 720,
          maxFramerate: 30,
          bitrateKbps: 4000,
        },
      }),
    );
    await waitFor(() => qualityResults.length > 0, 5_000, 'host quality result');
    assert.notEqual(
      qualityResults[0].result.status,
      'failed',
      `quality request failed: ${qualityResults[0].result.reason || ''}`,
    );
    assert.equal(qualityResults[0].request.bitrateKbps, 4000);

    host.close();
    clientPeer.close();
  },
);

test(
  'remote session encodes real FFmpeg testsrc into RTP H.264 over a Werift loopback',
  { skip: !weriftAvailable || !ffmpegAvailable },
  async () => {
    const sessionId = 'ses-remote-ffmpeg';
    const hostSignaling = inMemorySignaling();
    const hostErrors = [];
    const clientErrors = [];
    // `-re` paces frame generation to the real wall-clock framerate, matching how a genuine
    // capture source (x11grab, pipewire, avfoundation) behaves. Without it, ffmpeg free-runs
    // and can emit and encode the whole clip in a fraction of a second, which lets every RTP
    // packet reach the transport before ICE/DTLS negotiation finishes (real capture never
    // stops, so this race is invisible there). `duration=30` gives negotiation a generous
    // window to complete even on slow hosts; the test tears the pipeline down via host.close()
    // as soon as it has observed real packets, well before the nominal duration elapses.
    const capturePlan = {
      process: createProcessLaunchPlan({
        executable: 'ffmpeg',
        args: [
          '-hide_banner',
          '-loglevel',
          'error',
          '-re',
          '-f',
          'lavfi',
          '-i',
          'testsrc=duration=30:size=320x180:rate=24',
          '-pix_fmt',
          'yuv420p',
          '-f',
          'matroska',
          'pipe:1',
        ],
      }),
      output: { target: 'stdout', requiresPublisher: true },
    };
    const encoderPlan = createEncoderPlan({
      codec: 'h264',
      width: 320,
      height: 180,
      framerate: 24,
      bitrateKbps: 400,
      preferHardware: false,
    });
    const pipeline = createNativeMediaPipeline({ capturePlan, encoderPlan });
    const host = createNativeWeriftHost({
      signaling: hostSignaling,
      module: werift,
      pipeline,
      packetizer: createRtpPacketizer({
        codec: 'h264',
        ssrc: 1,
        RtpPacket: werift.RtpPacket,
        RtpHeader: werift.RtpHeader,
      }),
      sessionId,
      peerConfig: LOOPBACK_CONFIG,
      capabilities: {
        transports: ['webrtc'],
        video: { codecs: ['h264'], maxWidth: 320, maxHeight: 180, maxFramerate: 24, hdr: false },
        audio: { codecs: ['opus'], channels: 2 },
        input: { gamepad: true, keyboard: true, pointer: true, rumble: true },
      },
    });
    host.on('error', (error) => hostErrors.push(error));

    const clientPeer = new werift.RTCPeerConnection(LOOPBACK_CONFIG);
    const receivedVideo = [];
    clientPeer.onTrack.subscribe((track) => {
      track.onReceiveRtp.subscribe((packet) => {
        if (track.kind === 'video') receivedVideo.push(packet);
      });
    });
    const clientVideo = new werift.MediaStreamTrack({
      kind: 'video',
      ssrc: 201,
      streamId: 'spartan-stream',
      label: 'Spartan Gaming',
      codec: werift.useH264(),
    });
    clientPeer.addTrack(clientVideo);
    clientPeer.onIceCandidate.subscribe((candidate) =>
      hostSignaling.receive(
        createSessionEnvelope({ sessionId, type: 'session.ice-candidate', payload: { candidate } }),
      ),
    );

    const handleClientMessage = async (message) => {
      try {
        if (message.type === 'session.answer') {
          if (!message.payload.accepted)
            throw new Error(`host rejected the offer: ${message.payload.reason}`);
          await clientPeer.setRemoteDescription(message.payload.sdp);
        } else if (message.type === 'session.ice-candidate') {
          await clientPeer.addIceCandidate(message.payload.candidate);
        }
      } catch (error) {
        clientErrors.push(error);
      }
    };

    await host.start();
    const offer = await clientPeer.createOffer();
    await clientPeer.setLocalDescription(offer);
    hostSignaling.receive(
      createSessionEnvelope({
        sessionId,
        type: 'session.offer',
        payload: {
          sdp: offer,
          transports: ['webrtc'],
          video: { codecs: ['h264'] },
          audio: { codecs: ['opus'] },
          input: { gamepad: true, keyboard: true, pointer: true, rumble: true },
        },
      }),
    );

    const inbound = () =>
      hostSignaling.sent.splice(0).forEach((message) => void handleClientMessage(message));
    await waitFor(
      () => {
        inbound();
        return clientPeer.connectionState === 'connected';
      },
      20_000,
      'client WebRTC connection',
    );
    assert.equal(
      clientPeer.connectionState,
      'connected',
      `host errors: ${hostErrors.map((error) => error.message).join('; ')}; client errors: ${clientErrors.map((error) => error.message).join('; ')}`,
    );

    await waitFor(
      () => receivedVideo.length > 0 && host.mediaPublisher?.packetsSent > 0,
      30_000,
      'client RTP packets from the real FFmpeg pipeline',
    );
    assert.ok(receivedVideo.length > 0, 'client received no RTP packets from the FFmpeg pipeline');
    assert.ok(host.mediaPublisher.packetsSent > 0, 'host publisher sent no packets');

    host.close();
    clientPeer.close();
  },
);
