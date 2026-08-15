# Spartan Gaming Agent Handoff

Updated: 2026-08-15

## Canonical state

- Repository: `Spartan-Software-Enterprises/Spartan-Gaming`
- KVM checkout: `/home/ubuntu/Spartan-Gaming`
- Branch: `main`; verify HEAD with `git log -1 --oneline`.
- Working tree: clean and synchronized with `origin/main`
- Latest release: [v0.1.0-beta.6](https://github.com/Spartan-Software-Enterprises/Spartan-Gaming/releases/tag/v0.1.0-beta.6)
- Release is a GitHub prerelease with a signed Android APK and portable `SHA256SUMS.txt`.

Use the KVM checkout for builds, tests, signing, and release work. Do not use a migration or Termux checkout as the active project.

## Connection paths

- GitHub remote: `github-spartan-gaming` SSH alias, repository `Spartan-Software-Enterprises/Spartan-Gaming`.
- KVM SSH alias: `kvm-spartancode`; resolve its current address from the protected SSH configuration rather than copying addresses into source files.
- Primary SSH identity: `SpartanDev`, already configured in the operator-managed SSH agent.
- Commit/tag signing: `Codex`, already configured in GPG; verify with `git log --show-signature`.
- Android SDK on the KVM: `/home/ubuntu/android-sdk`; use `ANDROID_HOME` and `ANDROID_SDK_ROOT` only in the shell environment.
- Android signing inputs are protected under `/home/ubuntu/.spartancode-secrets/android/`. Use the existing files through environment variables; never print or copy them.
- Google Drive exchange: use the authenticated `google-drive` rclone remote and its `Inbox/`, `Outbox/`, `Projects/`, and `Backups/` folders. The rclone configuration is `/home/userland/.config/rclone/rclone.conf`, mode 600; never print it.
- OpenCode configuration: `/home/userland/.config/opencode/opencode.jsonc`.

Agents must use existing authenticated sessions and protected configuration. Never place tokens, passwords, private keys, keystore bytes, cookies, raw credential stores, or secret URLs in this file or any commit.

## Beta.6 contents

- Automatic live viewport sizing and device-aware compact layouts across the frontend.
- Mobile/handheld safe-area spacing, responsive dialogs/cards/controls, resize tracking, and zero tested horizontal overflow.
- Kotlin formatting through `ktfmt`:
  - `npm run format:kotlin`
  - `npm run format:kotlin:check`
  - `npm run format` runs Prettier followed by Kotlin formatting.
  - `npm run format:check` checks both formatters.
- Android version is `0.1.0-beta.6` in `package.json`, `package-lock.json`, and `android/app/build.gradle.kts`.

The old `prettier-plugin-kotlin` was tested against the real `.kt` and `.kts` sources and failed to parse them. It is not a project dependency. Kotlin is intentionally handled by `com.facebook:ktfmt:0.64` through Gradle.

## Verification evidence

- `npm test`: 820 tests; 815 passed, 5 skipped, 0 failed.
- `npm run electron:test`: 57 passed, 0 failed.
- `npm run format:check`: passed for Prettier and ktfmt.
- `npm run check`: passed.
- `npm run test:android-shell`: 5 passed.
- Signed Android release build: passed with protected operator-managed signing material.
- APK verification: APK Signature Scheme v2 verified; one signer.
- Beta.6 release APK downloaded from GitHub and verified against `SHA256SUMS.txt`.
- Signed Git tag `v0.1.0-beta.6` verified with the Codex GPG key.
- Playwright smoke: 11 maintained routes at desktop and mobile sizes.
- Supplemental UI pass: 14 routes × desktop/mobile = 28 screenshots; no blank pages, framework overlays, console/page errors, or horizontal overflow.
- Interactions verified: dashboard filters and console mode, social navigation/streaming filter, multiplayer dialog, settings scroll reset, and emulator core catalog/project links.

## Release workflow

1. Run `cd /home/ubuntu/Spartan-Gaming && git status -sb`.
2. Confirm target version, clean worktree, and GitHub state.
3. Run `npm run format:check`, `npm run check`, and `npm test`.
4. Build Android with the protected signing environment; never print passwords or private keys.
5. Verify with `apksigner`, generate a basename-only `SHA256SUMS.txt`, and download-verify uploaded assets.
6. Sign commits/tags with Codex and push intentionally.
7. Do not publish another beta without explicit operator instruction.

## External gates

Software and repository checks pass. Live provider authentication, real streaming accounts, physical-device interaction, and production service credentials require operator-controlled environments and were not fabricated by local tests.
