# Spartan Gaming

Spartan Gaming is an open-source, cross-platform Chromium-based browser focused on cloud gaming, game streaming, browser games, controllers, and low-latency media.

> Early project notice: the repository currently contains project planning and engineering foundations. The Chromium fork and streaming implementation will be introduced incrementally.

## Vision

Build a fast, privacy-respecting gaming browser that works across desktop, mobile, handheld, television, and cloud-hosted environments while remaining compatible with the open web.

## Planned platform targets

- Windows
- macOS
- Linux
- ChromeOS
- Android
- iOS/iPadOS, subject to Apple platform and browser-engine requirements
- Additional Chromium-supported platforms where the product experience is practical

## Initial priorities

1. Cross-platform Chromium build and release pipeline.
2. Gaming dashboard, profiles, fullscreen mode, and controller-first navigation.
3. Low-latency WebRTC streaming client with diagnostics.
4. Optional self-hosted host agent and signaling service.
5. Reproducible builds, privacy controls, and a sustainable Chromium rebase process.

## Repository layout

```text
docs/                 Architecture, decisions, roadmap, and research
protocol/              Versioned streaming protocol notes and schemas
scripts/               Reproducible development and release helpers
src/                   Spartan browser product code (planned)
server/                Optional self-hosted services (planned)
host/                  Optional gaming host agent (planned)
third_party/           Third-party notices and integration metadata
```

## Building

The first milestone will document the supported Chromium checkout and build configuration. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/architecture.md](docs/architecture.md).

## Project principles

- Open source and auditable by default.
- No mandatory account or telemetry.
- No DRM circumvention or unauthorized game distribution.
- Explicit permissions for controllers, microphones, cameras, screen capture, and remote input.
- Upstream Chromium contributions where practical.
- Self-hosting remains a first-class option.

## Status

Spartan Gaming is in the foundation and architecture phase. Follow [ROADMAP.md](ROADMAP.md) for the current sequence of work.

## License

Spartan Gaming project code is licensed under the Apache License 2.0. Chromium and other dependencies retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

