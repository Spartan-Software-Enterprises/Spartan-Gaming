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

## Compatibility targets

The adapter boundary can support Spartan Host first, then user-owned Steam Remote Play, Sunshine/Moonlight-compatible endpoints, Parsec, Xbox Remote Play, and PlayStation Remote Play where official protocols and platform rules permit. Compatibility is not permission to bypass authentication, DRM, anti-cheat, or undocumented service controls.
