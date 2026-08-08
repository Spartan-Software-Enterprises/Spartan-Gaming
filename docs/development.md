# Development guide

## Repository stages

Spartan Gaming is deliberately being built in layers:

1. Repository contracts and cross-platform architecture.
2. Protocol and diagnostic libraries that can be tested without Chromium.
3. A thin browser shell and provider-compatible gaming dashboard.
4. Chromium integration and platform adapters.
5. Self-hosted host and service implementations.

This keeps protocol and product behavior testable while Chromium builds are being rebased and packaged.

## Chromium strategy

The Chromium checkout should live outside this repository or in a separately managed source workspace. Spartan Gaming changes should be kept as a small, reviewable patch series or overlay until the project has a stable rebase process. Do not vendor a full Chromium checkout into this repository.

The first Chromium integration should prove:

- Browser shell branding and build identity.
- Gaming dashboard navigation.
- Controller permission and profile UX.
- Fullscreen, Pointer Lock, and Keyboard Lock behavior.
- Hardware video decode reporting.
- Stream diagnostics and overlay lifecycle.

The tracked Chromium build contract lives in `chromium/build-manifest.json`.
Development follows upstream `refs/heads/main`; release work pins a stable
branch-head commit according to [ADR 0002](decisions/0002-chromium-and-repository-boundaries.md).
`chromium/args/` contains development templates for Linux, macOS,
and Windows; these are inputs to an external checkout, not standalone GN
projects. Validate a workstation with `npm run chromium:environment` or use
`npm run chromium:validate -- --strict` for a Linux build gate.

The upstream workflow is `fetch chromium`, `gclient sync`, followed by the
repository's plan-first `npm run chromium:build -- --platform <target>`
bootstrap. Add `--execute` only on a configured external checkout; the script
then runs `gn gen` and `autoninja -C ... chrome` with fixed argument arrays.
Platform-specific prerequisites and signing steps remain owned by Chromium's
current build documentation and must be rechecked when the branch is selected.

## Platform gates

Every platform feature must document:

- Shared behavior and native adapter.
- Required permissions or entitlements.
- Hardware acceleration assumptions.
- Packaging and signing requirements.
- Automated and manual validation coverage.

## Local checks

Run the dependency-free frontend server to use the dashboard and its related
surfaces from a real HTTP origin (required for fetch, service workers, and
browser permissions):

```bash
npm run frontend:serve
```

Open `http://127.0.0.1:4173/`. The server redirects `/` to `/dashboard/`,
serves the frontend pages and public catalogs, applies restrictive browser
security headers while allowing official HTTPS provider frames and secure
signaling, and keeps arbitrary signaling/session paths out of its static
surface. Use `--port 0` for an ephemeral port or
`--host 0.0.0.0` when testing from another device on a trusted LAN. This is a
development/static frontend server, not a production TLS or authentication
endpoint.

The same server can preview a packaged artifact with
`npm run frontend:serve -- --root out/spartan-frontend --public-root out/spartan-frontend`.
When no root is supplied it serves the repository source tree and public
catalog directories.

Build the same surfaces into a portable static artifact with:

```bash
npm run frontend:build
```

The default output is `out/spartan-frontend`. It contains the canonical page
mounts, PWA worker/assets, public provider and emulator catalogs, favicon, and
`spartan-frontend-manifest.json`. The build refuses to write into the source or
repository root and does not include host secrets, credentials, or game files.

GitHub Actions packages and verifies that artifact independently on Linux,
macOS, and Windows, then retains one OS-labeled artifact for fourteen days.
This validates the shared frontend distribution boundary across desktop hosts;
it does not substitute for building the external Chromium checkout, which
still requires the platform toolchains described in the Chromium section.

For a local browser-to-browser stream smoke test, run:

```bash
npm run lan:demo
```

The coordinator starts the frontend server and an ephemeral authenticated
signaling service, then prints the host-studio URL, player URL, session ID, and
short-lived role tickets. Enter the host values in one localhost tab, choose a
display, and enter the client values in a second tab. This exercises browser
display capture, signaling, SDP/ICE, and WebRTC media locally; it does not
launch games or inject native input. Tickets are printed for the local
operator and are intentionally not placed in URLs.

Run the repository checks before committing:

```bash
./scripts/check-repository.sh
```

GitHub Actions also runs the dependency-free contract suite on Linux, macOS,
and Windows. This catches platform-neutral frontend, protocol, catalog, and
settings regressions without requiring a full Chromium checkout on every
runner. The Chromium target templates are validated with
`npm run chromium:validate -- --platform <linux|mac|windows>` in the same
matrix; strict tool and checkout checks remain opt-in for local build hosts.

The frontend catalog contract can be tested independently of Chromium:

```bash
npm test
```

The catalog loader is intentionally dependency-free. Browser UI code, native adapters, and future service processes can consume the same normalized backend entries without importing provider-specific UI behavior.

Session capability negotiation and lifecycle behavior are covered by `src/frontend/session/session.test.mjs`. Adapter implementations should use the registry and protocol envelope helpers rather than inventing provider-specific state transitions in UI code.

The player derives bounded session capabilities and streaming preferences from `src/frontend/session/preferences.mjs`. Resolution, framerate, codec order, HDR, bitrate, adaptive behavior, jitter buffering, hardware decode preference, and controller permissions are included in the session offer; a host may negotiate a lower compatible profile.

Session answers carrying remote `capabilities` are negotiated against the client offer before the lifecycle enters `connected`. The normalized result is available as `manager.negotiated`; incompatible transports, codecs, or audio formats emit a structured runtime error and keep the session out of `connected`.

The first frontend surfaces are available at `src/frontend/dashboard/index.html`, `src/frontend/player/index.html`, and `src/frontend/settings/index.html`. The dashboard is a dependency-free, responsive library shell that loads the provider and emulator manifests, supports search, filters, favorites, recent launches, and launch/setup actions, and hands sessions to the player. The player provides the stream video target, session overlay, diagnostics, quality state, fullscreen, bounded reconnect control, and controller hooks. Reconnect envelopes carry an attempt number and delay plan; a host/signaling adapter should resume the existing session and return a normal `session.answer`. Settings are normalized through `src/frontend/settings/profile.mjs`, which provides bounded local persistence and portable import/export without unknown keys or session secrets; the player consumes the same normalized settings for transport policy. Chromium integration will connect these surfaces to browser preferences, profiles, provider sessions, and native adapters as those services land.

For a live signaling session, open the player with a `signal=wss://...` query parameter. The player creates the WebSocket signaling transport, adds WebRTC when the browser exposes `RTCPeerConnection`, and uses the session runtime bridge for offer/answer, ICE, media tracks, telemetry, reconnect, and input. Without `signal`, the player stays in its local demo mode.

For a local control-plane smoke test, run `npm run host -- --pairing-code ABCD23`. Register `ws://127.0.0.1:8787/session` in the host manager, enter `ABCD23`, and choose **Connect in player**. The reference agent proves endpoint, pairing, and session-envelope behavior; it intentionally does not provide media until a platform capture/encode adapter is installed.

The reference signaling service has a real network contract test in `signaling/agent.integration.test.mjs`. It starts an ephemeral service, issues role-scoped tickets, connects client and host WebSocket participants, routes an offer/answer pair, and verifies redacted health counters. Run `npm run signaling -- --secret local-development-only --port 8790` for a local service; production deployments still require TLS, secret management, clustered session storage, and separately provisioned STUN/TURN.

The Host Profiles health action uses `src/frontend/host/readiness.mjs` to classify the host’s media capture, encoding, publisher, audio, input, and transport checks. A host can be paired for control-plane testing while the preflight still correctly reports `configuration-required` until media publishing is ready.

Native process ownership is isolated in `host/process.mjs`. `createManagedProcess` starts only validated `shell: false` plans, bounds retained output, and provides graceful termination; `createProcessPipeline` starts plans in order and rolls back already-started members on failure. `host/native-media.mjs` connects a capture process stream to an encoder process stream and exposes encoded output to `createEncodedMediaPublisher`, whose injected sink is the deliberate handoff for RTP/WebRTC or another adapter. The executable coverage in `host/process.integration.test.mjs`, `host/native-media.integration.test.mjs`, and `host/publisher.integration.test.mjs` uses real Node child processes on every CI platform. Capture/encode-to-WebRTC track publication remains a separate adapter milestone.

The signaling contract is covered by `signaling/broker.mjs`. It can be embedded
behind a WebSocket or WebTransport server with a deployment-owned secret;
`npm test` exercises scoped ticket issuance, role authorization, message size
limits, duplicate-role rejection, routing, and cleanup. It is not a public
relay or a substitute for STUN/TURN.

The player’s fullscreen control uses `src/frontend/player/immersive.mjs` to request fullscreen, Pointer Lock, and Keyboard Lock from the same user gesture when supported. Optional permission failures are tolerated so browsers with stricter site policies still retain fullscreen playback.

Gaming workspaces are stored locally through `src/frontend/workspaces/workspaces.mjs`. The workspace manager isolates launch behavior, quality, controller profile, and overlay defaults; exports contain only workspace preferences and never provider credentials, cookies, ROMs, or save data. The management surface is `src/frontend/workspaces/index.html` and is linked from Settings → Profiles & sync.

Frontend pages register `src/frontend/pwa/service-worker.mjs` when served over HTTP(S). The service worker pre-caches the shell and public provider/emulator catalogs, updates same-origin documents/scripts/styles, and explicitly excludes signaling, session, and API paths. It is an offline shell enhancement, not a cache for credentials or game streams.

Controller profiles are managed at `src/frontend/input/profiles.html`. The live controller tester is `src/frontend/input/inspector.html`; it reports normalized buttons, axes, haptics, battery metadata, and approved HID devices locally. Profiles are persisted locally, validate duplicate bindings before save, and share the same stable action vocabulary with the session player and future native input adapters.

Session input permissions are enforced by `src/frontend/input/policy.mjs` as well as advertised during capability negotiation. The player does not poll or forward disabled gamepad input, and input diagnostics distinguish a disconnected controller from one disabled by the active settings profile.

Host-issued rumble events use `src/frontend/input/haptics.mjs` to request bounded `dual-rumble` effects on the selected browser gamepad. Unsupported actuators, denied settings, and rejected browser promises fail closed without affecting the session.

The player forwards normalized mouse and touch pointer events through `src/frontend/input/pointer.mjs`. Coordinates are relative to the stream viewport, movement deltas are bounded, pointer capture is used for drag/look continuity, and `touch-action` is disabled on the session stage so touch controls do not scroll the page.

The dashboard starts `src/frontend/input/navigation.mjs` when available. The navigator moves focus spatially with a D-pad or analog stick, activates the focused control with the primary button, and uses the secondary button for browser back navigation. It does not intercept input when no gamepad is connected.

Compatibility diagnostics are available at `src/frontend/diagnostics/index.html`. The probe runs locally, checks browser media/graphics/input/transport capabilities, and exports only a redacted report without credentials, cookies, endpoints, or platform identity details.

The diagnostics center also queries `MediaCapabilities.decodingInfo()` per video codec with a hardware preference. It records support, smoothness, and power-efficiency signals without claiming hardware decode when the browser cannot provide evidence.

The dashboard runs `src/frontend/compatibility/harness.mjs` after loading catalogs. Each entry is classified as browser-ready, setup-required, capability-missing, or native-adapter-required using the local diagnostics report; account, host, and pairing requirements remain explicit configuration rather than being treated as browser support. `src/frontend/adapters/adapters.mjs` consumes that same live report when resolving a launch plan, so cards and launch actions expose the appropriate next step (official service, diagnostics, host setup, or runtime selection) instead of claiming unsupported readiness.

Provider preferences are managed at `src/frontend/providers/index.html`. `src/frontend/providers/profiles.mjs` stores only account labels, region hints, quality, launch mode, fullscreen preference, and private notes; it intentionally has no credential or cookie fields. External provider/API handoffs open the official surface directly and do not create a false Spartan session; only user-owned host and future native/session adapters enter the Spartan session lifecycle.

Transport adapters are covered by `src/frontend/transport/transport.test.mjs` with injected WebSocket and RTCPeerConnection fakes, so signaling and offer/answer behavior can be verified without a live host or relay.

Local capture primitives are in `src/frontend/capture/capture.mjs`. Screenshots use a video frame and Canvas; recordings use MediaRecorder with WebM MIME fallback. No capture data is uploaded by the frontend.

The emulation center is available at `src/frontend/emulation/index.html`. It reads the versioned core catalog, accepts only explicit user-selected game and firmware files, and produces a runtime launch plan without reading or distributing content outside the browser file selection boundary.
