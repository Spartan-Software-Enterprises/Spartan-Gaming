# Contributing to Spartan Gaming

Thanks for contributing. The project is currently establishing its architecture and cross-platform build foundation.

## Before opening an issue

- Search existing issues and discussions.
- Include the OS, device, GPU, browser build, provider or game, and reproduction steps.
- For streaming issues, include resolution, framerate, codec, network type, latency, jitter, and packet loss when available.
- Do not include credentials, private stream URLs, or personal data.

## Before opening a pull request

- Keep changes focused and explain the user impact.
- Add or update tests where practical.
- Document platform-specific behavior.
- Preserve Chromium and third-party license notices.
- Do not add telemetry, privileged permissions, or remote-input behavior without an architecture and security review.

## Development

The Chromium checkout and `depot_tools` are managed outside this repository.
Read [the Chromium build foundation](chromium/README.md), set
`SPARTAN_CHROMIUM_SRC`, and run `npm run chromium:environment` before working
on browser-shell integration. The check is report-only by default; use
`--strict` on a build machine. Keep changes portable across Windows, macOS,
and Linux and never commit Chromium source or generated `out/` directories.

Run `npm test` for the dependency-free contract suite and `npm run check` for
repository validation. Chromium itself is built with GN and `autoninja` from
the external checkout.

The shared contract suite runs in CI on Ubuntu/Linux, macOS, and Windows.
Keep platform-specific behavior behind the documented adapter boundaries and
run `npm run chromium:validate -- --platform <linux|mac|windows>` when
checking a target template locally. The report-only validation does not
require a Chromium checkout; `--strict` is reserved for a configured build
machine.

## Commit guidance

Use concise imperative subjects, for example:

```text
Add stream session architecture notes
```

## Synchronized Android and desktop release gate

Android and desktop releases are one release unit. Every release candidate must use the same tag and version, run the complete shared verification suite on both platform paths, and publish only after both platform jobs pass. The shared gate includes formatting, repository checks, the full contract suite, serial tests, Electron tests, Android shell tests, frontend build, Playwright smoke, deep provider flow, and full visual verification. Platform-specific signing, packaging, install, and runtime checks are additional gates; they never replace the shared suite. Release assets use Spartan-Gaming-<version>-... names and must not use generic names such as app-release.apk.
