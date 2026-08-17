# Spartan Gaming OpenCode Handoff

Updated: 2026-08-17

## Canonical State

- Repository: Spartan-Software-Enterprises/Spartan-Gaming
- KVM checkout: /home/ubuntu/Spartan-Gaming
- Branch: main
- Latest main commit: c87bed5 (docs: save OpenCode continuation handoff)
- Working tree: clean and synchronized with origin/main
- Current package version: 0.1.0-alpha.3
- Latest release: https://github.com/Spartan-Software-Enterprises/Spartan-Gaming/releases/tag/v0.1.0-alpha.3
- Latest tag is signed with the Codex GPG key and points to ced9b41.

## Session Continuity

Close the terminal safely. The source of truth is GitHub plus the KVM checkout, not terminal scrollback.

OpenCode must first run:

`bash
cd /home/ubuntu/Spartan-Gaming
git status -sb
git log -1 --show-signature --oneline
git remote -v
gh auth status
`

Use the configured kvm-spartancode SSH alias, the existing SpartanDev SSH agent identity, and the existing Codex GPG key. OpenCode configuration is loaded from /home/userland/.config/opencode/opencode.jsonc, which loads /home/userland/AGENTS.md.

Never copy or print tokens, passwords, private keys, keystores, cookies, raw credential stores, or rclone configuration.

## Product/UI State

The current console UI uses an Xbox One-style interaction model while preserving Spartan branding:

- Spartan red, black, gunmetal, metallic gray, and white palette from the supplied brand reference.
- Compact controller-friendly navigation and horizontal rails.
- Responsive desktop, landscape-phone, mobile, and television layouts.
- Reduced mobile scale and viewport-aware density.
- Restrained hero sweep, tile hover/focus, rail-button, and reduced-motion behavior.
- Resume control is hidden unless a recoverable session or launch history exists.
- Resume and player pause controls use compact icons with accessible labels and tooltips.
- Provider and library content remains readiness-driven and horizontally browsable.

Primary UI files:

- src/frontend/dashboard/console-mode.css
- src/frontend/dashboard/dashboard.mjs
- src/frontend/dashboard/index.html
- src/frontend/player/player.mjs
- src/frontend/player/player.css
- src/frontend/shared/xbox-ui.css
- docs/ui-streaming-plan.md
- docs/screenshots/dashboard-xbox-*.png

## Verification

Latest local KVM gates passed after the UI changes:

- npm test: 889 tests, 884 passed, 5 skipped, 0 failed.
- npm run format:check: passed, including Kotlin formatting.
- npm run frontend:build: passed.
- Playwright UI audit: 18 routes across 4 layouts, no failures.
- Playwright interaction matrix: 3 routes across 4 layouts, no failures.
- Human-flow audit: passed across four viewports.
- Alpha.3 Android signed release workflow: passed.
- Alpha.3 repository checks, frontend distribution, native package rollout, Android debug shell, cross-platform contracts, and UI human-flow workflows: passed.

Browser plugin was unavailable; regular Playwright is the recorded rendered-UI fallback.

## Alpha.3 Release

Published assets currently include:

- Phone, tablet, foldable, Android TV, and Fire TV signed APKs.
- Linux .deb and AppImage packages.
- SteamOS .deb and AppImage packages.
- Android and desktop SHA-256 checksum files.
- Linux and SteamOS update metadata.

The desktop workflow's macOS and Windows jobs failed closed because signing/notarization secrets are not configured. Do not describe those artifacts as released or bypass the custody checks.

Do not create beta tags. Do not create another alpha tag unless the operator explicitly requests another alpha release. Release corrections must follow the repository's same-tag policy when appropriate.

## Next Agent Checklist

1. Check the KVM repository status and GitHub synchronization.
2. Read this handoff, /home/ubuntu/AGENTS.md, docs/ui-streaming-plan.md, and relevant current source.
3. Preserve the Spartan red/black/metallic palette and compact mobile scale.
4. Run fresh Playwright screenshots and interaction checks after every UI change.
5. Run the full local gates before committing.
6. Sign commits with Codex and push main.
7. Keep release work separate unless explicitly requested.

## Protected Paths

- SSH config: /home/userland/.ssh/config
- GPG keyring: /home/userland/.gnupg/
- Android SDK: /home/ubuntu/android-sdk
- Android signing inputs: /home/ubuntu/.spartancode-secrets/android/
- Google Drive rclone config: /home/userland/.config/rclone/rclone.conf
- OpenCode config: /home/userland/.config/opencode/opencode.jsonc

## Conversation Decisions And Completed Work

This handoff captures the active conversation so another agent does not need the chat transcript:

- The project is Spartan Gaming only; unrelated Android talk-to-text work was explicitly discarded.
- The user requested Xbox One console behavior and visual hierarchy without changing Spartan branding.
- Provider browsing must use categorized horizontal rails with icons, visible selection, arrow controls, keyboard/gamepad focus, and no accidental page overflow.
- Android back navigation must preserve in-app context instead of closing the whole app.
- Release update checks, install-over-existing-app behavior, capitalization, viewport fitting, and release-tag behavior remain release-critical areas documented in the repository.
- The user explicitly stopped automatic beta publishing. Alpha publishing is allowed only when explicitly requested.
- The previous beta tag history was removed/reworked; the active release channel is alpha.
- Alpha.3 was explicitly requested and published. The release includes signed Android profiles, Linux, and SteamOS artifacts. Windows and macOS remain blocked by missing signing/notarization custody and must stay fail-closed.
- The UI was changed from a generic dark dashboard to an Xbox-style tile-and-rail layout.
- The supplied Spartan logo reference established the correct palette: black, Spartan red, gunmetal, metallic silver, and white. Cyan, violet, and teal are not the console brand palette.
- Mobile sizing was reduced again after screenshot review.
- Hero resume is hidden unless a recovery handoff or launch history exists. When available, resume uses a compact play icon. Player pause/resume controls use compact icons, accessible labels, and tooltips.
- Motion is intentionally restrained: hero sweep, tile hover/focus lift, rail-button feedback, and reduced-motion fallbacks.
- Every UI modification was followed by formatting, build, unit, Playwright UI audit, interaction matrix, human-flow, and screenshot review gates.
- Do not overwrite these decisions with a generic Xbox color palette or reintroduce large text buttons for session controls.
