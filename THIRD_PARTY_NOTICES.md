# Third-party notices

Spartan Gaming is built around Chromium and will include additional open-source dependencies as implementation proceeds.

Chromium source and dependencies retain their respective licenses and notices. This file will be expanded from the dependency inventory during the first Chromium import and release build.

## Bundled desktop runtimes

The Linux desktop bundle vendors release artifacts from the upstream projects
listed in `vendor/emulators/runtime-manifest.json`. Every downloaded artifact
is verified by `vendor/emulators/SHA256SUMS`.

- [Chromium runtime](https://github.com/CloakHQ/CloakBrowser/releases)
- [PCSX2](https://github.com/PCSX2/pcsx2/releases), [PPSSPP](https://github.com/hrydgard/ppsspp/releases), [DuckStation](https://github.com/stenzek/duckstation/releases), [Vita3K](https://github.com/Vita3K/Vita3K/releases)
- [melonDS](https://github.com/melonDS-emu/melonDS/releases), [Azahar](https://github.com/azahar-emu/azahar/releases), [MAME](https://github.com/mamedev/mame/releases), [xemu](https://github.com/xemu-project/xemu/releases)
- [Ruffle](https://github.com/ruffle-rs/ruffle/releases), [DOSBox Staging](https://github.com/dosbox-staging/dosbox-staging/releases)

Wine and PlayOnLinux are installed from the Linux distribution package
manager and are declared as Linux installer dependencies.
