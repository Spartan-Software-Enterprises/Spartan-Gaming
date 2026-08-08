# Browser transport layer

`src/frontend/transport/transport.mjs` supplies the browser-facing transport primitives used by host and provider adapters:

- `createWebSocketSignalTransport` validates `ws`/`wss` endpoints, exposes open/message/error/close events, and only sends protocol v1 envelopes.
- `createWebTransportSignalTransport` provides an experimental HTTPS datagram signaling path with the same envelope validation and optional join handshake.
- `createWebRtcTransport` wraps `RTCPeerConnection`, creates offers, accepts answers, forwards ICE candidates and media tracks, and closes cleanly.
- `src/frontend/transport/ice.mjs` validates STUN/TURN URLs, requires secure remote TURN by default, accepts ephemeral session credentials, bounds server/pool counts, and produces redacted diagnostics.
- `src/frontend/transport/policy.mjs` normalizes saved transport preferences and creates session-only ICE options; it never stores relay URLs or credentials in profiles.
- `validateTransportMessage` fails closed for unknown protocol message types or malformed envelopes.

`src/frontend/session/runtime.mjs` composes these primitives with the session manager. It connects signaling, adds the WebRTC offer/answer and ICE payloads, forwards media tracks, routes input/reconnect envelopes, and exposes session events for the player. It does not own provider credentials or host process lifecycle.

Native emulator sessions may add a consented `launch` descriptor to the
`session.offer`. `src/frontend/emulation/host-launch.mjs` keeps that descriptor
metadata-only: it carries runtime/core identity, an opaque host content ID,
selected file metadata, and consent—not browser paths, `File` objects, or
content bytes. The host validates it against its own operator-configured
runtime and content before launching anything.

The browser carries this descriptor between Emulation Center, Host Profiles,
and Player through a ten-minute, session-storage-only handoff. The host
pairing flow shows the pending game and the player consumes the handoff only
when creating the authenticated offer; malformed or expired records are
discarded.

Reconnect lifecycle is coordinated by `src/frontend/session/reconnect-controller.mjs` around the bounded recovery policy. A reconnect attempt emits an envelope immediately, transport failures schedule the next bounded attempt with exponential backoff, successful answers reset recovery, and the player can cancel pending work. Controller state is observable as `attempting`, `waiting`, `succeeded`, `cancelled`, or `exhausted`; no reconnect loop is unbounded or hidden from the UI.

The player loads the persisted transport policy through
`src/frontend/player/transport-config.mjs`. HTTPS signaling can select the
experimental WebTransport datagram adapter; WSS signaling uses WebSocket;
WebRTC remains the media transport when the browser exposes it. Relay policy
is passed into the WebRTC configuration for the current session only.

Incoming WebRTC streams are attached through `src/frontend/player/media.mjs`.
The player also exposes capability-gated Picture-in-Picture for supported
Chromium builds. The control only requests PiP after the user enables it in
Gaming settings and uses the browser's media permission model; Spartan Gaming
does not copy, upload, or persist the stream when the floating window is active.
The same player registers Media Session metadata and play, pause, stop, and
bounded seek actions when Chromium exposes `navigator.mediaSession`, allowing
hardware media keys and supported OS controls to operate the active stream.

The capability probe also records privacy-safe HDR availability, display count,
extended-display state, and observed refresh-rate ceilings. Session preferences
carry a bounded display selection and refresh-rate policy; the host/provider
still decides whether those requests can be honored.
The player reports whether video and audio tracks arrived, starts audio
enabled by default, and provides a local mute toggle without changing the
remote stream or exposing device data.

When WebRTC exposes `getStats()`, the runtime starts `src/frontend/session/telemetry.mjs`. The collector reduces inbound video and candidate-pair statistics to RTT, packet loss, decode rate, jitter, dropped frames, and byte counters, then emits bounded `telemetry.health` messages. Raw stats reports and browser/device identity are never forwarded.

Codec hardware efficiency is detected separately in the diagnostics center through MediaCapabilities; runtime telemetry remains measurement-only and does not infer decoder hardware from performance alone.

`src/frontend/display/policy.mjs` turns the saved display and stream preferences
plus an optional capability report into an immutable effective policy. It caps
refresh requests to the observed browser ceiling, disables HDR when the browser
reports no HDR path, filters codec preferences only when explicit support
evidence exists, and records display-selection warnings. Without a capability
report it preserves the user’s bounded request so a host/provider can negotiate
the final result. This is a browser policy contract; native multi-monitor
routing and end-to-end HDR validation remain platform-adapter work.

The player remains transport-neutral: an adapter can attach a negotiated `MediaStream` to its video target and forward health/input events to the session manager. Signaling authentication, host authorization, and process ownership stay outside the browser transport wrapper. A host/signaling service may supply short-lived ICE credentials to `createWebRtcTransport({ice})`; credentials must remain session-scoped and must never be stored in host profiles, exports, diagnostics, or URLs.

The session player provides the authenticated client entrypoint: its in-memory
connection form accepts a signaling endpoint, matching session ID, and
short-lived `client` ticket, then joins the broker before sending an SDP offer.
Browser Host Studio uses the corresponding `host` ticket for the same session.

When degraded telemetry changes the active quality profile, the runtime sends a validated `quality.request` envelope back through signaling. The session player also exposes an explicit Ultra/High/Balanced/Low/Emergency selector that uses the same validated request path; selecting a profile resets the adaptive controller’s recovery counter without disabling future adaptation. Browser Host applies bounded bitrate, framerate, and track-dimension requests to supported WebRTC video sender encodings; when the captured track exposes dimensions it uses `scaleResolutionDownBy` to enforce lower adaptive resolutions, and reports unsupported or failed controls in its diagnostics. Native host adapters remain responsible for their encoder APIs. The reference host records requests but cannot encode media. `input.event` envelopes are likewise delivered to the host control plane only after the session and pairing checks succeed.
The player emits normalized controller and keyboard actions as protocol v1 `input.event` envelopes through the `spartan:input` browser event. Gamepad values include deadzone processing and signed analog ranges; adapters are responsible for forwarding these envelopes over the active data channel and applying the selected controller profile on the host side. The browser does not transmit raw device identity or full Gamepad objects.
