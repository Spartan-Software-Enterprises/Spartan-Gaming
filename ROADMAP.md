# Roadmap

## Foundation

- [x] Establish project name, scope, principles, and repository governance.
- [x] Define cross-platform target matrix.
- [ ] Select Chromium branch and rebase policy.
- [ ] Define browser/server/host repository boundaries.
- [ ] Publish contributor setup for Linux, Windows, and macOS.

## Milestone 1: browser shell

- [x] Gaming dashboard and library shell with catalog search, filters, favorites, and launch handoffs.
- [x] Session player shell with stream target, overlays, quality state, controller hooks, and diagnostics.
- [ ] Gaming profiles and workspaces.
- [ ] Fullscreen gaming mode.
- [ ] Controller-first navigation.
- [x] Controller remapping profiles; gamepad inspector remains planned.
- [ ] Keyboard Lock, Pointer Lock, and per-site permission UX.
- [x] Stream and system diagnostics page.
- [ ] Windows, macOS, and Linux development builds.
- [x] Unified frontend catalog and launcher model.
- [ ] Provider profiles for GeForce NOW, Xbox Cloud Gaming, Amazon Luna, Boosteroid, Shadow, Twitch, YouTube Live, Discord, and Steam.
- [x] Emulator/core profiles for libretro, Dolphin, PCSX2, RPCS3, PPSSPP, DuckStation, melonDS, Azahar, MAME, Flycast, xemu, and ScummVM.

## Milestone 2: streaming client

- [x] WebRTC/session runtime bridge for signaling, SDP/ICE, media tracks, input, and reconnect envelopes.
- [x] Adaptive bitrate and resolution policy.
- [x] Bounded reconnection and session recovery policy with player control.
- [ ] Hardware decode detection.
- [x] Input, decode, render, and network telemetry foundation from browser/WebRTC health signals.
- [x] Screenshots and local recording.
- [ ] LAN self-hosted reference stream.
- [ ] Provider and emulator capability detection harness.
- [x] Unified session lifecycle and error model.

## Milestone 3: self-hosted stack

- [ ] Windows and Linux host agent.
- [ ] Secure device pairing.
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
