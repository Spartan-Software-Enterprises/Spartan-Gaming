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
- [x] Cross-platform dependency-free frontend development server with safe static routing and browser security headers.
- [x] Reproducible static frontend distribution build with canonical entrypoint and catalog manifest.
- [x] Windows, macOS, and Linux frontend distribution artifact workflow.
- [x] Session player shell with stream target, overlays, quality state, controller hooks, and diagnostics.
- [x] Gaming profiles and workspaces with persistent isolated launch preferences.
- [x] Workspace-scoped dashboard favorites and launch handoffs.
- [x] Fullscreen gaming mode.
- [x] Controller-first dashboard navigation with focus, confirm, and cancel actions.
- [x] Controller remapping profiles and live gamepad/HID inspector.
- [x] Capability-aware Keyboard Lock and Pointer Lock controls with graceful permission fallback.
- [x] Stream and system diagnostics page.
- [ ] Windows, macOS, and Linux development builds.
- [x] Plan-first Windows/macOS/Linux development-build matrix with isolated artifact metadata (compiled binaries remain external-checkout work).
- [x] Unified frontend catalog and launcher model.
- [x] Capability-aware launch plans with explicit readiness, troubleshooting, and next actions.
- [x] Provider profiles for supported cloud, remote-play, and streaming services.
- [x] Emulator/core profiles for libretro, Dolphin, PCSX2, RPCS3, PPSSPP, DuckStation, melonDS, Azahar, MAME, Flycast, xemu, and ScummVM.
- [x] Browser-WASM/libretro runtime lifecycle contract with user-selected file gating.
- [x] Emulation Center browser-adapter registration point with lifecycle controls.
- [x] Shared keyboard and gamepad input bridge for browser emulation adapters.
- [x] Ephemeral selected-file handoff from the emulation UI to browser adapters without persisting content.
- [x] Browser runtime save-state export/import with explicit local file selection.
- [x] User-facing adapter and core readiness manager with signed-manifest import.

## Milestone 2: streaming client

- [x] WebRTC/session runtime bridge for signaling, SDP/ICE, media tracks, input, and reconnect envelopes.
- [x] Local browser-to-browser LAN demo coordinator for authenticated signaling and WebRTC display streaming.
- [x] Adaptive bitrate and resolution policy.
- [x] In-session manual quality selection using validated quality requests.
- [x] Bounded reconnection and session recovery policy with player control.
- [x] Per-codec hardware decode detection through MediaCapabilities with safe fallback.
- [x] Input, decode, render, and network telemetry foundation from browser/WebRTC health signals.
- [x] HDR, multi-display, and refresh-rate capability/policy contracts (native output routing and end-to-end HDR validation pending).
- [x] Screenshots and local recording.
- [x] LAN self-hosted reference stream (browser display/system-audio capture over WebRTC; native host packaging remains pending).
- [x] Guided same-origin LAN host/player handoff UX.
- [x] Provider and emulator capability detection harness.
- [x] Unified session lifecycle and error model.

## Milestone 3: self-hosted stack

- [ ] Windows and Linux host agent (native composition boundary and plan-first cross-platform package workflow implemented; platform packaging and adapters pending).
- [x] Secure device pairing UX and frontend contract (agent/signaling implementation pending).
- [x] Dependency-free reference host control plane (media and OS adapters pending).
- [x] Shell-free managed process lifecycle with bounded output and pipeline rollback.
- [x] Native capture-to-encode stream pipeline with publisher handoff boundary.
- [x] Encoded media publisher sink contract with bounded chunks and lifecycle state.
- [x] Optional WebRTC adapter discovery for native and TypeScript RTP implementations.
- [x] Concrete optional Werift video-track/RTP transport adapter.
- [x] Optional Werift host session runtime and encoded RTP publisher composition.
- [x] Optional Werift shared-peer audio track and native host audio publisher composition.
- [x] Host capability negotiation reflects whether an active WebRTC audio track is actually available.
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
- [x] Shell-free audio publisher and RTP handoff boundary with permission gating (native capture/codec adapters pending).
- [x] Browser-to-host control-plane quality and input envelopes (OS adapters pending).
- [x] Docker deployment and opt-in bearer-authenticated administration API.

## Later exploration

- [x] Android and handheld-focused shell foundation (touch controller overlay and layout preference; native packaging remains pending).
- [x] ChromeOS and television presentation modes across shared frontend surfaces (native packaging and certification remain platform work).
- [x] iOS/iPadOS compatibility strategy (Web/PWA-first profile with an explicitly entitled alternative-engine path kept separate from default support).
- [x] WebTransport experimental datagram transport contract (server deployment and production fallback policy pending).
- [ ] HDR, AV1, high-refresh, and multi-monitor support.
- [x] Community provider compatibility catalog foundation (Provider SDK and hosted database remain pending).
- [x] Signed adapter and core manifest registry contract with WebCrypto verification (release service and packaged adapters pending).
- [x] Release-safe adapter update planning with strict version/platform/trust filtering (installer and release service pending).
- [x] Consent-gated frontend-to-native adapter install request contract (native updater and package signing pending).
- [x] Shell-free native adapter installer transaction with digest/signature verification and rollback (archive extraction and package signing pending).
- [x] Universal desktop platform adapter capability registry and guarded invocation boundary (OS implementations pending).
- [x] Signed package manifest, safe extraction plan, per-file digest verification, and rollback boundary (archive readers and package signing service pending).
- [x] Dependency-free ZIP/TAR archive readers wired into package extraction (Zstandard and other codecs remain adapter-provided).
- [x] Canonical package manifest signing and verification boundary with injected WebCrypto keys (release key custody/service deployment pending).
- [x] Authenticated, rate-limited release signing service boundary with external key custody (KMS/HSM deployment remains environment-specific).
- [x] Transactional native media/audio/input session orchestrator with rollback and reverse-order teardown (OS implementations remain adapter-specific).
- [x] Platform runtime plan composition for Windows, macOS, and Linux capture/audio paths (concrete OS API adapters remain pending).
- [x] Executable platform host composition connecting native media, RTP publishing, audio, and permissioned input into one session boundary (OS API packages remain pending).
- [x] Executable platform audio capture-to-encode and RTP assembly with explicit microphone permission (OS audio APIs remain adapter-provided).
- [x] Verified installed-adapter activation boundary with pointer, package, platform, and factory checks (concrete OS API packages remain pending).
- [x] Signed package kind contract and platform-native binding kit for capture, audio, and input (OS-specific binding implementations remain package-owned).
- [x] Optional platform native-binding discovery and strict adapter composition (binary package implementations remain separately distributed).
- [x] Reproducible per-platform native package manifest and CMake configure/build/install contract (compiled binary sources remain separately distributed).
- [x] Unified frontend runtime readiness contract for browser, native adapter, and self-hosted host layers.
- [x] Capability-driven desktop, ChromeOS, handheld, mobile, and television presentation profiles with safe forced-mode fallback.
- [x] Capability-aware display policy that bounds HDR, codec, refresh-rate, and multi-display session requests without claiming native routing.
