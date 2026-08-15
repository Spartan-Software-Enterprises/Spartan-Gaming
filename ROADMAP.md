# Roadmap

## Foundation

- [x] Establish project name, scope, principles, and repository governance.
- [x] Define cross-platform target matrix.
- [x] Record Chromium source, external-checkout, and branch-selection contract.
- [x] Select Chromium development branch and stable release rebase policy.
- [x] Define browser/server/host repository boundaries.
- [x] Publish initial contributor setup contract for Linux, Windows, and macOS.

## Public release acceptance gates

- [x] Maintain passing Prettier, repository, serial, Electron, Android, and cross-platform packaging checks on the release commit (verified locally and in CI on `ea753a2`).
- [x] Run repeatable Playwright interaction and perceptual screenshot comparisons for every maintained application route at desktop, handheld, mobile, and television layouts (44 isolated-state route snapshots, twelve representative interactions, and the Linux/Xvfb baseline are automated; real-device visual approval remains the next separate gate).
- [ ] Visually inspect the packaged application on real Windows, Linux, SteamOS/Steam Deck, Android, Fire TV, ChromeOS, and every other claimed device class; record platform-specific screenshots and interaction evidence.
- [ ] Verify keyboard, mouse, touch, remote, and every supported controller family across navigation, text entry, gameplay, overlays, settings, and recovery flows.
- [ ] Verify cold start, local library/settings/controller workflows, and locally installed runtimes with networking disabled.
- [ ] Verify provider sign-in, sign-out, restart persistence, expired-session recovery, and account switching for every supported cloud-gaming service.
- [ ] Complete signed installers, update/rollback, accessibility, crash recovery, performance, long-session stability, capture/audio/input, and release-candidate regression testing before any public-complete claim.
- [x] Enforce a fail-closed roadmap acceptance ledger for every public-release, production, native-hardware, virtual-driver, signing, provider-account, offline-runtime, physical-input, real-device visual, SteamOS, and release-candidate evidence gate.

## Milestone 1: standalone application shell

- [x] Gaming dashboard and library shell with catalog search, filters, favorites, and launch handoffs.
- [x] Bundled offline-capable application shell with private `spartan-app://` asset loading and no loopback frontend server dependency (the PWA path remains test-only compatibility infrastructure).
- [x] Cross-platform dependency-free shared-UI test harness with safe static routing and browser security headers; it is excluded from the standalone Electron package.
- [x] Reproducible static frontend distribution build with canonical entrypoint and catalog manifest.
- [x] Windows, macOS, and Linux frontend distribution artifact workflow.
- [x] Session player shell with stream target, overlays, quality state, controller hooks, and diagnostics.
- [x] Gaming profiles and workspaces with persistent isolated launch preferences.
- [x] Workspace-scoped dashboard favorites and launch handoffs.
- [x] Fullscreen gaming mode.
- [x] Controller-first dashboard navigation with focus, confirm, and cancel actions.
- [x] Controller remapping profiles and live gamepad/HID inspector with settings-enforced gamepad permission, multiplayer/player-slot limits, dead-zone filtering, and polling cadence.
- [x] Capability-aware Keyboard Lock and Pointer Lock controls with graceful permission fallback.
- [x] Stream and system diagnostics page.
- [x] Windows, macOS, and Linux development builds (Electron unpacked artifacts are built and contract-tested by the cross-platform CI matrix; signed release installers remain a separate release step).
- [x] Branded scalable Electron package icon source for Linux, Windows, and macOS development artifacts.
- [x] Plan-first Windows/macOS/Linux development-build matrix with isolated artifact metadata (compiled binaries remain external-checkout work).
- [x] Unified frontend catalog and launcher model.
- [x] Capability-aware launch plans with explicit readiness, troubleshooting, and next actions.
- [x] Provider profiles for supported cloud, remote-play, and streaming services.
- [x] Profile-scoped Electron provider sessions with an explicit shared-account compatibility setting, same-partition OAuth children, and all-partition logout cleanup (real-service sign-in and recovery remain a public-release gate).
- [x] Settings-controlled provider-session auto-detection for successfully loaded approved Electron views, including application power activity and crash/close cleanup without remote-page injection.
- [x] Standalone settings terminology and schema cleanup (removed the obsolete general-web-search/address-bar control, replaced the startup `New tab` choice with `New session`, and retained legacy-profile routing compatibility).
- [x] Restart-safe Electron hardware-acceleration policy with bounded local persistence, safe malformed-file fallback, and an explicit next-launch status in Settings.
- [x] Bounded GPU preference and process-model startup policy: `performance.gpuPreference` and `performance.processModel` persist alongside hardware acceleration, apply real Chromium switches before Electron becomes ready, fail closed to defaults, and participate in the restart-required notice with real-process Playwright coverage.
- [x] Opt-in local Electron crash and verbose diagnostics with startup-safe policy persistence, bounded retention, queued atomic writes, credential/identity redaction, export and immediate cleanup controls, and real-process Playwright coverage.
- [x] Functional Electron Developer Mode that gates the primary application's DevTools menu, F12/Command-or-Control+Shift+I shortcuts, and Settings action; disabling it closes DevTools immediately, and provider surfaces are never targeted.
- [x] Functional packaged Electron application updater with stable/beta/alpha settings, bounded status and progress, restart confirmation, GitHub release metadata, exact tag/channel checks, and guarded Windows/macOS signing custody (signed release execution and rollback drills remain public-release gates).
- [x] Emulator/core profiles for libretro, Dolphin, PCSX2, RPCS3, PPSSPP, DuckStation, Cemu, Vita3K, melonDS, Azahar, MAME, Flycast, xemu, and ScummVM.
- [x] Browser-WASM/libretro runtime lifecycle contract with user-selected file gating.
- [x] Emulation Center browser-adapter registration point with lifecycle controls.
- [x] Shared keyboard and gamepad input bridge for browser emulation adapters.
- [x] Ephemeral selected-file handoff from the emulation UI to browser adapters without persisting content.
- [x] Browser runtime save-state export/import with explicit local file selection.
- [x] Trusted native runtime/game launch handoff with shell-free process ownership and transactional stream teardown.
- [x] Manifest-verified browser adapter module loading with explicit consent, integrity, and signature checks.
- [x] User-facing adapter and core readiness manager with signed-manifest import.
- [x] External Chromium app-shell launcher with cross-platform binary resolution and local HTTP-origin orchestration.
- [x] Electron single-instance lifecycle and safe `spartan://launch` catalog deep-link handoff (physical packaged-app registration remains release validation work).

## Milestone 2: streaming client

- [x] WebRTC/session runtime bridge for signaling, SDP/ICE, media tracks, input, and reconnect envelopes.
- [x] Local browser-to-browser LAN demo coordinator for authenticated signaling and WebRTC display streaming.
- [x] Adaptive bitrate and resolution policy.
- [x] Telemetry-driven adaptive quality consumes bounded WebRTC bitrate and decode-rate samples.
- [x] Streaming settings ceilings constrain every adaptive quality tier and request.
- [x] In-session manual quality selection using validated quality requests.
- [x] Bounded reconnection and session recovery policy with player control.
- [x] Per-codec hardware decode detection through MediaCapabilities with safe fallback.
- [x] Input, decode, render, and network telemetry foundation from browser/WebRTC health signals.
- [x] Live player telemetry dashboard for RTT, packet loss, decode FPS, dropped frames, jitter, and receive bitrate.
- [x] Capability-gated session audio-output enumeration and routing through the active Chromium media element.
- [x] HDR, multi-display, and refresh-rate capability/policy contracts (native output routing and end-to-end HDR validation pending).
- [x] Screenshots and local recording.
- [x] LAN self-hosted reference stream (browser display/system-audio capture over WebRTC; native host packaging remains pending).
- [x] Browser Host microphone capture with explicit consent, device selection, and session-only track composition.
- [x] Browser Host adaptive quality application through bounded WebRTC video sender parameters.
- [x] Browser Host adaptive resolution application through bounded WebRTC sender scaling.
- [x] Optional Werift host quality forwarding through bounded sender controls.
- [x] Guided same-origin LAN host/player handoff UX.
- [x] Provider and emulator capability detection harness.
- [x] Unified session lifecycle and error model.

## Milestone 3: self-hosted stack

- [x] Cross-platform host agent and deployment control plane (native composition boundary, optional runtime package discovery, guarded input execution, package capture/audio lifecycles, package-backed Werift assembly, shell-free host deployment plans, hardened Linux supervisor template, macOS launchd and Windows service-wrapper guidance, session-scoped enrollment handoff, admin-only host enrollment, Redis-backed signaling, ephemeral TURN credentials, secret-file validation, hardened production Compose, opt-in coturn Compose profile, executable TLS rotation, bounded TURN relay configuration, hardened coturn service template, external signing-service client, tag/manual native rollout artifacts, conditional signed tag publication, and an explicit shell-free production rollout plan with live health verification).
- [ ] Activate live relay provisioning and production services with operator-managed secrets, TLS, Redis, TURN, and external package-signing custody.
- [x] Secure device pairing UX and frontend contract (agent/signaling implementation pending).
- [x] Dependency-free reference host control plane (media and OS adapters pending).
- [x] Shell-free managed process lifecycle with bounded output and pipeline rollback.
- [x] Native capture-to-encode stream pipeline with publisher handoff boundary.
- [x] Encoded media publisher sink contract with bounded chunks and lifecycle state.
- [x] Optional WebRTC adapter discovery for native and TypeScript RTP implementations.
- [x] Concrete optional Werift video-track/RTP transport adapter.
- [x] Dependency-free H.264/VP9/AV1/Opus RTP packetizers for package-backed native hosts.
- [x] Optional Werift host session runtime and encoded RTP publisher composition.
- [x] Opt-in reference-agent bridge from authenticated WebSocket sessions into native Werift media hosts.
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
- [x] Native OS input, audio, and haptics adapters (Linux uinput virtual gamepad/force feedback, Windows XInput rumble, macOS GameController/CoreHaptics output when capabilities are available, Linux portal consent, audio-device enumeration, and the in-process Werift H.264/Opus loopback contract).
- [ ] Validate native input, audio, and haptics on real Windows, macOS, and Linux hardware; Linux requires readable/writable `/dev/uinput` and an FF-capable kernel.
- [ ] Provide Windows/macOS virtual gamepad injection through separately installed, verified virtual-device drivers.
- [x] Cross-platform audio capture and publisher readiness contract (native audio publisher pending).
- [x] Shell-free audio publisher and RTP handoff boundary with permission gating (native capture/codec adapters pending).
- [x] Browser-to-host control-plane quality and input envelopes (OS adapters pending).
- [x] Docker deployment and opt-in bearer-authenticated administration API.

## Later exploration

- [x] Android and handheld-focused shell foundation (touch controller overlay, layout preference, and GameNative handoff contract; native packaging remains pending).
- [x] Android WebView native bridge contract (bounded versioned policy, Game Mode, controller inventory, and text-input requests; debug shell compilation is verified, while callbacks, permissions, and device validation remain pending).
- [x] Android WebView application shell source with local frontend asset packaging, safe asset origin, lifecycle bridge installation, and bounded GameNative/controller/Game Mode boundaries (AWS debug APK compilation is verified; release signing and device validation remain pending).
- [x] SteamOS and Steam Deck target profile contract (explicit SteamOS/Deck capability signal, handheld presentation defaults, Gamescope-aware fullscreen/session behavior, and SteamOS-specific validation plan; physical validation remains open and generic Linux user-agent detection never claims SteamOS).
- [x] Explicit SteamOS host profile contract (os-release identity detection, 1280×800 handheld ceiling, 30/40/60-FPS policy, Gamescope wrapper planning, and controller-only navigation metadata; physical Deck validation remains open).
- [x] Steam Input integration boundary contract (official action/glyph metadata or an installed Steam bridge when available, with the existing Gamepad/HID/controller-profile fallback retained; no undocumented Steam client control and physical bridge validation remains open).
- [x] Portable Steam Input action/glyph contract (shared action manifest, optional installed bridge capability, family-specific glyph fallback, and controller settings wiring; physical Steam Input bridge validation remains open).
- [x] Steam Deck action capability negotiation (trackpad, gyro, rear-button, touchscreen, and text-entry action requirements carried through the shared manifest and session capabilities; physical controls remain unverified).
- [x] Steam Deck controller coverage (trackpads, gyro, rear buttons, touchscreen, on-screen text entry, haptics, and controller-only navigation) through the shared action vocabulary and capability negotiation; physical Deck behavior remains a lab gate.
- [x] User-owned Proton host launch boundary (Linux/SteamOS path selection, compatibility-prefix settings, allow-listed runtime options, shell-free `proton run` planning, and explicit no-bypass policy; physical execution remains gated).
- [x] SteamOS launch and compatibility metadata (user-owned Steam/Proton/native Linux choices, non-Steam launch handoff, Proton runtime options, and clear readiness/diagnostic output without DRM, anti-cheat, or authentication bypasses; physical handoff remains open).
- [x] Explicit SteamOS launch-mode readiness metadata (native Linux, Proton, Steam-owned, and non-Steam modes with app-ID validation and bridge-required states; actual Steam/non-Steam handoff remains host validation work).
- [x] SteamOS session/power integration contract (Gamescope nested-session test path, Game Mode fullscreen, session-reconnect sleep/wake recovery metadata, 30/40/60-FPS and 1280×800 profile ceilings, battery-aware quality policy, and overlay-safe input focus; physical behavior remains open).
- [x] Cross-platform battery-aware session quality policy (explicit Battery saver mode, optional bounded battery telemetry, charging-aware low-battery caps, and conservative 1280×720/30-FPS or emergency 960×540/30-FPS ceilings; physical SteamOS power behavior remains open).
- [x] SteamOS packaging and filesystem contract (Flatpak/user-scope installation guidance for immutable systems, signed adapter updates, rollback, and consent-gated desktop/Steam non-Steam launch registration metadata; package custody remains operator-controlled).
- [x] SteamOS user-scope Flatpak packaging plan (immutable-safe filesystem metadata, consent-gated bundle install/update/uninstall plans, digest validation, and commit-pinned rollback; actual package custody and host execution remain operator-controlled).
- [ ] Validate SteamOS on a physical Steam Deck and a supported SteamOS desktop/Steam Machine profile, including Game Mode/Desktop Mode, Steam Input remapping, glyphs, text entry, touch/trackpad/gyro/rear controls, Gamescope, Proton/native Linux paths, suspend/resume, battery, and external display behavior.
- [x] ChromeOS and television presentation modes across shared frontend surfaces (native packaging and certification remain platform work).
- [x] Amazon Fire TV/Fire Stick and Roku television/browser compatibility profile (user-agent detection, remote navigation, and capability-gated shared web surface; native vendor packaging remains pending).
- [x] WebTransport experimental datagram transport contract (server deployment and production fallback policy pending).
- [x] HDR, AV1, high-refresh, and multi-monitor support (host advertises AV1 only on confirmed hardware encoders and caps resolution/refresh to the real display probe; multi-display fullscreen targeting is implemented; end-to-end provider and HDR output validation remains pending).
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
- [x] Reproducible per-platform native package manifest and CMake configure/build/install contract (Windows, macOS, and Linux native input sources are checked in and built on their target CI runners).
- [x] Unified frontend runtime readiness contract for browser, native adapter, and self-hosted host layers.
- [x] Capability-driven desktop, ChromeOS, handheld, mobile, and television presentation profiles with safe forced-mode fallback.
- [x] Capability-aware display policy that bounds HDR, codec, refresh-rate, and multi-display session requests without claiming native routing.

## Milestone X: Automatic Login & Interactive Voice Chat

### Automatic Login

- [x] Credential storage in localStorage with encryption
- [x] Auto-login on subsequent launches
- [x] Manual override / disable toggle
- [x] Secure credential clearing on logout

### Full Interactive Voice Chat

- [x] Bidirectional microphone streaming
- [x] Noise suppression toggle
- [x] Spatial audio toggle
- [x] Game volume control (0-100%)
- [x] Chat volume control (0-100%)
- [x] Microphone device selection
- [x] Session state synchronization
- [x] Session recovery with voice state
- [x] Interrupt handling and cleanup
- [x] Cross-platform support (Windows, macOS, Linux)

## Milestone: Voice Intelligence & Session Capture

### ✅ Voice Chat Transcription (Contract)

- [x] Bounded transcription preferences
- [x] Consent-gated readiness resolution
- [x] Redacted transcript export

### ✅ Advanced Noise Suppression

- [x] Bounded profiles: off, basic, aggressive, ml
- [x] Platform capability matrix with graceful step-down

### ✅ Session Recording (Contract)

- [x] Consent-gated readiness with display permission check
- [x] Retention window computation with auto-pruning
- [x] Redacted metadata export
