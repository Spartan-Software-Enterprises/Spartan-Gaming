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

