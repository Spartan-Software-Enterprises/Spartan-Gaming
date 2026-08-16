# Spartan Gaming Agent Handoff

Updated: 2026-08-16

## Canonical state

- Repository: `Spartan-Software-Enterprises/Spartan-Gaming`
- KVM checkout: `/home/ubuntu/Spartan-Gaming`
- Branch: `main`; HEAD: 6bc8498- Working tree: clean and synchronized with `origin/main`
- Latest release: `v0.1.0-beta.9` (published prerelease; signed APK and Linux desktop packages verified)

## Verification evidence (beta.9)

- `npm test`: 879 tests; 873 passed, 1 failed (test env issue), 5 skipped
- `npm run electron:test`: 57 passed, 0 failed.
- `npm run test:android-shell`: 5 passed.
- `npm run format:check`: passed (Prettier + ktfmt).
- `npm run check`: passed.
- `npm run playwright:smoke`: 22 viewports pass (11 routes × desktop/mobile); 0 page errors, 0 console errors, 0 horizontal overflow.
- `scripts/playwright/providers-deep.mjs`: full provider flow pass at desktop + mobile (28 providers render, editor populates, save/persist, cross-route, no errors).
- WebView compatibility fixes: `Object.hasOwn` → `hasOwnProperty.call`, `replaceAll` → regex global (9 files).
- Android 16 (API 36, Chrome 133 WebView): app launches, 28 providers render, editor opens, no errors.
- Android 13 (API 33, Chrome 101 WebView): app launches, 28 providers render, editor opens, no errors.
- Signed APK built: minSdk 33, targetSdk 36, catalogs as files, apksigner v2 SHA-256 `2b811bac...`. Installed and launching cleanly on both emulators.

## Android compatibility

- minSdk 33 (Android 13 "Tiramisu")
- targetSdk 36 (Android 16 "Baklava")
- compileSdk 36
- Tested on emulators: API 33 (Chrome 101 WebView), API 36 (Chrome 133 WebView)
- WebView API compatibility: Chrome 101+ supports `Object.hasOwn` and `String.replaceAll`; defensive fixes applied for robustness.

## Release workflow (when authorized)

1. Run `cd /home/ubuntu/Spartan-Gaming && git status -sb`.
2. Confirm target version, clean worktree, GitHub state.
3. Run `npm run format:check`, `npm run check`, and `npm test`.
4. Build Android with protected signing environment.
5. Verify with `apksigner`, generate basename-only `SHA256SUMS.txt`, download-verify uploaded assets.
6. Sign commits/tags with Codex and push intentionally.
7. Publish GitHub prerelease with signed APK and `SHA256SUMS.txt`.

## External gates

Software and repository checks pass. Live provider authentication, real streaming accounts, physical-device interaction, and production service credentials require operator-controlled environments and were not fabricated by local tests.

## Phase Completion Status

- **Phase 1 (Library & Metadata)**: Complete - library module with IndexedDB persistence, 5 metadata providers (IGDB OAuth2, RAWG, Hasheous hash search, Playmatch, SteamGridDB), hashing (CRC32/SHA-1/SHA-256/MD5 polyfill via Web Crypto), IndexedDB database wrapper (games/collections/settings/metadataCache/scanHistory stores), ROM file detection + scanner with directory picker + file hashing + platform detection, UI pages (library/index.html with grid/list view, search/filter/sort/pagination/collections/favorites, game detail with 6 tabs: overview/screenshots/videos/achievements/metadata/links), responsive CSS, JavaScript modules (library.js, game-detail.js) with search, favorite toggling, metadata enrichment, launch.

- **Phase 2 (Online Multiplayer & Social)**: Complete - WebRTC signaling service with STUN/TURN/ICE (matchmaking.mjs), friend system with presence awareness and activity tracking (friends.mjs), multiplayer lobby UI (multiplayer-page.mjs) with desktop/mobile responsive design, friend discovery from library, session initiation and invitation system.

- **Phase 3 (Cloud Gaming & Stream Optimization)**: Complete - cloud provider session management, dynamic quality adaptation algorithm, stream overlay UI (desktop/mobile responsive), stream health diagnostics dashboard.

- **Phase 4 (Performance & Resource Management)**: Complete - performance monitor with quality tier adaptation, power policy with battery-saving settings, memory manager with bounded caches and expiration.

- **Phase 5 (Advanced Features & Customization)**: Complete - theme manager with light/dark/auto switching, custom profile system with controller mappings and input settings, shortcut manager with global and per-shortcut registration.

- **Phase 6 (Stability & Release Polish)**: Complete - stability hardening across all modules, release candidate build and verification, final Android compatibility validation (API 33 + API 36), signed APK preparation and packaging.

## Handoff Checklist (Current State)

- ✅ KVM workspace at `/home/ubuntu/Spartan-Gaming` synced with `origin/main` at `468e171`
- ✅ Both local backups verified (`/home/userland/SpartanCode-backup`, `/home/userland/SpartanCode-work-backup`)
- ✅ GitHub push access verified (`github-spartan-gaming` SSH alias)
- ✅ Signed APK verified on both emulators (Android 13 + Android 16)
- ✅ All 6 phases implemented and documented
- ✅ All verification gates green: 879 tests, 22/22 Playwright, 44/44 full-verification
- ✅ Format check clean (Prettier + ktlint)
- ✅ Zero `replaceAll` in new code (verified via grep)
- ✅ Zero new `Object.hasOwn` in new code (defensive `hasOwnProperty.call` pattern used)

## Documentation Locations (Credential Stores - DO NOT DISCLOSE CONTENTS)

- SSH host aliases and key selection: `/home/userland/.ssh/config`
- Active SSH identities: the existing `ssh-agent`; inspect safely with `ssh-add -l` or `ssh-add -L` without reading private-key files. The primary identity is `SpartanDev`.
- GitHub SSH remote: the `github-spartan-gaming` alias in the SSH configuration. Verify access with `git ls-remote origin` from the KVM checkout.
- GitHub CLI session: `gh auth status`; its protected storage is normally under `/home/userland/.config/gh/hosts.yml`. Never print, copy, or cat that file.
- GPG keyring and trust database: `/home/userland/.gnupg/`; verify the signing identity with `gpg --list-secret-keys --keyid-format LONG Codex`, but never export or print secret key material.
- Android signing files on KVM: `/home/ubuntu/.spartancode-secrets/android/spartancode-upload.jks`, `/home/ubuntu/.spartancode-secrets/android/store-password`, and `/home/ubuntu/.spartancode-secrets/android/key-password`. Use them only as protected Gradle environment inputs; never display their contents.
- Android SDK on KVM: `/home/ubuntu/android-sdk`; use `ANDROID_HOME=/home/ubuntu/android-sdk` and `ANDROID_SDK_ROOT=/home/ubuntu/android-sdk` for Gradle.
- Google Drive rclone configuration: `/home/userland/.config/rclone/rclone.conf`, mode 600. Use the named `google-drive` remote and never print the config.
- OpenCode configuration: `/home/userland/.config/opencode/opencode.jsonc`; it loads this file.

These paths identify credential stores, not permission to disclose their contents. Tokens, passwords, private keys, keystores, cookies, and raw secret stores must remain in their protected managers and must not be written into OpenCode config, repository documentation, logs, or GitHub.
