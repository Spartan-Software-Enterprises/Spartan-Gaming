# Architecture

## Product boundary

Spartan Gaming is a universal frontend and orchestration layer. It presents one library, launcher, controller model, overlay, profile system, and diagnostics surface over multiple execution backends:

- Cloud gaming providers opened through optimized official web experiences.
- Remote-play and streaming clients connected to user-owned systems.
- Browser-native games and WebAssembly emulators.
- Native emulator adapters and libretro cores installed or supplied through supported package channels.
- Local games and desktop applications where platform permissions allow them.

Spartan Gaming does not own the catalogs, bypass provider controls, replace emulator projects, or distribute copyrighted games and firmware.

## Components

```text
Spartan Gaming frontend
├── Chromium browser and renderer processes
├── Unified library and launcher
├── Provider adapter registry
├── Emulator/core adapter registry
├── Session and profile manager
├── Controller/input service
├── Streaming and playback coordinator
├── Overlay and diagnostics
├── Capture and recording
└── Permissions and secure credential broker

Execution backends
├── Provider web sessions
├── Official provider APIs and embeds
├── Browser-native WASM/WebGPU runtimes
├── Native emulator adapters
├── Libretro cores
├── User-owned remote hosts
└── Spartan Host/WebRTC services

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
- Maintain provider and emulator adapters rather than hard-coding service internals or forking every backend.
- Define one session contract for launch, pause, stop, input, media, save data, telemetry, and failure reporting.
- Keep backend-specific capabilities visible to the frontend so the UI can degrade gracefully.

## Frontend session model

Every launchable item resolves to a backend descriptor:

```text
catalog item
  → backend adapter
  → capability negotiation
  → profile and permission resolution
  → session lifecycle
  → unified overlay/input/telemetry
```

The frontend must make clear whether a session is browser-hosted, native, remote, self-hosted, or emulated. A provider or emulator failure should return a structured error and troubleshooting link rather than silently changing the backend.

The session runtime in `src/frontend/session/session.mjs` provides the first transport-neutral implementation of this model. It negotiates transports, codecs, display limits, audio, and input features; creates protocol v1 offers; and enforces explicit lifecycle transitions (`preparing`, `negotiating`, `connected`, `reconnecting`, `closing`, and `closed`). Reconnect requests use `src/frontend/session/recovery.mjs` for bounded exponential backoff, attempt limits, and success resets, so a signaling adapter can recover an existing session without silently creating a duplicate host process. Provider and emulator integrations can register immutable adapter descriptors without coupling the frontend to a specific relay, native process, or cloud service.

Universal controller input is normalized in `src/frontend/input/input.mjs`. It applies configurable analog deadzones and maps browser Gamepad API buttons/axes to stable action events, leaving platform-specific HID, keyboard, touch, and native controller adapters free to feed the same action vocabulary.

Adaptive streaming policy is implemented in `src/frontend/session/quality.mjs`. Health telemetry is bounded before use, classified into good/fair/poor network states, and converted into a shared profile request. Degradation steps down quickly; recovery requires consecutive healthy samples to avoid oscillation.

User-owned host connections use the secure boundary in `src/frontend/host/host.mjs`; see [host support](host-support.md) for endpoint, pairing, and transport rules.

Browser signaling and media transport primitives live in `src/frontend/transport/transport.mjs`; see [transport](transport.md) for the WebSocket and WebRTC boundary.

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
