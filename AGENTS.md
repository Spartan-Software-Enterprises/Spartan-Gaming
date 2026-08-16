# Shared project workflow

- Treat GitHub as the source of truth for project repositories.
- Use `SpartanDev` as the primary SSH key and `Codex` as the GPG signing key; both are registered with GitHub.
- For KVM GitHub pushes, forward the local `SpartanDev` SSH agent; the KVM repository deploy key is read-only.
- Treat the AWS KVM instance as the primary remote development host and the second AWS instance as fallback.
- Perform development, builds, tests, signing, and other resource-intensive or system-sensitive work on the KVM by default; use the local Android/UserLAnd device only when required for local integration, transfer, or verification.
- Keep a current local project backup and verify GitHub push access from both the local UserLAnd device and the KVM.
- Prefer AWS credits and avoid starting or scaling paid resources without explicit instruction.
- Use only authorized authentication; do not copy raw secret stores or expose tokens and private keys in logs.
- Preserve long-running work with tmux where available, while recognizing Android/UserLAnd can still suspend or terminate processes.
- Use the review workflow for completed changes: inspect the diff, run appropriate checks, commit with a clear message, and push to GitHub so Codex and OpenCode can hand off from the shared repository.
- Never commit secrets, private keys, tokens, or local credential stores; stop for conflicts, failed validation, or an ambiguous target branch.
- At the start of any project task, check the local workspace first because it is usually authoritative for active work; identify the matching GitHub repository, reconcile local and remote branch/status state, read the most up-to-date repository documentation and configuration, inspect the latest available session/handoff data, then begin or resume implementation.
- Use the authenticated `google-drive` rclone remote for Android-safe file exchange; its root is the operator-provided shared Drive folder, with `Inbox/`, `Outbox/`, `Projects/`, and `Backups/` subfolders. Keep the rclone config at `/home/userland/.config/rclone/rclone.conf` mode 600 and never print its contents.
- OpenCode must load this file through `/home/userland/.config/opencode/opencode.jsonc`; both agents use the same `/home/userland` SSH, GPG, GitHub, and Google Drive configuration.

## OpenCode connection and credential locations

OpenCode should use the existing authenticated managers and agents; it must never be given copied credential values.

- SSH host aliases and key selection: `/home/userland/.ssh/config`.
- Active SSH identities: the existing `ssh-agent`; inspect safely with `ssh-add -l` or `ssh-add -L` without reading private-key files. The primary identity is `SpartanDev`.
- GitHub SSH remote: the `github-spartan-gaming` alias in the SSH configuration. Verify access with `git ls-remote origin` from the KVM checkout.
- GitHub CLI session: `gh auth status`; its protected storage is normally under `/home/userland/.config/gh/hosts.yml`. Never print, copy, or cat that file.
- GPG keyring and trust database: `/home/userland/.gnupg/`; verify the signing identity with `gpg --list-secret-keys --keyid-format LONG Codex`, but never export or print secret key material.
- Android signing files on KVM: `/home/ubuntu/.spartancode-secrets/android/spartancode-upload.jks`, `/home/ubuntu/.spartancode-secrets/android/store-password`, and `/home/ubuntu/.spartancode-secrets/android/key-password`. Use them only as protected Gradle environment inputs; never display their contents.
- Android SDK on KVM: `/home/ubuntu/android-sdk`; use `ANDROID_HOME=/home/ubuntu/android-sdk` and `ANDROID_SDK_ROOT=/home/ubuntu/android-sdk` for Gradle.
- Google Drive rclone configuration: `/home/userland/.config/rclone/rclone.conf`, mode 600. Use the named `google-drive` remote and never print the config.
- OpenCode configuration: `/home/userland/.config/opencode/opencode.jsonc`; it loads this file.

These paths identify credential stores, not permission to disclose their contents. Tokens, passwords, private keys, keystores, cookies, and raw secret stores must remain in their protected managers and must not be written into OpenCode config, repository documentation, logs, or GitHub.

## Human-first UI and interaction directives

- Treat the human UI as a release-critical surface. A passing unit or build suite is insufficient: every user-facing flow must be exercised at desktop, landscape-phone, mobile, and television-sized layouts where applicable.
- Build flows around normal human use: automatic status checks, clear reachable/unavailable/authentication-required states, explicit assisted actions, readable left-to-right layouts, no accidental vertical text wrapping, and no unexplained dead ends.
- Provider availability must be truthful. If a service is unavailable, say so. If authentication is required, expose an Open login dialog action that uses the approved provider session; never collect or store provider passwords, cookies, or tokens in Spartan.
- Every change to a user-facing flow must add or update interaction-level tests covering loading, success, failure, authentication, assisted recovery, responsive layout, and console/runtime errors. Android and desktop release gates run the same comprehensive UI suite.
- Before handoff, inspect rendered screenshots, run the relevant full suites, review the diff, sign commits with the Codex key, and push the verified result to main. Keep unsupported physical-device or signing evidence fail-closed.
