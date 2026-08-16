# Spartan Gaming CLI/OpenCode Handoff

Updated: 2026-08-16

## Source of truth

The active branch is `main`; verify the current commit with `git log -1 --oneline`. The latest prerelease is `v0.1.0-beta.6`. The canonical checkout is `/home/ubuntu/Spartan-Gaming` on the KVM. Current HEAD is `4debc9b`.

OpenCode configuration is `/home/userland/.config/opencode/opencode.jsonc`, which loads `/home/userland/AGENTS.md`. Follow that file before repository actions.

## Authorized connection paths

- KVM: `ssh kvm-spartancode` using the existing `SpartanDev` SSH agent.
- GitHub: configured SSH remote alias plus authenticated `gh` session.
- Commit/tag signing: existing `Codex` GPG configuration.
- Drive exchange: authenticated `google-drive` rclone remote with `Inbox/`, `Outbox/`, `Projects/`, and `Backups/`.
- Android SDK: `/home/ubuntu/android-sdk` on KVM.

These paths use inherited operator authentication. Never put tokens, passwords, private keys, keystore bytes, cookies, or raw credential stores into OpenCode configuration, repository files, logs, or handoff documents.

## Validation gate

Run `npm run format:check`, `npm run check`, `npm test`, `npm run electron:test`, `npm run test:android-shell`, and `npm run playwright:smoke` from the KVM checkout.

Kotlin formatting uses `npm run format:kotlin` and `npm run format:kotlin:check`. `npm run format` is the combined write command: Prettier followed by ktfmt. The Prettier Kotlin plugin was tested and rejected because it failed to parse the project sources.

## Release procedure

Only release when explicitly requested. Bump `package.json`, `package-lock.json`, and `android/app/build.gradle.kts`; run all gates; build with protected signing environment variables; verify with `apksigner`; create a basename-only checksum; sign and push commit/tag; upload assets; download-verify the GitHub release; and leave the tree clean.

## Current evidence

862 repository tests: 857 passed, 5 skipped, 0 failed (added contract coverage for the voice/session/adapter/host modules and wired noise-suppression profiles through settings, preferences, and the browser host mic path). Electron tests: 57 passed. Android shell tests: 5 passed. Android signed build and v2 APK signature: passed. Playwright smoke: 11 routes at desktop/mobile. Supplemental UI matrix: 14 routes at desktop/mobile, 28 screenshots, zero browser errors and zero horizontal overflow. Beta.6 tag signature and release checksum: verified.
