# Spartan Gaming agent handoff

Updated: 2026-08-10

This is the durable continuation point for Codex, OpenCode, and other CLI
agents. Read it before changing the repository, then verify Git state because
the branch may have advanced since this note was written.

## Product direction

- Electron GUI is the primary desktop interface; shared frontend code remains
  the portable product layer.
- Scope is Windows, macOS, Linux, ChromeOS, Android, Amazon Fire TV / Fire
  Stick, and Roku where a practical web/runtime surface exists. Apple mobile
  work is out of scope.
- GameNative is an external Android companion integration boundary, not copied
  into this repository.
- DRM bypass, unauthorized game distribution, credential extraction, and
  circumvention features are not supported.
- Never call a platform, device, driver, production deployment, or package
  signing path complete without its required evidence.

## Repository workflow

    cd /data/data/com.termux/files/home/Spartan-Gaming
    git status -sb
    git pull --ff-only origin main
    npm ci --ignore-scripts --no-audit --no-fund
    npm run check
    npm test

Use the remote development host for expensive or platform-sensitive checks.
Keep temporary Playwright reports and screenshots outside the repository.
Inspect `AGENTS.md` or `CLAUDE.md` if either is added in a future checkout.

## Remote development server

| Field | Value |
| --- | --- |
| Type | `t3.small` |
| OS | Amazon Linux 2023 |
| Region | `us-east-1` |
| Address | Resolve from protected infrastructure configuration |
| Disk | 30 GiB encrypted gp3 |
| SSH access | Restricted operator access |
| Checkout | `~/Spartan-Gaming` |
| Frontend | `127.0.0.1:4173`, not publicly exposed |
| Evidence | `~/.config/spartan-dev/evidence` |

    # Resolve the current host address from the private AWS inventory/runbook.
    ssh -i ~/.ssh/spartan-dev ec2-user@<current-dev-host>
    cd ~/Spartan-Gaming

Connection details and the operator-managed private-key path are maintained in
the protected AWS runbook/configuration, not this tracked handoff. Credentials
are not stored here: this includes private SSH keys, passwords, Redis/TURN
secrets, TLS private keys, provider credentials, and AWS access keys. Use the
host's existing secret paths/environment configuration; do not print or commit
their values.

### Noninteractive authorized connection

Agents on the authorized development device may connect without asking the
operator for input. The key is already provisioned at the protected local path;
resolve the current ephemeral address from the AWS instance inventory, then
use batch SSH so the command fails clearly instead of prompting:

    instance_id='i-0d3d5c3c1724d02f4'
    region='us-east-1'
    ssh_key='/data/data/com.termux/files/home/.ssh/spartan-dev'
    public_ip="$(aws ec2 describe-instances --region "$region" --instance-ids "$instance_id" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
    ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$ssh_key" "ec2-user@$public_ip" 'cd ~/Spartan-Gaming'

If AWS lookup is unavailable, use the current address from the protected
runbook/configuration. Never replace this with a password prompt or commit the
private key itself.

Remote tooling includes Git, Rust/Cargo, GCC, CMake, Node.js/npm, Python,
Docker, Playwright 1.55.0, Chromium headless, and the Linux packages required
by Chromium. Existing development services are Redis, signaling, and TURN.
Do not create, resize, or replace AWS resources without an explicit cost
review; stay within the AWS credit limit.

## Verified baseline

- The published code state is `e06efe7` on `main`; local and AWS worktrees are
  clean and synchronized with `origin/main`.
- `npm run check`: repository checks pass on the current code state locally
  and on the AWS dev server.
- `npm test`: the current local run completed with 633 tests, 629 passed,
  4 skipped, and 0 failed. The AWS run completed with 633 tests, 631 passed,
  2 skipped, and 0 failed; the difference is environment-gated integration
  coverage, not a failure.
- AWS Playwright 1.55.0 completed 22/22 navigations across 11 maintained
  routes at desktop and mobile viewports on code commit `7c996e1`; all routes
  returned 200 with meaningful bodies and no horizontal overflow. The
  protected pure JSON report is
  `~/.config/spartan-dev/evidence/playwright/spartan-playwright-runner.json`.
- On `56558f8`, the AWS full suite completed with 48 pretest cases (47 passed,
  1 skipped) and 617 main-suite tests (615 passed, 0 failed, 2 skipped).
- On `c6d2533`, the AWS full suite completed with 48 pretest cases (47 passed,
  1 skipped) and 618 main-suite tests (616 passed, 0 failed, 2 skipped).
- On `ccc7ae5`, the AWS focused controller/session/settings suite passed 70/70;
  on `70a56b8`, the focused SteamOS/Proton/settings suite passed 79/79.
  The AWS pretest phase passed 47 with 1 skip; the main suite passed 619 with 2
  skips and 0 failures.
- On `4198284`, the focused power/session suite passed 59/59. The AWS pretest
  phase passed 47 with 1 skip; the full main suite passed 618 of 620 tests with
  2 skips and 0 failures.
- PWA install tests: 2 passed locally; the AWS focused distribution/server/
  install run passed 7 tests.
- The latest PWA distribution tests also verify the SVG app mark, manifest
  metadata, service-worker cache policy, and packaged frontend serving.
- Linux native evidence on the dev server: ready with capture, audio, input,
  and haptics verified in the latest report.
- Roadmap acceptance remains incomplete for real Windows/macOS/Linux hardware,
  Windows/macOS virtual gamepad drivers, external package signing, production
  activation, and physical SteamOS Deck/desktop validation.
- CodeRabbit review was not completed because the local `coderabbit` binary is
  unusable on the ARM64 Termux host. Install and authenticate the official CLI
  before claiming a CodeRabbit review.

## Current change

The current player increment adds a capability-safe Screen Wake Lock
controller. It starts only for connected/reconnecting sessions when the
existing mobile keep-awake setting is enabled, reacquires after visibility
recovery, and releases on session end/pagehide. Unsupported or denied browser
implementations fail closed. Regression coverage is in
`src/frontend/player/wake-lock.test.mjs`; the local validation register now
records the required physical-device and WebView checks.

The latest Electron increment completes the background-app workflow: enabling
`general.backgroundApps` now creates a native tray entry with restore and quit
actions, while disabling it destroys the tray. The existing session quit guard
still applies to tray quit. Tray policy is covered by
`desktop/electron/tray-policy.test.mjs`, and Electron syntax/tests are now part
of `npm run check`.

The current Electron power increment adds `desktop/electron/power-runtime.mjs`
and a preload power-event listener. Electron `powerMonitor` suspend/resume,
AC/battery, thermal, and speed-limit events are reduced to bounded diagnostics;
active sessions use a session-aware `powerSaveBlocker` policy. Physical desktop
power and thermal behavior remain lab gates. The Electron suite passed 14/14
locally and on AWS at `d203f1c`; repository checks and the full package suite
also exited successfully.

The Android mobile increment adds `android/gamemode/AndroidGameModeBridge.kt`
and a shared `resolveAndroidGameModeIntent()` contract. Android 12+ shells
query `GameManager` on resume, preserve the observed mode, and never claim the
application can change the system-selected mode; Android hardware validation
remains a lab gate. The Android policy suite passed 4/4 locally and on AWS at
`8fc8d0e`; repository checks and the full package suite also exited
successfully.

The current accessibility increment adds closed-caption mode/language settings
and `applyCaptionPreference()` in `src/frontend/player/media.mjs`. It selects
one matching captions/subtitles text track, disables competing tracks, and
fails closed when the media surface exposes no text tracks. WebVTT/provider
caption behavior remains target-runtime validation work. The media/preferences
suite passed 38/38 locally and on AWS at `c8884e9`; repository checks and the
full package suite also exited successfully.

The current Android controller increment adds the native
`AndroidControllerInventory` metadata bridge and shared
`normalizeAndroidControllerInventory()` helper. It preserves bounded device
metadata and approved capability labels while leaving raw Android input events
and hardware behavior to the native shell/lab.
The combined Android/controller suite passed 6/6 locally and on AWS at
`d39b66f`; repository checks and the full package suite also exited
successfully.

The current text-entry increment adds `src/frontend/input/text-entry.mjs` and
the matching metadata-only `android/text-input/AndroidGameTextInputContract.kt`.
Text, selection, and IME composition ranges are bounded and malformed payloads
are rejected; showing the keyboard requires both focus and a user gesture.
The native GameTextInput C API/Prefab binding and physical Android/SteamOS
IME behavior remain intentionally unverified platform work. The focused
text-entry suite passed 3/3 locally; rerun it with the full repository suite
before publishing the next handoff.

The current Android bridge increment adds `src/frontend/platform/android-bridge.mjs`
and `android/SpartanAndroidBridge.kt`. Android WebView policy requests now use a
versioned, 16-KiB-bounded message protocol through the optional `SpartanAndroid`
interface; native handlers may separately query Game Mode, controller inventory,
or text input. The bridge fails closed for missing, oversized, malformed, or
unknown actions or non-object payloads and never exposes raw Android objects or
arbitrary command/URL execution. The bridge also forwards only positive,
allow-listed GameNative app IDs and store names to the native handoff. Focused
bridge/runtime validation passed 15/15, and the full local suite passed 633
tests with 629 passed, 4 skipped, and 0 failed. Android SDK
compilation, WebView lifecycle, permissions, callbacks, and device behavior
remain physical Android lab gates.

The repository-owned `scripts/playwright/smoke.mjs` runner now makes the browser
matrix reproducible with an externally installed Playwright module; invoke it
directly when a pure JSON report is required. The remote
Playwright pass initially exposed dashboard horizontal overflow at
the 390x844 mobile viewport. Commit `40f9f65` wraps the dynamically added
console-mode and workspace controls on small screens. Playwright 1.55.0 then
passed all 22 navigations across 11 maintained routes at desktop and mobile
viewports, including search/settings smoke checks. The protected report is
stored on AWS at
`~/.config/spartan-dev/evidence/playwright/spartan-playwright-runner.json`; this is
browser-surface evidence only and does not replace physical device validation.

The current Proton/SteamOS increment adds a user-owned Linux/SteamOS Proton
launch boundary. `host/proton.mjs` detects a selected installation, validates
compatibility-prefix and allow-listed runtime options, and creates a shell-free
`proton run` plan. Host config and frontend Settings export the bounded Proton
fields without arbitrary environment variables. SteamOS is now a roadmap and
platform target, but physical Deck execution, Steam Input, Gamescope/Game Mode,
power behavior, packaging, and real Proton/native game validation remain open.
Proton is never bundled or downloaded and no DRM, anti-cheat, or
authentication bypass is supported. Focused Proton/launch/settings validation
and the current full local/AWS suites pass; physical execution remains a
hardware gate.

The latest SteamOS increment adds `host/steam-os.mjs`: explicit `os-release`
identity detection, a 1280×800 handheld ceiling, 30/40/60-FPS policy,
controller-only navigation metadata, and a shell-free Gamescope wrapper plan.
SteamOS, Gamescope, and Steam Input settings now export through the frontend
host configuration. Focused AWS validation passed 41/41 and repository checks
passed 422/422 at that earlier commit. Physical Steam Deck/Game Mode/Desktop
Mode, real Gamescope,
Steam Input actions/glyphs, power behavior, and real Proton/native game
execution remain local-lab gates.

The latest controller increment adds `src/frontend/input/steam-input.mjs` with
a portable action manifest, optional official bridge capability, and bounded
Xbox/PlayStation/Nintendo/Steam glyph fallbacks. The bridge is metadata-only;
Gamepad/HID input remains the fallback and no Steam client control or
credentials are handled. AWS focused validation passed 70/70.

The current SteamOS increment adds launch-mode readiness metadata for native
Linux, Proton, Steam-owned, and non-Steam choices, including bounded Steam app
IDs and explicit `official-handoff-required`/`bridge-required` states. It does
not execute Steam client control or claim real handoff readiness.

The current session increment adds a shared power-aware quality policy. Explicit
Battery saver mode, injected bounded battery telemetry, and charging state now
produce consistent quality-profile and capability ceilings, including a
960×540 emergency mode at critically low battery. Missing battery APIs fail
closed to a normal policy; physical suspend, thermal, battery, and SteamOS power
behavior remain unverified lab gates. Focused session/power validation passed
59/59 locally.

The current controller increment extends the Steam Input manifest with explicit
trackpad, gyro, rear-button, touchscreen, and text-entry requirements. Action
negotiation and session capability negotiation now report missing hardware
without claiming readiness, while the Gamepad/HID fallback remains available.
The expanded controller/session suite passed 151/151 locally and on AWS. The
current action vocabulary includes haptics and controller-only navigation in
addition to trackpads, gyro, rear buttons, touchscreen, and text entry. The
AWS full suite at `f5a1a11` completed with 621 tests: 619 passed, 2 skipped,
and 0 failed. Physical Steam Deck controls, Steam Input bridge installation,
and hardware-specific touchscreen/text-entry/haptic/navigation behavior remain
lab gates.

The current SteamOS session increment at `80e79e4` adds explicit Game Mode fullscreen,
overlay-safe controller focus, 1280×800 and 30/40/60-FPS ceilings, and
session-reconnect sleep/wake metadata to the host profile. These are tested
contracts; physical suspend/resume, Gamescope, battery, and external-display
behavior remain lab gates.

The current SteamOS packaging increment adds a user-scope Flatpak filesystem
contract and shell-free install, update, uninstall, and commit-pinned rollback
plans. They require operator consent, a bounded SHA-256 artifact digest, and
separately verified package signatures; no Flatpak command is executed and no
privileged or signing-key operation is performed. Focused SteamOS packaging,
SteamOS, and Proton validation passed 10/10 locally; the complete launcher
matrix passed 20/20 on both local and AWS environments at `37deaf6`. AWS full
validation then passed 618 of 620 tests with 2 skips and 0 failures.
The packaging contract also exposes consent-gated desktop-entry and Steam
non-Steam registration metadata; actual registration remains operator-run on a
physical SteamOS host. The current SteamOS/Proton/packaging targeted suite
passed 11/11 locally and on AWS at `f35d6ef`; AWS repository checks and the
full package suite also exited successfully.

The roadmap audit now leaves only operator-owned production relay/signing
infrastructure, physical Windows/macOS/Linux input and media hardware, signed
virtual-device drivers, and physical SteamOS/Steam Deck validation open. Those
gates cannot be truthfully closed on the current AWS Linux server and remain
documented in `docs/future-local-validation.md`.

The roadmap acceptance ledger now explicitly requires two additional
secret-free reports: `--steamos-report` for a physical `steam-deck` target and
for a `steam-machine`/`steam-os-desktop` target. Each must report runtime
verification for Game Mode, Desktop Mode, Steam Input/glyphs, text entry,
touch/trackpad/gyro/rear controls, Gamescope, Proton/native launch,
suspend/resume, battery, and external display behavior. Missing reports keep
the ledger incomplete.

The latest AWS acceptance refresh records the verified production-services
report plus missing native-hardware, Windows/macOS virtual-gamepad,
external-signing, and both physical SteamOS reports. No secret values are
stored in the report or this handoff.

The preceding PWA increment remains covered by
`src/frontend/pwa/install.test.mjs`, `scripts/frontend/build.test.mjs`, and
`scripts/frontend/serve.test.mjs`. Before pushing future work, run
`git diff --check`, `npm run check`, `npm test`, and the remote Playwright
matrix again. Commit feature and test changes together, push `main`, then
synchronize the dev server and record the new commit here.

## Handoff discipline

At the end of every agent session:

1. leave the worktree clean or document every intentional uncommitted file;
2. record exact commands and pass/fail/skip counts;
3. update this file with blockers and the next safe action;
4. never include secret values; record only secret paths and variable names;
5. commit and push only after focused and full checks support the change.

References: [README.md](README.md), [ROADMAP.md](ROADMAP.md),
[docs/aws-dev-validation.md](docs/aws-dev-validation.md),
[docs/future-local-validation.md](docs/future-local-validation.md),
[docs/development.md](docs/development.md), and [docs/platforms.md](docs/platforms.md).
