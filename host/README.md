# Spartan Host reference agent

This directory contains the portable reference control plane for user-owned streaming hosts.

```bash
npm run host -- --pairing-code ABCD23
```

The default development endpoints are:

- `http://127.0.0.1:8787/health` for a redacted health/capability document.
- `ws://127.0.0.1:8787/session` for protocol-v1 session offers.

The host can also join a separate signaling service as a host participant:

```bash
npm run host -- --id host-01 --pairing-code ABCD23 \
  --signal-endpoint wss://signal.example/signal \
  --signal-session ses-example-01 --signal-ticket "$HOST_SIGNAL_TICKET"
```

The outbound signaling ticket is accepted only for the `host` role and the
specified session. It is held in memory by the process and is never included
in health output. The direct LAN endpoint remains available unless the host is
isolated behind a firewall.

The agent accepts one correctly paired `session.offer`, returns a protocol-valid `session.answer`, and rejects replayed or expired pairing codes. It is intentionally dependency-free and runs anywhere Node.js 20 runs. This is a control-plane reference only: it does not launch games, capture or encode media, inject OS input, provide TLS, or operate STUN/TURN. Those capabilities belong in platform-specific host adapters and the production signaling/deployment layer.

The agent accepts `--port 0` for an ephemeral local port, which is useful for
integration tests and launcher-managed instances. The executable integration
contract in `host/agent.integration.test.mjs` starts that reference agent,
performs a real paired WebSocket offer/answer exchange, sends quality and
input envelopes, and verifies the redacted health counters.

Before accepting an offer, the agent intersects the client’s transports,
video, audio, and input capabilities with its own and returns only the
selected contract. Offers with no compatible transport or codec receive an
explicit rejected answer and are not added to the active-session set.
Pairing codes are checked without consumption during that negotiation step;
the one-time code is consumed only after a compatible offer is accepted, so a
failed capability attempt does not strand a valid retry.

The health response also reports the selected platform adapter, detected `ffmpeg`/GStreamer tools, and conservative readiness flags. A detected encoder tool is evidence only that a future media adapter may be possible; it is not a claim that capture, WebRTC publication, or game launching is implemented.

Capture and encode plans are available as pure, testable contracts in `host/media.mjs`. They use `shell: false`, require explicit platform permission context, and return a pipeline description for a future WebRTC publisher rather than starting a desktop capture unexpectedly.

Native adapter authors can use `host/process.mjs` to execute those plans through
`createManagedProcess` or `createProcessPipeline`. The lifecycle boundary keeps
argument arrays shell-free, retains only bounded stdout/stderr tails, emits
explicit starting/running/stopping/failed states, and rolls already-started
processes back if a pipeline member cannot start. It does not itself claim that
an FFmpeg output is a WebRTC track; a platform publisher still owns that bridge.

`host/native-media.mjs` now connects a capture plan’s stdout to an encoder
process’s stdin and exposes the encoded stdout stream. Its integration test uses
real child processes to prove the byte path and teardown behavior. This is the
native capture-to-encode boundary; RTP/WebRTC publication, hardware encoder
selection, and audio multiplexing remain adapter responsibilities.

`createEncodedMediaPublisher` in `host/publisher.mjs` is the explicit handoff
contract for that next adapter. It forwards bounded encoded chunks to an
injected sink and reports publisher lifecycle/capability state, but deliberately
does not reinterpret a sink as WebRTC until an RTP/WebRTC implementation is
provided.
