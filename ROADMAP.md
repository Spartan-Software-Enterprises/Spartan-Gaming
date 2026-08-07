# Roadmap

## Foundation

- [x] Establish project name, scope, principles, and repository governance.
- [x] Define cross-platform target matrix.
- [ ] Select Chromium branch and rebase policy.
- [ ] Define browser/server/host repository boundaries.
- [ ] Publish contributor setup for Linux, Windows, and macOS.

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
- [ ] Provider and emulator capability detection harness.
- [x] Provider and emulator capability detection harness.
- [x] Unified session lifecycle and error model.

## Milestone 3: self-hosted stack

- [ ] Windows and Linux host agent.
- [x] Secure device pairing UX and frontend contract (agent/signaling implementation pending).
- [x] Dependency-free reference host control plane (media and OS adapters pending).
- [ ] Signaling service.
- [ ] STUN/TURN integration.
- [ ] Controller, keyboard, mouse, audio, and rumble forwarding.
- [ ] Docker deployment and administration API.

## Later exploration

- [ ] Android and handheld-focused shell.
- [ ] ChromeOS and television mode.
- [ ] iOS/iPadOS compatibility strategy.
- [ ] WebTransport experimental transport.
- [ ] HDR, AV1, high-refresh, and multi-monitor support.
- [ ] Provider SDK and community compatibility database.
- [ ] Signed adapter and core registry.
