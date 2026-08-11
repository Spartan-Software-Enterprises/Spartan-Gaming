# Spartan Gaming

### One gaming command center. Every screen. Your games, your hardware, your rules.

Spartan Gaming is an open-source, privacy-respecting gaming frontend designed to bring cloud gaming, remote play, browser games, emulation, local launches, controllers, capture, and diagnostics into one consistent experience.

Electron is the primary desktop application. The same bundled application UI and bounded platform bridges extend the project toward Windows, Linux, macOS, SteamOS and Steam Deck, ChromeOS, Android, Amazon Fire TV, and television-class devices. iOS is not a project target.

> **Built in the open, verified in layers.** Core interfaces and tested reference implementations are available today. Hardware-, driver-, signing-, store-certification-, and production-service gates stay explicitly open until they have real evidence. [See the full roadmap](ROADMAP.md).

## Why Spartan Gaming?

Gaming is fragmented across launchers, browser tabs, streaming clients, controller tools, emulator frontends, and remote-host utilities. Spartan Gaming is building the connective layer between them: one controller-friendly library, one player experience, one settings center, and one honest compatibility model.

- **One library:** search providers, emulators, browser games, and local or remote launch targets from a unified dashboard.
- **One player:** fullscreen playback, adaptive quality, reconnect controls, overlays, recording, screenshots, audio routing, and live network/decode diagnostics.
- **One controller system:** reusable profiles, remapping, deadzones, haptics policy, live inspection, touch controls, and controller-first navigation.
- **Your infrastructure:** use compatible public services or pair with a self-hosted Spartan host; no mandatory Spartan account or telemetry service is required.
- **Portable by design:** desktop, handheld, mobile, and television layouts share capability-driven behavior instead of pretending every device can do everything.
- **Security boundaries that mean something:** safe external navigation, isolated provider surfaces, bounded native messages, permission-gated capture/input, signed adapter contracts, and shell-free launch plans.

## The experience

### A living gaming library

The dashboard combines provider, emulator, and browser-game catalogs with search, filters, favorites, recent-session handoffs, readiness checks, and workspace-specific preferences. Launch plans explain what is ready, what is missing, and what the user must provide—without mirroring games or hiding unsupported behavior.

### A real standalone desktop application

The primary desktop app is packaged as one application. Its interface, catalogs, settings, diagnostics, controller tools, and local workflows are bundled with the executable—there is no loopback frontend server and no website to connect to before Spartan Gaming can start. It includes:

- A single-instance lifecycle with guarded `spartan://launch` deep links.
- Sandboxed, isolated provider views with HTTPS-only navigation policy.
- In-app provider sign-in and OAuth windows with persistent, provider-isolated sessions and approved authentication domains.
- Tray and background-app behavior controlled by Settings.
- Session-aware power-save blocking plus bounded suspend, battery, thermal, and CPU speed-limit events.
- Privacy controls for Do Not Track, third-party cookies, and permission prompting.
- An optional global restore shortcut with safe, allow-listed choices and visible registration status.
- Cross-platform Electron Builder configuration for Windows, Linux, and macOS development artifacts.

The primary window can navigate only inside Spartan's private `spartan-app://app` protocol. Cataloged cloud-gaming and browser-game services open in isolated player views, while general external access is restricted to approved gaming-service and download/update origins. Login pages use the provider's own secure forms and session storage; Spartan never receives account passwords or copies provider credentials into its settings.

The global shortcut is disabled by default. Settings → General offers only `CommandOrControl+Shift+G` and `CommandOrControl+Alt+G`; the app reports when another application or the operating system prevents registration. Linux also enables Electron's Wayland Global Shortcuts Portal path.

### Streaming that explains itself

The shared session runtime covers WebRTC signaling, SDP/ICE, media tracks, reconnect envelopes, adaptive bitrate/resolution policy, manual quality ceilings, and capability-aware codec negotiation. The player surfaces RTT, loss, jitter, receive bitrate, decode rate, and dropped frames so quality decisions are visible instead of mysterious.

In-app host workflows include explicit display, system-audio, and microphone consent, device selection, bounded sender controls, and local session handoff. Native-host composition adds guarded capture, encode, RTP packetization, audio, input, and lifecycle boundaries for separately supplied platform adapters.

### Controllers without lock-in

Create persistent controller profiles, remap a stable gaming action vocabulary, tune deadzones, choose rumble behavior, and inspect connected Gamepad/HID capabilities locally. Workspaces can select built-in or custom profiles, while session preflight carries the chosen bindings and capabilities into launch negotiation.

The same model supports keyboard, pointer, gamepad, touch-controller, Android inventory, Steam Input metadata, Steam Deck controls, and future native virtual-gamepad adapters. Physical device and driver support is only marked ready after platform validation.

### Emulation with user ownership at the center

The Emulation Center catalogs popular open-source and user-installed runtimes, including libretro, Dolphin, PCSX2, RPCS3, PPSSPP, DuckStation, Cemu, Vita3K, melonDS, Azahar, MAME, Flycast, xemu, and ScummVM.

In-app WASM adapters receive ephemeral user-selected files and explicit lifecycle controls. Native launch handoffs are shell-free and capability-gated. Spartan Gaming does not ship copyrighted game content, bypass DRM, defeat anti-cheat, or redistribute provider experiences.

### Works online or offline

Spartan Gaming starts and remains useful without an internet connection. The bundled library metadata, settings, controller profiles, diagnostics, workspaces, local launch planning, and locally installed emulation/native-adapter workflows do not depend on a Spartan server. Network-only actions identify themselves as unavailable when the device is offline.

When networking is available, the standalone app connects only for cataloged gaming/streaming services, user-owned gaming sessions, and approved download or update sources. Spartan does not require a hosted website, mandatory account, telemetry endpoint, or always-on vendor backend.

### Optional self-hosted remote play

Spartan's optional host stack provides secure pairing, authenticated signaling contracts, session-scoped STUN/TURN configuration, browser-to-browser LAN streaming, native media/input composition boundaries, Redis-backed signaling options, hardened container templates, and production preflight tooling.

Production relay services, public TLS, TURN capacity, signing-key custody, and native device permissions remain operator-owned deployment gates—not hidden cloud dependencies.

### Settings for the whole system

The Settings control center covers browser behavior, gaming, streaming, controllers, emulation, providers, performance and power, privacy, accessibility, profiles/workspaces, updates, Android policy, SteamOS/Proton launch preferences, host transport, and device presentation. Preferences remain local unless a future sync mechanism is deliberately configured.

## Device-universal direction

| Platform                    | Current project coverage                                                                                | Remaining acceptance gate                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Windows desktop             | Electron development packaging, shared frontend, native package/build contracts                         | Signed installer plus physical capture, input, audio, haptics, and virtual-gamepad validation |
| Linux desktop               | Electron AppImage/Debian development packaging and native Linux contracts                               | Wider distro/hardware coverage and physical `/dev/uinput`/FF validation                       |
| macOS desktop               | Electron development packaging and native package/build contracts                                       | Signed/notarized release and physical platform validation                                     |
| SteamOS / Steam Deck        | Handheld UI, Gamescope/Proton/Steam Input/session-power contracts                                       | Physical Deck and SteamOS hardware testing                                                    |
| Android                     | Shared frontend, touch/controller policy, WebView shell and bounded native bridge; debug APK build path | Physical-device behavior, permissions, release signing, and distribution                      |
| Amazon Fire TV / Fire Stick | Android-derived television presentation and remote-navigation profile                                   | Device testing, native packaging, and store certification                                     |
| Roku                        | Capability-gated television/browser presentation profile                                                | Roku-native packaging/certification or a validated supported web delivery route               |
| ChromeOS                    | Standalone application direction and capability-driven large/small-screen UI contracts                  | Native installation route and physical-device compatibility matrix                            |
| iOS                         | Not targeted                                                                                            | Not planned                                                                                   |

This table describes repository coverage, not a promise that every listed device is release-ready. The [future local validation lab](docs/future-local-validation.md) records the exact hardware evidence still required.

## Build and run the standalone app

Requirements: a supported Node.js/npm environment and the platform prerequisites documented in [CONTRIBUTING.md](CONTRIBUTING.md).

Launch the primary Electron desktop app:

```bash
npm ci
npm run electron
```

Run its focused tests or create development packages:

```bash
npm run electron:test
npm run playwright:electron
npm run desktop:package
```

`npm run electron` launches the bundled application directly. It does not start a local HTTP service. `npm run desktop:package` creates platform development artifacts that contain the application UI and local catalogs.

`npm run playwright:electron` launches the real Electron main process, verifies the private `spartan-app://app` origin, and checks all 11 maintained routes at desktop, Steam Deck-sized handheld, phone, and television layouts. The isolated-state run captures 44 screenshots, verifies each forced presentation/navigation mode, rejects horizontal overflow, exercises dashboard search at every layout, checks television remote focus and a persisted desktop setting, and compares perceptual fingerprints with the reviewed Linux/Xvfb baseline. `npm run playwright:electron:candidate` generates an unapproved candidate under `out/` for deliberate visual changes; inspect it before replacing a baseline.

## Explore the current interfaces

- [Gaming dashboard](src/frontend/dashboard/index.html) — unified discovery, readiness, favorites, and launch handoff.
- [Session player](src/frontend/player/index.html) — stream controls, overlays, capture, quality, reconnect, and live telemetry.
- [Controller profiles](src/frontend/input/profiles.html) and [live inspector](src/frontend/input/inspector.html) — local remapping and capability feedback.
- [Emulation Center](src/frontend/emulation/index.html) — legal user-file launch plans and adapter lifecycle.
- [Host profiles](src/frontend/host/index.html) — validated endpoints, secure pairing handoff, and readiness checks.
- [Compatibility diagnostics](src/frontend/diagnostics/index.html) — local capability probes and redacted reports.
- [Settings](src/frontend/settings/index.html) — the control center for every shared subsystem.

## Verification and honest status

Use the repository checks before treating a change as integrated:

```bash
npm run check
npm run test:serial
npm run playwright:smoke
npm run playwright:electron
```

CI builds and tests development surfaces across its supported runner matrix. The preferred low-cost remote validation environment is documented in [docs/aws-dev-validation.md](docs/aws-dev-validation.md), including setup, evidence locations, cost boundaries, and limitations. Durable agent continuation state lives in [SPARTAN_GAMING_CLI_HANDOFF.md](SPARTAN_GAMING_CLI_HANDOFF.md). The README is maintained as a living product showcase and must be updated alongside verified feature, platform, setup, and acceptance changes.

Public release requires more than green unit tests. Spartan's release gates include repeatable interaction tests, screenshot comparisons, packaged-app visual inspection, controller/keyboard/mouse/touch/remote navigation, offline cold starts, provider login and recovery, accessibility, performance, crash recovery, updates, and real-device evidence for every claimed platform.

Spartan Gaming is in active foundation implementation. The shared frontend, Electron-first shell, Android policy/shell boundaries, controller profiles, provider and emulator catalogs, host control plane, deployment contracts, and diagnostics are implemented and automated-test covered. A checked roadmap item can represent a verified contract or development artifact; it does not replace physical hardware, production deployment, driver, store, signing, or certification evidence where the roadmap calls for it.

## Architecture at a glance

```text
desktop/               Primary Electron shell, runtime policy, packaging, and tests
src/frontend/          Bundled application UI, player, settings, input, diagnostics, and transport
android/               Android shell and bounded native bridge
host/                  Portable host control plane, media/input composition, and pairing
signaling/             Authenticated signaling services and broker contracts
providers/             Machine-readable cloud/streaming provider catalog
emulators/             Machine-readable emulator and core catalog
protocol/              Versioned session schemas and examples
native/                Cross-platform native adapter/package boundaries
scripts/               Build, validation, deployment, Chromium, and release helpers
docker/                Hardened reference-service definitions
docs/                  Architecture, research, decisions, validation, and roadmap evidence
```

Spartan Gaming is the standalone application and orchestration layer. Providers, stores, emulators, games, drivers, and operating-system services remain their own execution backends. Integrations use official interfaces, documented protocols, capability-gated adapters, or user-owned local installations.

Read [the architecture](docs/architecture.md), [development guide](docs/development.md), [roadmap](ROADMAP.md), and [contributor guide](CONTRIBUTING.md) to go deeper.

## Principles

- Open source and auditable by default.
- No mandatory account or telemetry.
- No DRM circumvention, anti-cheat bypass, or unauthorized game distribution.
- Explicit permission for controllers, microphones, cameras, screen capture, remote input, and native adapters.
- Local-first settings and redacted diagnostics.
- Reproducible builds, bounded platform bridges, and fail-closed capability reporting.
- Self-hosting remains a first-class option.
- Nothing is called platform-complete without the required real-world evidence.

## Help build the ultimate gamer program

Spartan Gaming is ambitious by design. Contributions are welcome across desktop UX, accessibility, controller databases, provider compatibility, emulation adapters, streaming quality, native platform integration, Android/TV experiences, SteamOS, testing, security, documentation, and reproducible release engineering.

Start with [CONTRIBUTING.md](CONTRIBUTING.md), choose an open item from [ROADMAP.md](ROADMAP.md), and keep every capability claim tied to reproducible evidence.

## License

Spartan Gaming project code is licensed under the Apache License 2.0. Chromium and other dependencies retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
