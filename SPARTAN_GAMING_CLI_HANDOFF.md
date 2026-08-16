# Spartan Gaming CLI Handoff

Updated: 2026-08-16

## Canonical state

- Repository: `Spartan-Software-Enterprises/Spartan-Gaming`
- KVM checkout: `/home/ubuntu/Spartan-Gaming`
- Branch: `main`; HEAD: `6b2db4b`
- Working tree: clean and synchronized with `origin/main`
- Latest release: `v0.1.0-beta.8` (not yet published; signed APK verified locally)

## Verification evidence (beta.8)

- `npm test`: 863 tests; 858 passed, 5 skipped, 0 failed.
- `npm run electron:test`: 57 passed, 0 failed.
- `npm run test:android-shell`: 5 passed.
- `npm run format:check`: passed (Prettier + ktfmt).
- `npm run check`: passed.
- `npm run playwright:smoke`: 22 viewports pass (11 routes × desktop/mobile); 0 page errors, 0 console errors, 0 horizontal overflow.
- `scripts/playwright/providers-deep.mjs`: full provider flow pass at desktop + mobile (28 providers render, editor populates, save/persist, cross-route, no errors).
- WebView compatibility fixes: `Object.hasOwn` → `hasOwnProperty.call`, `replaceAll` → regex global (9 files).
- Android 16 (API 36, Chrome 133 WebView): app launches, 28 providers render, editor opens, no errors.
- Android 13 (API 33, Chrome 101 WebView): app launches, 28 providers render, editor opens, no errors.
- Signed APK built: minSdk 33, targetSdk 36, catalogs as files, apksigner v2 verified (one signer, SHA-256 2b811bac...).

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
