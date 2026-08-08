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

## Repository boundaries

The frontend and protocol layers are portable and unprivileged. `host/` owns
privileged capture, process, input, audio, and publisher adapters; `signaling/`
owns only authenticated control-plane routing; and `chromium/` owns build and
overlay metadata around an external Chromium checkout. These boundaries are
formalized in [ADR 0002](decisions/0002-chromium-and-repository-boundaries.md).

The reference signaling boundary in `signaling/broker.mjs` issues short-lived
HMAC-scoped client/host tickets and routes validated v1 envelopes between one
client and one host. It is intentionally in-memory and media-free; production
deployment still requires TLS, rate limiting, origin controls, secret
management, and a clustered session registry.

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

Launch resolution is capability-aware: the adapter registry combines the catalog entry, saved profile preferences, and the local diagnostics report into an immutable plan with readiness status, missing capabilities, configuration requirements, structured troubleshooting, and a concrete next action. This keeps official provider handoffs separate from Spartan-managed sessions while allowing the dashboard to route unsupported browser paths to diagnostics or user-owned runtime setup.

`src/frontend/readiness/runtime.mjs` is the shared readiness contract behind those plans. It preserves catalog capability and configuration evidence, adds verified native-adapter state, and optionally adds a self-hosted host preflight as separate immutable layers. Launch surfaces can therefore explain whether they need browser diagnostics, a trusted adapter, host setup, or an official provider handoff without inferring readiness from a single boolean.

`src/frontend/readiness/status.mjs` is the user-facing summary layer over that
evidence. The dashboard status indicator distinguishes loading, offline,
connecting, connected, setup-required, degraded, and error states; it never
labels a catalog as fully ready until capability probing completes.

The session runtime in `src/frontend/session/session.mjs` provides the first transport-neutral implementation of this model. It negotiates transports, codecs, display limits, audio, and input features; creates protocol v1 offers; and enforces explicit lifecycle transitions (`preparing`, `negotiating`, `connected`, `reconnecting`, `closing`, and `closed`). Reconnect requests use `src/frontend/session/recovery.mjs` for bounded exponential backoff, attempt limits, and success resets, so a signaling adapter can recover an existing session without silently creating a duplicate host process. Provider and emulator integrations can register immutable adapter descriptors without coupling the frontend to a specific relay, native process, or cloud service.

Universal controller input is normalized in `src/frontend/input/input.mjs`. It applies configurable analog deadzones and maps browser Gamepad API buttons/axes to stable action events, leaving platform-specific HID, keyboard, touch, and native controller adapters free to feed the same action vocabulary.

Adaptive streaming policy is implemented in `src/frontend/session/quality.mjs`. Health telemetry is bounded before use, classified into good/fair/poor network states, and converted into a shared profile request. The policy accepts both the transport-neutral `bandwidthKbps`/`frameDrops` vocabulary and the WebRTC collector's `bitrateKbps`/`framesDropped`/`decodeFps` fields. Degradation steps down quickly; recovery requires consecutive healthy samples to avoid oscillation.

The WebRTC telemetry collector derives only bounded, aggregate health values from
the peer connection: round-trip time, packet loss, decode rate, dropped frames,
jitter, and receive bitrate. The player diagnostics panel displays those values
without exposing raw reports, SSRCs, credentials, or media content. Bitrate and
decode rate are calculated from consecutive samples, so an initial sample safely
reports zero rather than inventing a measurement.

When the browser exposes `HTMLMediaElement.setSinkId`, the player also offers a
capability-gated audio-output selector backed by `mediaDevices.enumerateDevices`.
Device IDs remain session-local and are not written to settings, profile exports,
URLs, or telemetry. Browsers without output routing support keep the stream on
the default sink and show a non-actionable fallback state.

The saved audio-output preference is intentionally a category rather than a
device ID (`System default`, `Headphones`, `Speakers`, or `HDMI/Display`). At
session startup the player matches that category against the labels returned by
the current browser device enumeration and applies `setSinkId` only for the
current media element. Missing or denied devices fall back to the browser
default without persisting hardware identifiers.

Session recording and instant replay honor the validated `media.recordingCodec`
preference through an ordered `MediaRecorder` MIME-type list, while preserving
browser-supported fallbacks. Screenshot, recording, and replay exports honor
the recording destination preference where the File System Access save picker is
available; otherwise they use the browser's normal download path because a web
frontend cannot select an operating-system folder without user consent.

The Browser Host Studio applies the same permission boundary to microphone
capture: `getUserMedia` is called only after the user enables the microphone
option, and the selected input is combined with the user-approved display stream
in memory. If permission, device access, or track composition fails, all capture
tracks are stopped and the host does not start.

The saved `media.audioInput` preference can disable microphone capture in the
studio (`No microphone`) or leave the explicit user checkbox available for the
system-default/ask-each-time paths. `media.micNoiseSuppression` is translated
into the browser's microphone constraints only after the user has opted into
microphone capture; settings never grant device permission or persist a device
identifier.

User-owned host connections use the secure boundary in `src/frontend/host/host.mjs`; see [host support](host-support.md) for endpoint, pairing, and transport rules.

Controller preferences are carried as explicit session capabilities: HID,
adaptive triggers, and motion controls remain disabled unless the user opts in.
The controller inspector applies the same HID gate before enumerating approved
devices. Input polling is a bounded preference delivered to trusted adapters;
the browser frontend does not claim to change hardware polling rates it cannot
control.

When `privacy.clearOnExit` is enabled, the player removes Spartan-owned
transient session handoffs on explicit session end and `pagehide`. This does
not clear persistent profiles/settings, browser-wide cookies/cache, or
cross-origin provider state; those remain under browser and provider controls.

Browser signaling and media transport primitives live in `src/frontend/transport/transport.mjs`; see [transport](transport.md) for the WebSocket and WebRTC boundary.

## Cross-platform strategy

The browser product layer should share UX, session, protocol, and diagnostics code. Windowing, media capture, hardware acceleration, packaging, signing, permissions, and input backends should be isolated behind platform adapters.

The initial release matrix is Windows, macOS, and Linux. ChromeOS and Android follow with platform-specific packaging work. iOS/iPadOS use the documented Web/PWA-first compatibility profile; native packaging and any alternative engine remain conditional on the browser-engine, entitlement, and distribution rules that apply at release time.

## Latency model

Every streaming session should expose measurable stages:

```text
input capture → upload → server input → game render → encode
→ download → decode → compositor → display
```

User-facing ping must not be presented as equivalent to end-to-end input-to-photon latency.
