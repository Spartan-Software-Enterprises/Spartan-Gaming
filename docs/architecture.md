# Architecture

## Product boundary

Spartan Gaming consists of a Chromium-based browser client and optional open-source streaming services. The browser must remain useful with existing web-based gaming providers; the optional services enable self-hosted streaming from a user-owned PC, VM, or cloud GPU.

## Components

```text
Spartan Gaming browser
├── Chromium browser and renderer processes
├── Gaming shell and dashboard
├── Session and profile manager
├── Controller/input service
├── Streaming quality controller
├── Overlay and diagnostics
└── Capture and recording

Optional services
├── Host agent
├── Signaling and pairing
├── STUN/TURN or relay integration
├── Stream protocol implementation
└── Administration API
```

## Technical direction

- Preserve Chromium's sandbox, site isolation, and multi-process model.
- Use WebRTC as the initial low-latency media transport.
- Evaluate WebTransport for experimental client-server transport and datagrams.
- Use WebCodecs where custom frame-level processing or diagnostics are required.
- Use Gamepad first, with WebHID/WebUSB integrations only behind explicit permissions.
- Keep privileged browser changes small, reviewable, and isolated behind browser services.
- Maintain a compatibility layer for existing cloud gaming services rather than hard-coding service internals.

## Cross-platform strategy

The browser product layer should share UX, session, protocol, and diagnostics code. Windowing, media capture, hardware acceleration, packaging, signing, permissions, and input backends should be isolated behind platform adapters.

The initial release matrix is Windows, macOS, and Linux. ChromeOS, Android, and iOS/iPadOS follow with platform-specific feasibility reviews. iOS/iPadOS must remain conditional on the browser-engine and distribution rules that apply at release time.

## Latency model

Every streaming session should expose measurable stages:

```text
input capture → upload → server input → game render → encode
→ download → decode → compositor → display
```

User-facing ping must not be presented as equivalent to end-to-end input-to-photon latency.

