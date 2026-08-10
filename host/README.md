# Spartan Host reference agent

This directory contains the portable reference control plane for user-owned streaming hosts.

```bash
npm run host -- --pairing-code ABCD23
```

The default development endpoints are:

- `http://127.0.0.1:8787/health` for a redacted health/capability document.

For remote direct-host deployments, pass `--tls-key` and `--tls-cert` together
to serve `wss://` and `https://` endpoints. Keep the private key outside the
repository; a managed reverse proxy is preferred for certificate rotation.
- `ws://127.0.0.1:8787/session` for protocol-v1 session offers.

Remote deployments should set `--allowed-origins` (or
`SPARTAN_HOST_ALLOWED_ORIGINS`) to a comma-separated exact-origin allowlist.
The allowlist applies to both WebSocket upgrades and browser-readable health
responses; the agent also bounds concurrent sockets and per-connection message rate with
`--max-connections`/`SPARTAN_HOST_MAX_CONNECTIONS` and
`--max-messages-per-second`/`SPARTAN_HOST_MAX_MESSAGES_PER_SECOND`.

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

The agent accepts one correctly paired `session.offer`, returns a protocol-valid `session.answer`, and rejects replayed or expired pairing codes. It is intentionally dependency-free and runs anywhere Node.js 20 runs. This is a control-plane reference only: it does not launch games, capture or encode media, inject OS input, or operate STUN/TURN. Those capabilities belong in platform-specific host adapters and the production signaling/deployment layer.

At startup the agent also performs optional native-package discovery. Installed
platform bindings contribute only truthful, serializable readiness and input
capabilities; missing packages leave those paths unconfigured. Raw native
objects are retained for composition and are never returned by `/health`.

Remote input remains disabled by default. A host operator may explicitly start
the agent with `--enable-input` after installing and permissioning a ready
platform input package; events then pass through the normalized, permissioned,
rate-limited native input executor. The flag does not enable media capture or
other host capabilities.

Werift and browser-host answers report `hostCapabilities.media.audio` from the
actual active audio path: it is true only when the host has an audio track or
an explicitly enabled native audio publisher.

## Optional Werift runtime

`host/werift-runtime.mjs` provides the host-side session bridge for an optional `werift` installation. A caller supplies a `sessionFactory` that creates the concrete session from `host/werift-adapter.mjs`; the runtime then handles Spartan Gaming SDP offers, ICE candidates, input events, quality requests, reconnect answers, and outbound ICE candidates over any signaling transport implementing `connect()`, `send()`, and `on()`.

The Werift package remains optional. The dependency-free reference host and browser-host runtime continue to work without it, and the Werift contract suite is run separately with `npm run test:werift`.

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

`host/webrtc.mjs` detects optional WebRTC implementations without adding either
one to Spartan's core dependency set. `node-datachannel` is the native adapter
slot and `werift` is the TypeScript adapter slot. A production host selects one
according to its platform packaging, then supplies its RTP packetization and
peer-connection sink to the encoded publisher boundary.

`host/werift-adapter.mjs` is the first concrete optional media adapter. It
creates a Werift video track, attaches it to a peer connection, and exposes the
track as an RTP transport for `createRtpMediaPublisher`; installing `werift` is
still an explicit host deployment choice.

It also supports a shared-peer audio track through
`createWeriftAudioTransport` and `createWeriftAudioRtpPublisher`. When
`createNativeWeriftHost` receives an audio pipeline, packetizer, and explicit
permission, it publishes Opus audio beside video and tears both publishers
down together.

The same module exports `createWeriftRtpPublisher`, which composes that track
transport with the native encoded-media publisher. The caller supplies the
platform pipeline and codec packetizer, so the adapter owns WebRTC/RTP delivery
without guessing how a platform captures, frames, or packetizes video.

The same module exposes a session wrapper for SDP offer/answer and ICE
candidate handling. `host/werift-runtime.mjs` now connects that wrapper to the
authenticated Spartan transport envelopes, including input and quality
callbacks. The complete LAN stream remains gated on a real browser-to-host
media test and a production capture/encode wiring pass.

`host/native-host.mjs` composes the native media pipeline, optional shared-peer
audio pipeline, Werift RTP publishers, and signaling runtime behind one
injectable factory. It can consume either already-created pipelines or
validated shell-free capture/encoder plans, starts capture/encode only after a
validated session offer arrives, and tears both publishers down with the
session. Production platform adapters still supply the actual capture plans,
packetizers, optional Werift package, and relay configuration.

`host/game-launcher.mjs` supplies the user-owned emulator handoff. A trusted
native runtime profile and an explicitly selected local game file become a
shell-free process plan. Pass the resulting launcher to
`createNativeHostSession` or `createExecutablePlatformHost` to start the game
before capture, roll it back when media/audio setup fails, and stop it after
stream teardown. The host never packages or downloads ROMs, BIOS files, keys,
or firmware.

For Linux and SteamOS, a user-owned Proton installation can be selected for a
Windows game without giving the host a shell command. The launch plan is
created with `host/proton.mjs` and uses Proton's `run` subcommand, an explicit
game path, an optional compatibility prefix, and a small allow-list of runtime
options. A deployment may expose equivalent settings through the host config.

The reference agent does not bundle, download, or modify Proton and does not
provide DRM, anti-cheat, or authentication bypasses. Real Proton execution,
Steam Input, Gamescope, Game Mode, and Deck power/controller behavior require a
physical Linux/SteamOS validation host.
