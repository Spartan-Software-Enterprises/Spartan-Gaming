# Emulation support

Spartan Gaming will provide a unified, controller-first emulation experience while keeping emulator cores modular and legally distributable.

## Strategy

### Browser-native emulation

Use WebAssembly/WebGPU for lightweight systems and selected cores where performance, threading, storage, input, and licensing are practical:

- Atari, Arcade, NES, SNES, Master System, Genesis/Mega Drive, Game Boy, Game Boy Color, Game Boy Advance.
- Selected PC-98, DOS, ScummVM, Doom-engine, and other preservation-focused runtimes.
- Libretro cores compiled for WebAssembly where the core and assets permit redistribution.

Browser-native emulation gets instant launch, save-state backup, touch controls, shareable sessions, and cloud-save integration. It must run in a dedicated sandboxed game process or worker and never receive filesystem access beyond an explicit user-selected library.

### Native emulation

Use signed, platform-specific emulator adapters for demanding systems and features that browsers cannot provide reliably:

- Dolphin for GameCube and Wii.
- PCSX2 for PlayStation 2.
- RPCS3 for PlayStation 3.
- PPSSPP for PSP.
- DuckStation for PlayStation 1.
- melonDS for Nintendo DS.
- Azahar for Nintendo 3DS.
- xemu for original Xbox.
- MAME and FBNeo for arcade preservation.
- Flycast for Dreamcast/Naomi/Atomiswave.
- Flycast, DOSBox, ScummVM, and other focused preservation runtimes as compatible.

Native adapters should expose the same Spartan session contract: launch, pause, resume, stop, controller mapping, save-state metadata, screenshots, recording, telemetry, achievements where supported, and clean exit.

### Libretro integration

Libretro is the preferred common core boundary for systems that benefit from a unified frontend. The API provides common audio, video, and input callbacks, and the reference frontend is RetroArch. Spartan Gaming should implement a minimal, browser-friendly libretro host rather than embedding the full RetroArch UI into every platform. See the [Libretro core development documentation](https://docs.libretro.com/development/cores/developing-cores/) and [frontend documentation](https://docs.libretro.com/development/frontends/).

The libretro adapter must support:

- Core discovery and signed manifests.
- Controller profiles and per-core overrides.
- Audio/video/input callbacks.
- Save RAM and save-state lifecycle.
- Rewind and fast-forward where supported.
- Shaders and integer scaling.
- Netplay only when the core and legal use case support it.
- Core version pinning and rollback.
- Sandboxed file mounts.

## Emulator catalog

The first user-facing emulation center is available at `src/frontend/emulation/index.html`. It loads this catalog, shows runtime/license metadata, accepts explicit local game and firmware selections, and creates launch plans without uploading or bundling content.

`src/frontend/emulation/integration.mjs` resolves each catalog entry into a runtime plan: browser-WASM candidate, Libretro core host, or signed native adapter. It also declares renderer, controller, save-state, shader, rewind, touch, netplay-candidate, and firmware requirements. A launch plan fails closed when a core declares firmware requirements and the user has not selected firmware; the frontend never downloads or distributes ROMs, BIOS, keys, or firmware.

`src/frontend/adapters/manifest-registry.mjs` provides the trust boundary for
future installed cores and native adapters. Manifests require version, license,
platform, capability, and SHA-256 integrity metadata. Signed records resolve as
ready; unsigned records resolve only when an explicit development override is
enabled, and blocked or mismatched records cannot become launch authority. The
WebCrypto verifier supports the registry's declared ECDSA P-256 and RSA-PSS
SHA-256 signature formats.

| Project | Systems | Preferred mode | Role |
| --- | --- | --- | --- |
| RetroArch/libretro | Many classic and modern systems | Browser/native | Unified frontend and core ecosystem |
| Dolphin | GameCube, Wii | Native | High-quality standalone adapter; optional libretro path |
| PCSX2 | PlayStation 2 | Native | High-performance standalone adapter |
| RPCS3 | PlayStation 3 | Native | Advanced desktop/handheld adapter |
| PPSSPP | PSP | Browser/native | Strong cross-platform candidate; no PSP BIOS required for normal operation |
| DuckStation | PlayStation 1 | Native | Accuracy-focused adapter |
| melonDS | Nintendo DS | Native/WASM candidate | Dual-screen and touch-aware adapter |
| Azahar | Nintendo 3DS | Native | Current 3DS-focused adapter; platform and license review required |
| MAME / FBNeo | Arcade | Browser/native | Preservation and arcade catalog support |
| Flycast | Dreamcast, Naomi, Atomiswave | Native/WASM candidate | Arcade and sixth-generation support |
| xemu | Original Xbox | Native | Desktop adapter subject to performance testing |
| ScummVM | Adventure-game engines | Browser/native | Excellent preservation-focused web target |

## UX features

- Universal game library scan from user-selected folders.
- Per-system and per-game launch profiles.
- Controller auto-configuration.
- Touch overlays for handheld and mobile targets.
- Save RAM, save states, screenshots, clips, and rewind.
- Integer scaling, aspect-ratio correction, shaders, CRT filters, and color controls.
- Per-game resolution, frame pacing, audio latency, and synchronization settings.
- Fast-forward, slow motion, pause, reset, and soft/hard power controls.
- Memory-card and virtual-storage management.
- BIOS/firmware import wizard with hash verification.
- Compatibility database links.
- Netplay and local multiplayer where supported.
- Accessibility remapping and assistive input.
- Stream an emulated session through the Spartan streaming stack.

## Legal and security rules

- Ship emulator code only under its compatible upstream license.
- Do not ship copyrighted ROMs, ISOs, game files, console keys, or BIOS dumps.
- Do not download copyrighted game files or firmware from unofficial sources.
- Allow users to select or dump their own legally obtained files.
- Show the license and source attribution for every bundled core.
- Isolate each core and restrict its file mounts.
- Verify core and adapter signatures before loading.
- Keep save data separate from game images and provider credentials.
- Provide a clear removal/export path for user data.
The Emulation Center remembers only safe file metadata (name, type, size, and
modified time) in local browser storage so a user's collection survives a page
reload. It never stores file contents, ROMs, BIOS data, or launch authority.
Remembered entries are explicitly marked for re-selection; a launch still
requires the user to choose the file again in the current session.
