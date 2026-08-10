# Spartan Gaming streaming protocol

This directory defines the transport-neutral contract shared by the Spartan Gaming browser, host agent, signaling service, and relay components.

## Design rules

- The protocol is versioned independently from Chromium releases.
- Signaling and media transport are separate concerns.
- WebRTC is the first media transport; WebTransport is an experimental future transport.
- Input messages are timestamped, sequenced, bounded, and idempotency-aware.
- Capabilities are negotiated before a stream begins.
- Unknown fields may be ignored; unknown required versions must fail closed.
- Authentication and authorization are mandatory for remote sessions.

## Session lifecycle

```text
new → authenticating → negotiating → active → reconnecting → closed
```

The browser and host must be able to close a session explicitly with a reason. A reconnecting client must not silently create a second host process or duplicate input stream.

## v1 scope

The first version covers:

- Session creation and capability negotiation.
- Optional consented metadata-only emulator launch handoff.
- Video and audio track preferences.
- Input event envelopes.
- Quality-control hints.
- Health and latency telemetry.
- Graceful close and reconnect metadata.

The browser starts with a quality request in the session offer. Hosts and relays can send `telemetry.health` envelopes; the frontend quality controller responds with bounded `quality.request` values for resolution, framerate, codec-independent bitrate, and profile name.

It intentionally does not define game-library discovery, account federation, billing, or a proprietary media codec.

## Local validation

The v1 envelope can be validated without installing project dependencies:

```bash
node protocol/v1/validate-session.mjs protocol/v1/examples/session-offer.json
```
