# Chromium build foundation

Spartan Gaming does not vendor Chromium. The Chromium source checkout and
`depot_tools` remain outside this repository so upstream dependencies, source
history, and generated build output do not enter the product repository.

The tracked [build manifest](build-manifest.json) records the source policy,
desktop targets, integration entry points, and development GN templates. The
Chromium branch is intentionally unselected until the project agrees on a
branch-head/rebase policy; no patch series should claim to be a complete
Chromium fork before that decision is recorded.

## Prepare a checkout

Install the platform prerequisites from the official Chromium build guide and
place `depot_tools` on `PATH`. Then fetch Chromium into a separate directory:

```text
fetch chromium
gclient sync
```

Set `SPARTAN_CHROMIUM_SRC` to the external checkout's `src` directory and run:

```bash
node scripts/chromium/check-environment.mjs --platform linux
```

The same command works with `--platform mac` or `--platform windows`. Add
`--strict` when a machine must be build-ready; normal validation reports
missing local tools without making CI depend on a full Chromium toolchain.

## Generate and build

The repository now provides a plan-first bootstrap that selects the manifest
target, validates its GN template, and emits fixed `gn`/`autoninja` argument
arrays. Set `SPARTAN_CHROMIUM_SRC` or pass `--source`:

```bash
npm run chromium:build -- --platform linux --source "$SPARTAN_CHROMIUM_SRC"
npm run chromium:build -- --platform linux --source "$SPARTAN_CHROMIUM_SRC" --execute
```

The first command is a safe plan-only preview; `--execute` is required before
the external checkout is modified. The same command accepts `mac` and
`windows`, and `--json` produces machine-readable build metadata. On Windows,
run it from the Visual Studio developer shell. On macOS, choose
`target_cpu = "arm64"` or `target_cpu = "x64"` explicitly for the intended
artifact. Universal packaging is a release-pipeline concern and must produce
separately validated binaries.

Initial integration gates are browser shell branding, dashboard navigation,
controller permissions, fullscreen/Pointer Lock/Keyboard Lock, hardware
decode reporting, and the diagnostics overlay. The frontend can be developed
and tested independently while those gates are being integrated into Chromium.
