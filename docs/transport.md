# Browser transport layer

`src/frontend/transport/transport.mjs` supplies the browser-facing transport primitives used by host and provider adapters:

- `createWebSocketSignalTransport` validates `ws`/`wss` endpoints, exposes open/message/error/close events, and only sends protocol v1 envelopes.
- `createWebRtcTransport` wraps `RTCPeerConnection`, creates offers, accepts answers, forwards ICE candidates and media tracks, and closes cleanly.
- `src/frontend/transport/ice.mjs` validates STUN/TURN URLs, requires secure remote TURN by default, accepts ephemeral session credentials, bounds server/pool counts, and produces redacted diagnostics.
- `validateTransportMessage` fails closed for unknown protocol message types or malformed envelopes.

`src/frontend/session/runtime.mjs` composes these primitives with the session manager. It connects signaling, adds the WebRTC offer/answer and ICE payloads, forwards media tracks, routes input/reconnect envelopes, and exposes session events for the player. It does not own provider credentials or host process lifecycle.

When WebRTC exposes `getStats()`, the runtime starts `src/frontend/session/telemetry.mjs`. The collector reduces inbound video and candidate-pair statistics to RTT, packet loss, decode rate, jitter, dropped frames, and byte counters, then emits bounded `telemetry.health` messages. Raw stats reports and browser/device identity are never forwarded.

Codec hardware efficiency is detected separately in the diagnostics center through MediaCapabilities; runtime telemetry remains measurement-only and does not infer decoder hardware from performance alone.

The player remains transport-neutral: an adapter can attach a negotiated `MediaStream` to its video target and forward health/input events to the session manager. Signaling authentication, host authorization, and process ownership stay outside the browser transport wrapper. A host/signaling service may supply short-lived ICE credentials to `createWebRtcTransport({ice})`; credentials must remain session-scoped and must never be stored in host profiles, exports, diagnostics, or URLs.

When degraded telemetry changes the active quality profile, the runtime sends a validated `quality.request` envelope back through signaling. Host adapters may apply that request to their encoder; the reference host records it for diagnostics but cannot encode media. `input.event` envelopes are likewise delivered to the host control plane only after the session and pairing checks succeed.
The player emits normalized controller and keyboard actions as protocol v1 `input.event` envelopes through the `spartan:input` browser event. Gamepad values include deadzone processing and signed analog ranges; adapters are responsible for forwarding these envelopes over the active data channel and applying the selected controller profile on the host side. The browser does not transmit raw device identity or full Gamepad objects.
