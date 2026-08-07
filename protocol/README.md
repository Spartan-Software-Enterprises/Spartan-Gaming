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
- Video and audio track preferences.
- Input event envelopes.
- Quality-control hints.
- Health and latency telemetry.
- Graceful close and reconnect metadata.

It intentionally does not define game-library discovery, account federation, billing, or a proprietary media codec.

