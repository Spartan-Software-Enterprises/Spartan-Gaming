# Roadmap

## Foundation

- [x] Establish project name, scope, principles, and repository governance.
- [x] Define cross-platform target matrix.
- [x] Record Chromium source, external-checkout, and branch-selection contract.
- [x] Select Chromium development branch and stable release rebase policy.
- [x] Define browser/server/host repository boundaries.
- [x] Publish initial contributor setup contract for Linux, Windows, and macOS.

## Milestone 1: browser shell

- [x] Gaming dashboard and library shell with catalog search, filters, favorites, and launch handoffs.
- [x] Installable PWA shell with offline-safe frontend and public catalog caching.
- [x] Session player shell with stream target, overlays, quality state, controller hooks, and diagnostics.
- [x] Gaming profiles and workspaces with persistent isolated launch preferences.
- [x] Fullscreen gaming mode.
- [x] Controller-first dashboard navigation with focus, confirm, and cancel actions.
- [x] Controller remapping profiles and live gamepad/HID inspector.
- [x] Capability-aware Keyboard Lock and Pointer Lock controls with graceful permission fallback.
- [x] Stream and system diagnostics page.
- [ ] Windows, macOS, and Linux development builds.
- [x] Unified frontend catalog and launcher model.
- [x] Capability-aware launch plans with explicit readiness, troubleshooting, and next actions.
- [x] Provider profiles for supported cloud, remote-play, and streaming services.
- [x] Emulator/core profiles for libretro, Dolphin, PCSX2, RPCS3, PPSSPP, DuckStation, melonDS, Azahar, MAME, Flycast, xemu, and ScummVM.

## Milestone 2: streaming client

- [x] WebRTC/session runtime bridge for signaling, SDP/ICE, media tracks, input, and reconnect envelopes.
- [x] Adaptive bitrate and resolution policy.
- [x] Bounded reconnection and session recovery policy with player control.
- [x] Per-codec hardware decode detection through MediaCapabilities with safe fallback.
- [x] Input, decode, render, and network telemetry foundation from browser/WebRTC health signals.
- [x] Screenshots and local recording.
- [ ] LAN self-hosted reference stream.
- [x] Provider and emulator capability detection harness.
- [x] Unified session lifecycle and error model.

## Milestone 3: self-hosted stack

- [ ] Windows and Linux host agent (native composition boundary implemented; platform packaging and adapters pending).
- [x] Secure device pairing UX and frontend contract (agent/signaling implementation pending).
- [x] Dependency-free reference host control plane (media and OS adapters pending).
- [x] Shell-free managed process lifecycle with bounded output and pipeline rollback.
- [x] Native capture-to-encode stream pipeline with publisher handoff boundary.
- [x] Encoded media publisher sink contract with bounded chunks and lifecycle state.
- [x] Optional WebRTC adapter discovery for native and TypeScript RTP implementations.
- [x] Concrete optional Werift video-track/RTP transport adapter.
- [x] Optional Werift host session runtime and encoded RTP publisher composition.
- [x] Native pipeline/Werift host composition factory with lifecycle teardown.
- [x] Host capability serialization for safe WebRTC adapter readiness diagnostics.
- [x] Platform-aware capture and encoder plan contracts (native execution and WebRTC publisher pending).
- [x] Transport-neutral media publisher readiness contract (native publisher implementation pending).
- [x] Authenticated in-memory signaling routing contract (WebSocket service adapter and deployment pending).
- [x] Dependency-free reference signaling service.
- [x] Validated session-scoped STUN/TURN configuration contract (relay deployment and credential service pending).
- [x] User-facing transport and relay policy controls (runtime provider/host wiring pending).
- [x] Controller, keyboard, pointer, and rumble forwarding contract (native OS injection pending).
- [x] Shell-free native input executor boundary with permissions and rate limiting (OS adapter implementations pending).
- [ ] Native OS input injection, audio return, and end-to-end haptics.
- [x] Cross-platform audio capture and publisher readiness contract (native audio publisher pending).
- [x] Browser-to-host control-plane quality and input envelopes (OS adapters pending).
- [x] Docker deployment and opt-in bearer-authenticated administration API.

## Later exploration

- [ ] Android and handheld-focused shell.
- [ ] ChromeOS and television mode.
- [ ] iOS/iPadOS compatibility strategy.
- [x] WebTransport experimental datagram transport contract (server deployment and production fallback policy pending).
- [ ] HDR, AV1, high-refresh, and multi-monitor support.
- [ ] Provider SDK and community compatibility database.
- [ ] Signed adapter and core registry.
