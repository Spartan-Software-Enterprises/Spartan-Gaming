# Spartan Gaming

Spartan Gaming is an open-source, cross-platform Chromium-based gaming frontend for cloud gaming, game streaming, browser games, emulation, controllers, and low-latency media.

> Early project notice: the repository currently contains project planning and engineering foundations. The Chromium fork and streaming implementation will be introduced incrementally.

## Vision

Build a fast, privacy-respecting gaming browser that works across desktop, mobile, handheld, television, and cloud-hosted environments while remaining compatible with the open web.

## Planned platform targets

- Windows
- macOS
- Linux
- ChromeOS
- Android
- Amazon Fire TV / Fire Stick
- Roku TV / Roku streaming devices
- Additional Chromium-supported platforms where the product experience is practical

## Initial priorities

1. Cross-platform Chromium build and release pipeline.
2. A unified library and launcher for providers, emulators, browser games, and local games.
3. One controller, fullscreen, overlay, recording, and diagnostics experience.
4. Low-latency WebRTC streaming client with optional self-hosted host support.
5. Reproducible builds, privacy controls, and a sustainable Chromium rebase process.

Spartan Gaming is the frontend and orchestration layer. Providers and emulator projects remain the execution backends; integrations use official interfaces, documented protocols, or user-owned local installations.

## Repository layout

```text
docs/                 Architecture, decisions, roadmap, and research
docker/               Hardened reference-service container definitions
protocol/              Versioned streaming protocol notes and schemas
providers/             Machine-readable cloud gaming and streaming provider catalog
emulators/             Machine-readable emulator and core catalog
scripts/               Reproducible development and release helpers
src/                   Spartan browser product code (planned)
src/frontend/          Catalog, dashboard, player, settings, diagnostics, input, and transport contracts
server/                Optional self-hosted services (planned)
host/                  Portable reference host control plane and pairing authority
third_party/           Third-party notices and integration metadata
```

## Building and remote validation

Run the frontend locally from a real HTTP origin with:

```bash
npm run frontend:serve
```

Then open `http://127.0.0.1:4173/`. The dependency-free server exposes the
dashboard, all frontend surfaces, and the public provider/emulator catalogs.
Create a deployable static distribution with `npm run frontend:build`; it is
written to `out/spartan-frontend` and includes a generated
`spartan-frontend-manifest.json`.
The first milestone will document the supported Chromium checkout and build
configuration. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/architecture.md](docs/architecture.md).

The preferred validation environment is the low-cost Amazon Linux development
host documented in [docs/aws-dev-validation.md](docs/aws-dev-validation.md).
That runbook includes the complete connection metadata, setup commands,
service boundaries, evidence locations, and platform limitations. The current
agent continuation state is maintained in
[SPARTAN_GAMING_CLI_HANDOFF.md](SPARTAN_GAMING_CLI_HANDOFF.md).
The future physical-device and signing requirements are listed in the
[local validation lab runbook](docs/future-local-validation.md).

## Project principles

- Open source and auditable by default.
- No mandatory account or telemetry.
- No DRM circumvention or unauthorized game distribution.
- Explicit permissions for controllers, microphones, cameras, screen capture, and remote input.
- Upstream Chromium contributions where practical.
- Self-hosting remains a first-class option.

## Status

Spartan Gaming is in the foundation and architecture phase. The shared
frontend, Electron-first desktop shell, Android policy surface, controller
profiles, provider/emulator catalogs, host control plane, and diagnostics
contracts are implemented and covered by automated tests. Follow
[ROADMAP.md](ROADMAP.md) for the current sequence of work and its explicit
external acceptance gates. No platform or device is called complete without
the corresponding real hardware, driver, signing, or production evidence.

Interactive frontend surfaces include the [gaming dashboard](src/frontend/dashboard/index.html), which merges provider, emulator, and browser-game catalogs into one searchable library; the [session player](src/frontend/player/index.html), with stream, overlay, quality, reconnect, capture, controller, and live RTT/loss/decode/jitter/bitrate diagnostics; the [controller profile manager](src/frontend/input/profiles.html), with persistent remapping and deadzone controls; the [host profile manager](src/frontend/host/index.html), with secure endpoint validation and one-time pairing handoff; the [emulation center](src/frontend/emulation/index.html), with core metadata and legal user-file launch plans; the [compatibility diagnostics center](src/frontend/diagnostics/index.html), with local capability probing and redacted reports; and the [settings control center](src/frontend/settings/index.html), covering browser, gaming, streaming, controllers, emulation, providers, performance, privacy, accessibility, profiles, and updates. Browser-game catalog entries are HTTPS-only official links: Spartan Gaming launches them in a normal web context and does not mirror, redistribute, or inject into their content.

## License

Spartan Gaming project code is licensed under the Apache License 2.0. Chromium and other dependencies retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
