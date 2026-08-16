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

## Product/UI source of truth

### Communication and completion rule

For autonomous project work, do not send progress updates, partial results, or
routine status messages while work is in progress. Continue through the full
authorized workflow and provide one consolidated final report only after the
implementation, documentation, validation, signing, and publishing gates are
complete. The final report must clearly separate completed work from external
gates that failed or remain unavailable; never describe a partial release as
complete. Do not interrupt the workflow with authorization requests for
already-authorized repository, KVM, build, test, signing, or GitHub actions.
If an external gate is genuinely unavailable, exhaust safe in-scope checks and
record the exact blocker in the final report without exposing credentials.

### Autonomous completion workflow

1. Work from the KVM checkout at `/home/ubuntu/Spartan-Gaming` on `main`.
2. Read this file, the current handoff/session data, and the complete current
   repository documentation before changing anything.
3. Inspect the working tree, reconcile `main` with GitHub, and preserve a
   clean recoverable state.
4. Implement the requested work across shared HTML/CSS/JavaScript and every
   affected Android, desktop, TV, Fire TV, SteamOS, tablet, phone, and browser
   surface. Keep Android and desktop changes synchronized.
5. Add or expand tests before claiming completion. Test loading, success,
   empty, unavailable, authentication-required, offline, unsupported-device,
   and recovery states, plus keyboard, touch, mouse, D-pad, gamepad, focus,
   accessibility, responsive, and horizontal-rail behavior.
6. Run the complete local KVM gates, including formatting, unit/integration
   tests, frontend build, rendered UI matrices, provider-auth flow, Android
   shell/release checks, Electron checks, serial checks, and platform package
   checks. Do not rely on an earlier run after modifying files.
7. Review the diff and documentation, commit with Codex GPG signing, and push
   `main` to GitHub.
8. Build, sign, verify, and publish the Android and desktop artifacts through
   the documented workflows. Use the existing beta tag when correcting a
   release; force-replace the same tag rather than creating a new tag.
9. Verify GitHub workflow conclusions, artifact presence, signatures,
   checksums, release metadata, and tag-to-commit identity before reporting
   completion.
10. Send one final report containing changed areas, exact commit/tag, tests,
    artifacts, workflow results, and any unavoidable external blockers.

- Read and follow [docs/ui-streaming-plan.md](docs/ui-streaming-plan.md) before changing a user-facing surface. It records the researched streaming-service patterns, information hierarchy, device behavior, accessibility requirements, acceptance criteria, implementation phases, and coding style for Spartan Gaming.
- The UI is the highest-priority product surface. A passing build or unit suite never substitutes for rendered interaction validation.
- Work from the human outcome: show the next action, automatically detect state, provide the recovery action, preserve context, and avoid dead ends or instructional text without an executable control.
- Use HTML, CSS, and modern JavaScript for the shared frontend by default. Do not migrate to React or add a UI framework unless the user explicitly requests that architectural change and the migration plan proves a measurable benefit across Android, TV, SteamOS, Electron, and browser targets.
- Prefer semantic HTML, small composable modules, shared data contracts, CSS media/device profiles, progressive enhancement, and accessible names over clever abstractions. Preserve the existing vanilla style and avoid unnecessary dependencies.
- Use horizontal content/category rails when browsing or scrolling is unavoidable: snap points, visible arrow controls, keyboard arrows, gamepad shoulder navigation, and a View all action are required. Do not allow accidental page-level horizontal overflow. Reserve vertical scrolling for intentionally long settings/detail content.
- Keep primary actions visible in the first viewport. Icon-only controls require accessible labels and must not be the only way to complete a task.
- Provider cards must automatically show checking, ready, sign-in-required, unavailable, unsupported-device, and needs-input states. Authentication must open the approved provider login surface and recheck automatically; Spartan never receives provider passwords, cookies, or tokens.
- Profiles/workspaces must isolate resume history, favorites, collections, provider sessions, controller mappings, display/performance settings, and accessibility preferences. Restore focus and return context after switching, dialogs, login, and playback.
- Every visible flow must explicitly account for desktop, landscape phone, mobile/tablet, television/Fire TV/Android TV, SteamOS/handheld, and Electron behavior where applicable. Android and desktop release workflows must run the same comprehensive UI gates.
- For every UI change, add or update tests for loading, success, empty, unavailable, authentication, assisted recovery, responsive layout, keyboard/touch/gamepad behavior where applicable, accessible names, focus restoration, and console/runtime errors.
- Use the same-tag release rule: if a release candidate or workflow is broken, fix it and replace the existing tag in place after confirming the exact target. Do not create a new beta tag merely to escape a failed release. Keep tags signed and commits signed with Codex.
- Update the relevant documentation and this file when product behavior, platform support, release gates, or agent workflow changes. The next agent must be able to continue from the repository docs without relying on chat history.

## Current implementation sequence

1. Implement Phase 1 from `docs/ui-streaming-plan.md`: dashboard rails, readiness-driven provider cards, Continue Playing/Ready/Needs Sign-In, and recovery states.
2. Validate fresh rendered behavior with Playwright because the Browser plugin is unavailable in this environment; use desktop, landscape-phone, mobile, and television viewports plus Electron where available.
3. Proceed through Phases 2–5 only after the previous phase has passing interaction and responsive evidence.
4. Review the diff, run the full release matrix, sign the commit, push `main`, and replace the current beta tag in place only when the release workflow requires a corrected candidate.
