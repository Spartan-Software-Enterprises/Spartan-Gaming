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

## Platform gates

Every platform feature must document:

- Shared behavior and native adapter.
- Required permissions or entitlements.
- Hardware acceleration assumptions.
- Packaging and signing requirements.
- Automated and manual validation coverage.

## Local checks

Run the repository checks before committing:

```bash
./scripts/check-repository.sh
```

The frontend catalog contract can be tested independently of Chromium:

```bash
npm test
```

The catalog loader is intentionally dependency-free. Browser UI code, native adapters, and future service processes can consume the same normalized backend entries without importing provider-specific UI behavior.

Session capability negotiation and lifecycle behavior are covered by `src/frontend/session/session.test.mjs`. Adapter implementations should use the registry and protocol envelope helpers rather than inventing provider-specific state transitions in UI code.

The first frontend surfaces are available at `src/frontend/dashboard/index.html`, `src/frontend/player/index.html`, and `src/frontend/settings/index.html`. The dashboard is a dependency-free, responsive library shell that loads the provider and emulator manifests, supports search, filters, favorites, and launch/setup actions, and hands sessions to the player. The player provides the stream video target, session overlay, diagnostics, quality state, fullscreen, bounded reconnect control, and controller hooks. Reconnect envelopes carry an attempt number and delay plan; a host/signaling adapter should resume the existing session and return a normal `session.answer`. The settings prototype is backed by `settings-data.mjs`, with local persistence and export behavior. Chromium integration will connect these surfaces to browser preferences, profiles, provider sessions, and native adapters as those services land.

For a live signaling session, open the player with a `signal=wss://...` query parameter. The player creates the WebSocket signaling transport, adds WebRTC when the browser exposes `RTCPeerConnection`, and uses the session runtime bridge for offer/answer, ICE, media tracks, telemetry, reconnect, and input. Without `signal`, the player stays in its local demo mode.

The player’s fullscreen control uses `src/frontend/player/immersive.mjs` to request fullscreen, Pointer Lock, and Keyboard Lock from the same user gesture when supported. Optional permission failures are tolerated so browsers with stricter site policies still retain fullscreen playback.

Gaming workspaces are stored locally through `src/frontend/workspaces/workspaces.mjs`. The workspace manager isolates launch behavior, quality, controller profile, and overlay defaults; exports contain only workspace preferences and never provider credentials, cookies, ROMs, or save data. The management surface is `src/frontend/workspaces/index.html` and is linked from Settings → Profiles & sync.

Controller profiles are managed at `src/frontend/input/profiles.html`. The live controller tester is `src/frontend/input/inspector.html`; it reports normalized buttons, axes, haptics, battery metadata, and approved HID devices locally. Profiles are persisted locally, validate duplicate bindings before save, and share the same stable action vocabulary with the session player and future native input adapters.

The dashboard starts `src/frontend/input/navigation.mjs` when available. The navigator moves focus spatially with a D-pad or analog stick, activates the focused control with the primary button, and uses the secondary button for browser back navigation. It does not intercept input when no gamepad is connected.

Compatibility diagnostics are available at `src/frontend/diagnostics/index.html`. The probe runs locally, checks browser media/graphics/input/transport capabilities, and exports only a redacted report without credentials, cookies, endpoints, or platform identity details.

The diagnostics center also queries `MediaCapabilities.decodingInfo()` per video codec with a hardware preference. It records support, smoothness, and power-efficiency signals without claiming hardware decode when the browser cannot provide evidence.

Transport adapters are covered by `src/frontend/transport/transport.test.mjs` with injected WebSocket and RTCPeerConnection fakes, so signaling and offer/answer behavior can be verified without a live host or relay.

Local capture primitives are in `src/frontend/capture/capture.mjs`. Screenshots use a video frame and Canvas; recordings use MediaRecorder with WebM MIME fallback. No capture data is uploaded by the frontend.

The emulation center is available at `src/frontend/emulation/index.html`. It reads the versioned core catalog, accepts only explicit user-selected game and firmware files, and produces a runtime launch plan without reading or distributing content outside the browser file selection boundary.
