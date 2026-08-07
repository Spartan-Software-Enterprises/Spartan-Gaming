# Spartan Host and user-owned streaming

Spartan Host is the native companion boundary for user-owned PCs, local emulator processes, and compatible remote-play services. The browser frontend never receives a long-lived host credential or embeds credentials in an endpoint URL.

## Connection contract

`src/frontend/host/host.mjs` provides the shared connection primitives:

- HTTPS/WSS is required for remote endpoints; insecure HTTP/WS is limited to localhost and `.local` development hosts.
- Endpoint URLs cannot contain usernames, passwords, or fragments.
- WebRTC is preferred when both sides advertise it, followed by WebTransport and WebSocket.
- Pairing codes use a short human-entered alphabet without ambiguous characters and carry an explicit expiry.
- Returned profiles identify credentials as session-scoped, leaving storage and token exchange to the native host/signaling layer.

The browser is responsible for user consent, endpoint validation, capability negotiation, input routing, quality requests, and diagnostics. The host is responsible for authentication, process ownership, game/emulator launch, media capture/encode, and enforcement of local permissions.

The host manager at `src/frontend/host/index.html` stores only non-secret host profiles in local browser storage. It can generate a `host.pair` request for a one-time code supplied by a running host agent, show the selected transport, and export/import endpoint preferences. It does not complete pairing by itself: the future host agent and signaling service must validate the request, exchange session-scoped credentials, and enforce expiry and replay protection.

The repository includes `host/agent.mjs` as a dependency-free Node.js reference control plane. Run `npm run host -- --pairing-code ABCD23` to expose a local `ws://127.0.0.1:8787/session` endpoint and `/health`. It validates the pairing code once, answers protocol-v1 offers, records quality requests and input-event counts, and handles reconnect messages. It intentionally reports `media.state: not-configured`: capture, encode, game launch, OS input injection, TLS deployment, and TURN are production work still required for a usable remote stream.

For a deployed signaling service, the same agent can join as a host participant with `--signal-endpoint`, `--signal-session`, and `--signal-ticket`. The ticket is role-scoped, supplied out of band, held in memory, and never written to the health response. The direct endpoint and outbound signaling mode share the same session answer and input/quality handling path.

`host/media.mjs` provides the next boundary for those platform implementations. It generates shell-free FFmpeg capture plans for Linux X11/PipeWire, Windows desktop capture, and macOS AVFoundation, validates basic permission context, and generates codec/bitrate encoder plans for H.264, VP9, and AV1. These plans target a future WebRTC publisher and are deliberately not executed by the reference agent.

`host/publisher.mjs` composes those plans into a transport-neutral publisher
contract. It reports `unconfigured` or `plan-only` until a native capture
adapter and WebRTC publisher are installed, and carries bounded codec,
resolution, framerate, audio, and transport capabilities into host health and
session answers. The reference agent therefore exposes truthful readiness
without pretending that FFmpeg output is already playable media.

`host/input.mjs` is the matching input boundary. It maps normalized browser
events to shell-free plans for Windows `SendInput`, macOS Core Graphics/HID,
and Linux `uinput` adapters. Plans declare the required permission (`remote-input`,
`virtual-gamepad`, or `haptic-output`) and remain `plan-only` until a native
adapter is installed. The reference agent records the latest plan in health
output rather than injecting OS input.

`host/audio.mjs` adds the return-audio boundary for Windows WASAPI, macOS
CoreAudio, and Linux PipeWire/PulseAudio. It validates microphone/session
permissions, creates bounded FFmpeg PCM capture plans, and composes an Opus or
AAC publisher plan. Audio remains `unconfigured` in the reference host until
a native audio capture and WebRTC audio publisher are installed.

## Compatibility targets

The adapter boundary can support Spartan Host first, then user-owned Steam Remote Play, Sunshine/Moonlight-compatible endpoints, Parsec, Xbox Remote Play, and PlayStation Remote Play where official protocols and platform rules permit. Compatibility is not permission to bypass authentication, DRM, anti-cheat, or undocumented service controls.
