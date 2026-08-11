# Spartan Gaming agent handoff

Updated: 2026-08-11

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

## Latest continuation snapshot

- The current unpublished increment makes Updates functional in packaged
  Electron applications. Stable, beta, and alpha settings reach a bounded main-
  process `electron-updater` controller; manual/automatic checks, progress,
  downloaded status, restart confirmation, and next-exit installation are
  covered. Development builds do not contact the updater, and obsolete
  adapter/core/catalog updater toggles were removed instead of left decorative.
- A manual desktop release workflow verifies the exact existing tag, derives
  the explicit GitHub metadata channel, requires Windows signing and macOS
  signing/notarization custody, builds before publication, and uploads to an
  existing release only after every platform package succeeds. Signed release
  execution and rollback drills remain open gates.
- Local repository validation passes 442/442 and the serialized suite passes
  640 of 644 with four expected environment/platform skips. AWS passes the same
  442/442 repository check and 642 of 644 serialized tests with the expected
  Windows/macOS skips. Its Xvfb Electron matrix matches all 44 Linux x64
  baselines and completes eleven interactions. The dedicated Updates screenshot
  and corrected handheld/mobile Settings views were inspected with no clipping,
  overlap, or document overflow.
- AWS produced a final 120,771,271-byte AppImage and a 93,561,932-byte Debian package
  with stable metadata, then proved explicit beta metadata in a second package
  run. The packaged ASAR contains `electron-updater` and the Spartan controller;
  the packaged app remained alive during a bounded Xvfb smoke with raw updater
  logging suppressed.
- CodeRabbit's staged review cycles found four valid issues: missing retained-
  status initialization, mutable release-action tags, a save-timer/updater-
  status race, and an over-broad mobile CSS assertion. All four are fixed with
  sender validation, official immutable action SHAs, explicit status ownership,
  and balanced-brace media-block extraction. The final clean re-review hit a
  29-minute free CLI rate limit before analysis, so no clean final result is
  claimed.
- The update increment is published on `main` as `c4d4bb7`. GitHub Actions is
  green: repository checks `31467798019`, frontend distribution `31467798027`,
  cross-platform contracts `31467798003`, and Android debug shell
  `31467798009` all succeeded for that commit.

- The prior visual-matrix baseline was published through `5ef5e49`. The primary desktop runtime remains a
  standalone Electron application loading bundled assets from
  `spartan-app://app`; production startup opens no frontend HTTP server.
- `da1f5e0` expanded the Electron Playwright harness to all 11 maintained routes
  at desktop, handheld, mobile, and television layouts with isolated user data,
  forced presentation modes, interaction checks, and screenshot fingerprints.
- `b669886` added pinned `pngjs` perceptual comparison so harmless live
  diagnostics pixels do not make the visual gate nondeterministic.
- `664bbc0` committed the reviewed Linux/Xvfb 44-snapshot baseline, documented
  the candidate-review workflow, and completed the roadmap's repeatable
  multi-layout Playwright gate. Real-device visual approval remains separate.
- `86b5c67` addressed every finding from the completed CodeRabbit review:
  normal runs now fail when the required baseline is missing, every layout
  asserts its exact navigation mode, search must change rendered results,
  television focus must move away from search to a valid remote target, and the
  desktop shortcut must survive a settings-page reload.
- The next controller-settings increment makes the live tester enforce the
  normalized gamepad permission, multiplayer/player-slot limit, dead zone, and
  polling cadence. Focused input tests and the complete repository check pass.
  AWS Electron verification matches all 44 visual baselines and adds a seventh
  representative interaction that changes controller settings through the UI,
  reloads the tester, and verifies the exact effective policy summary.
- The AWS serialized suite for this increment passes 641 tests: 639 passed, two
  expected Windows/macOS package skips, and zero failed. CodeRabbit completed a
  full uncommitted review and identified one major permission-boundary issue:
  disabled gamepad access still evaluated `navigator.getGamepads()`. The API
  read is now gated before evaluation and has a regression test. A clean
  re-review was attempted twice; the first SSH stream disconnected while the
  service was reviewing and the second reached the free CLI rate limit with a
  31-minute reset, so no clean second CodeRabbit result is claimed.
- Local Electron contracts pass 26/26. The complete serialized suite passes
  638 tests with 634 passed, 4 expected environment skips, and 0 failed.
- AWS at `86b5c67` passes Electron contracts 26/26 and the real Electron visual
  run matches all 44 committed perceptual snapshots with zero mismatches. It
  checks four dashboard searches, desktop shortcut persistence, television
  remote focus, expected presentation/navigation modes, meaningful route
  bodies, and no horizontal overflow.
- GitHub Actions is green on `86b5c67`: repository checks `31452400217`,
  frontend distribution `31452400240`, cross-platform contracts `31452400190`,
  and Android debug shell `31452400208` all succeeded.
- Contact sheets for all four layouts were visually inspected. No blank route,
  broken styling, overlapping primary control, or obvious clipping was found.
  Screenshots remain outside Git under
  `/home/ec2-user/Spartan-Gaming/out/playwright/electron`.
- CodeRabbit CLI 0.7.2 completed a review of the full increment with one major
  and three minor findings; all four were fixed and independently tested. The
  immediate verification re-review hit the free CLI rate limit, so no second
  clean CodeRabbit result is claimed.
- Remaining release gates include physical Windows/Linux/SteamOS/Android/Fire
  TV/controller testing, macOS only where existing desktop CI contracts require
  it, signed installers and updates, real provider login/recovery flows,
  accessibility, performance, long-session recovery, and platform certification.
- The current Electron diagnostics increment replaces the unsupported “Send
  crash reports” promise with opt-in local crash records and functional local
  verbose logs. The startup policy persists crash/log/retention choices;
  queued atomic storage prunes expired entries even while recording is off,
  flushes before export, and supports immediate cleanup. Exports redact URLs,
  authorization and credential-shaped values, email-shaped identifiers,
  addresses, and user paths; provider-page console output is never captured.
- AWS Electron contracts pass 41/41. The real Xvfb matrix matches all 44
  existing Linux x64 baselines and completes nine interactions, including an
  actual renderer console event, on-disk redaction/policy checks, and cleanup.
  The dedicated diagnostics-settings screenshot was inspected after correcting
  a clipped active-toggle label; desktop, handheld, and mobile settings views
  now place the visible `On` label beside the thumb without overflow.
- Final local formatting and repository checks pass; the repository check is
  438/438. The local serialized suite passes 638 of 642 with four expected
  Termux/platform skips. AWS passes the same 438/438 repository check and 640
  of 642 serialized tests with only the expected Windows/macOS skips.
- AWS rebuilt the complete Linux package set: a 120,348,741-byte AppImage and
  93,273,544-byte Debian package. The packaged ASAR contains the diagnostics
  module, CommonJS preload, and corrected Settings stylesheet. A follow-up
  AppImage build discovered the new scalable Spartan icon and emitted no
  default-icon warning.
- CodeRabbit's first review found four valid issues: retention needed an
  independent queued prune, export needed to flush pending writes, the
  Authorization redactor could leave a Bearer suffix, and Playwright used
  timing sleeps. All four are fixed and focused tests pass; run a final review
  after documentation and broad validation before publication. That final
  review was attempted across the complete staged increment but the free CLI
  returned an 18-minute rate limit before analysis, so no clean follow-up is
  claimed.
- The final Linux package run exposed Electron's default-icon warning. The
  existing Spartan SVG mark now lives at
  `desktop/build-resources/icon.svg`, where Electron Builder can convert the
  same scalable source for Linux, Windows, and macOS development artifacts.

## Remote development server

| Field      | Value                                                   |
| ---------- | ------------------------------------------------------- |
| Type       | `t3.small`                                              |
| OS         | Amazon Linux 2023                                       |
| Region     | `us-east-1`                                             |
| Address    | `100.59.33.221` observed 2026-08-10; resolve before use |
| Disk       | 30 GiB encrypted gp3                                    |
| SSH access | Restricted operator access                              |
| Checkout   | `~/Spartan-Gaming`                                      |
| Runtime    | Standalone Electron; no production frontend server      |
| Evidence   | `~/.config/spartan-dev/evidence`                        |

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
Docker, Playwright 1.62.1, Chromium, Electron, Xvfb, ImageMagick, dbus-x11, and
the Linux packages required by Chromium/Electron. Existing development services
are Redis, signaling, and TURN.
Do not create, resize, or replace AWS resources without an explicit cost
review; stay within the AWS credit limit.

## Verified baseline

- The published code state is `86b5c67` on `main`; verify the worktree before
  continuing and recheck the latest four workflows with `gh run list` if the
  branch has advanced. AWS is synchronized to `86b5c67` and its worktree is
  clean.
- `npm run check`: repository checks pass on the current code state locally
  and on the AWS dev server.
- `npm test`: the current local run completed with 634 tests, 630 passed,
  4 skipped, and 0 failed. The AWS run completed with 634 tests, 632 passed,
  2 skipped, and 0 failed; the difference is environment-gated integration
  coverage, not a failure.
- The Android shell contract passed 5/5 locally and 3/3 on the last AWS run.
  AWS now has Java 17, Gradle 8.11.1, and Android API 35/build-tools 35.0.0;
  the debug APK build
  passed at `01ced66` with `ANDROID_HOME=$HOME/.local/android-sdk` and produced
  a 1,628,083-byte APK with SHA-256
  `386b910893b8a2ab884d2ea7f17f7869910e00d60da49020cfbce5b93d3024ab`.
  The Android wrapper build is now also enforced by the checked-in
  `.github/workflows/android-debug.yml`; no GitHub Actions run is claimed until
  its resulting workflow run is observed.
  Release signing, permissions, WebView lifecycle, and physical device
  behavior remain open lab gates; Termux host checks run locally, but `adb`
  reports no separately authorized target device.
- Android release signing is now an environment-only Gradle boundary that
  rejects missing or partial operator values and never stores credentials in
  source. The full local suite passed 634 tests with 630 passed, 4 skipped, and
  0 failed after this change. AWS release-signing verification was attempted
  with a temporary non-production keystore but was interrupted after the
  instance became unresponsive; no production signature is claimed.
- A manual `.github/workflows/android-release.yml` workflow now provides the
  protected CI path for an externally managed keystore, `apksigner` verification,
  digest capture, and temporary-keystore cleanup. It has not been run because
  the required protected signing environment is not configured.
- GitHub Actions Android debug run `31440843444` succeeded on `7994538`,
  including SDK setup, Android shell tests, Gradle APK build, and artifact
  upload. Cross-platform contracts run `31440843482` also succeeded; the
  repository-checks run for the same commit succeeded before this handoff
  update.
- After updating both Android workflows to `actions/setup-java@v5`, debug run
  `31441280407` succeeded on `804fef4`, including the APK artifact upload.
  The setup-java deprecation warning is resolved; GitHub still reports the
  upstream `setup-android@v3` Node-runtime warning.
- The latest `90f9d29` push passed Android debug run `31441430002` and
  cross-platform contracts run `31441430016`. The cross-platform matrix
  exercised Linux/macOS/Windows Electron packaging, native package contracts,
  Redis integration, and Windows native input package build/test paths; these
  remain CI evidence, not physical hardware evidence.
- The current handoff commit's predecessor `4110eb2` also passed Android debug
  run `31441575249`, cross-platform contracts `31441575243`, and frontend
  distribution `31441575219`; repository checks `31441575255` passed as well.
- The latest handoff commit `10d9015` passed Android debug `31441735640`,
  cross-platform contracts `31441735627`, frontend distribution `31441735622`,
  and repository checks `31441735625`.
- The Android SDK action maintenance commit `38df18b` passed Android debug
  `31442023475`, cross-platform contracts `31442023495`, frontend distribution
  `31442023507`, and repository checks `31442023498`. Both Android workflows
  now use `android-actions/setup-android@v4`, the current Node 24-compatible
  major, instead of the deprecated v3 action.
- The latest handoff commit `c7a8e2b` passed Android debug `31442193797`,
  cross-platform contracts `31442193814`, frontend distribution `31442194043`,
  and repository checks `31442193900`.
- The latest handoff commit `63faacd` passed Android debug `31442337446`,
  cross-platform contracts `31442337420`, frontend distribution `31442337411`,
  and repository checks `31442337398`.
- The latest handoff commit `142a15f` passed Android debug `31442474995`,
  cross-platform contracts `31442475005`, frontend distribution `31442475004`,
  and repository checks `31442475073`.
- The latest handoff commit `c624499` passed Android debug `31442696576`,
  cross-platform contracts `31442696525`, frontend distribution `31442696524`,
  and repository checks `31442696523`.
- The latest handoff commit `318903a` passed Android debug `31442847621`,
  cross-platform contracts `31442847662`, frontend distribution `31442847637`,
  and repository checks `31442847610`.
- The latest code commit `1bc3c42` passed Android debug `31443570936`,
  cross-platform contracts `31443570924`, frontend distribution `31443570963`,
  and repository checks `31443570926`.
- The latest code commit `4764d23` passed Android debug `31444753526`,
  cross-platform contracts `31444753488`, frontend distribution `31444753530`,
  and repository checks `31444753540`. Its roadmap acceptance ledger now
  rejects duplicate platform or SteamOS evidence identities instead of
  silently allowing later reports to overwrite earlier ones.
- The latest code commit `9bf2c09` passed Android debug `31445290534`,
  cross-platform contracts `31445290607`, frontend distribution `31445290521`,
  and repository checks `31445290574`. Its production rollout contract now
  rejects TURN or admin checks before deployment unless an admin health
  endpoint is explicitly configured.
- The latest code commit `cf8686d` passed Android debug `31446401958`,
  cross-platform contracts `31446401971`, frontend distribution `31446401959`,
  and repository checks `31446401966`. It rejects TURN credential verification
  when the TURN profile is excluded from the production rollout plan.
- The latest desktop validation commit `6877b75` passed Android debug
  `31448230555`, cross-platform contracts `31448230595`, frontend distribution
  `31448230607`, and repository checks `31448230600`. The Amazon Linux dev
  server built the Linux AppImage and Debian artifacts after explicit package
  identity, desktop-association, and maintainer metadata; this remains
  headless Linux packaging evidence, not hardware or desktop-interaction proof.
- The current Android-hosted Termux probe (`a2378cc`, 2026-08-10) reports
  `/dev/uinput` unavailable/read-write-unverified; input and force-feedback
  were therefore not run. This host also has no Docker, Redis, or coturn
  executable, so it cannot produce production-service or Linux hardware-gate
  evidence. These results are environment boundaries, not completion claims.
- GitHub API inspection on 2026-08-10 returned no registered self-hosted
  runners. The Hardware validation gate, Production rollout, and Roadmap
  acceptance workflows therefore remain operator-triggered definitions only;
  they require a connected target machine/evidence directory and are not
  proven by hosted contract CI.
- Local verification on 2026-08-10 passed repository checks `431/431`, Android
  shell checks `5/5`, and the isolated Werift H.264/Opus loopback test. The
  complete serial suite (`npm run test:serial`) passed `630/634` with 4
  environment-gated skips and 0 failures. The concurrent `npm test` pretest
  can starve that real Werift loopback on constrained Termux/ARM scheduling;
  its packet assertions remain strict and the media wait now allows bounded
  scheduling pressure. CI remains green.
- The AWS full suite on `01ced66` passed 632 of 634 tests with 2 environment-
  gated skips and 0 failures; repository checks passed 431/431.
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
- CodeRabbit completed the visual-matrix review and returned four findings; all
  were fixed in `86b5c67`. A clean re-review is not claimed because the free CLI
  rate limit blocked the immediate follow-up.

## Current change

The current standalone-desktop increment is published through `86b5c67`.
Electron's isolated-state visual harness now covers 44 route/layout snapshots,
six representative interactions, forced presentation and navigation modes,
horizontal-overflow checks, and a reviewed perceptual baseline. Local Electron
contracts pass 26/26; the full serialized suite passes 638 tests with 634
passed, 4 expected environment skips, and 0 failed. AWS matches the committed
baseline 44/44. Physical platform, input, provider, signing, updater, and
long-session release gates remain open.

The current Android bridge increment binds native result delivery to the
request/action pairs issued by each bridge instance. Unsolicited, stale, or
wrong-action `spartan:android-result` events are ignored; matching results are
delivered once and removed from the in-flight set. Focused Android/settings
validation passed 12/12 locally, while the full local suite passed 634 tests
with 630 passed, 4 skipped, and 0 failed; the AWS suite passed 634 tests with
632 passed, 2 skipped, and 0 failed. The change is published at `9d09590`.

The latest Android signing increment adds an environment-only `operatorRelease`
Gradle signing configuration and a deferred `assembleRelease` guard. All four
keystore, alias, and password values are required together; partial
configuration fails during Gradle configuration and missing values fail at the
release task. The Android shell contract is 4/4 locally at `1efa4da`. AWS
debug and full-suite results remain valid from the preceding synchronized
commit, while temporary release-signing verification needs a recovered AWS
host rerun.

The Android release automation increment adds a manually triggered
`android-release` environment workflow. It materializes only a base64-encoded
operator keystore in the runner temp directory, builds the signed release,
verifies it with `apksigner`, uploads the APK and digest, and removes the
keystore in an always-run cleanup step. Its contract is covered by the 5/5
Android shell suite at `4548845`; no signed production artifact is claimed.

The current Android application-shell increment adds `android/app/`, a
Gradle/Kotlin WebView host that packages the shared frontend through
`WebViewAssetLoader`, installs the bounded bridge for the Activity lifecycle,
and routes GameNative/controller/Game Mode actions through native boundaries.
The shell contract passed 2/2 locally and on AWS at `115d7ce`; AWS debug APK
compilation was subsequently verified at `8be92d1`, while release signing and
device validation remain explicitly open.

The current Electron lifecycle increment adds single-instance enforcement and
an allow-listed `spartan://launch?backend=<catalog-id>` protocol handoff.
Second-instance/open-url events restore the primary window and deliver only a
normalized catalog ID through the isolated preload bridge; the dashboard
queues the request until its catalog is ready. The Electron suite passed
16/16 locally and on AWS at `6e315ad`; packaged protocol registration and
physical installed-app behavior remain release validation gates.

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
and `android/bridge/src/main/kotlin/com/spartan/gaming/android/SpartanAndroidBridge.kt`.
Android WebView policy requests now use a
versioned, 16-KiB-bounded message protocol through the optional `SpartanAndroid`
interface; native handlers may separately query Game Mode, controller inventory,
or text input. The bridge fails closed for missing, oversized, malformed, or
unknown actions or non-object payloads and never exposes raw Android objects or
arbitrary command/URL execution. The bridge also forwards only positive,
allow-listed GameNative app IDs and store names to the native handoff. Focused
bridge/runtime validation passed 16/16. Requests carry correlation IDs;
native GameNative payloads are revalidated before the Activity handler, and an
optional native `ResultSink` can dispatch validated
`spartan:android-result` events. Android SDK
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

The current provider-session increment makes Settings -> Providers -> Isolate
provider accounts operational in the Electron shell. Provider launches use a
bounded persistent partition for the active Gaming, Family, Guest, or Default
profile; the disabled setting retains the existing shared compatibility
partition. Approved OAuth child windows inherit the same partition, permission
decisions are partition-scoped, and surface changes or logout close
provider-owned OAuth children. Logout clears storage, HTTP authentication, and
cache data from every managed partition. Unit and Electron contract tests cover
policy normalization and cleanup. Local repository checks passed, the local serial
suite passed 637 of 641 tests with 4 expected host skips, and AWS passed 29/29
Electron contracts plus 639 of 641 serial tests with 2 expected platform skips.
The AWS Xvfb Electron run exercised seven interactions and matched all 44
committed route/layout baselines. This does not close the real-service sign-in,
restart-persistence, expiry, recovery, or account-switching acceptance gate.

CodeRabbit reviewed every tracked file in this increment and returned zero
findings. Its uncommitted-file mode omitted the two new provider-session files;
after they were staged, the immediate follow-up was blocked by the free CLI's
16-minute rolling rate limit. Those files were separately covered by focused
tests and manual review, including canonical profile-list reuse and OAuth-child
lifecycle cleanup.

The next desktop-settings increment makes Settings -> Providers -> Detect
provider sessions operational. The dashboard sends the normalized setting with
each provider launch. A successfully loaded approved provider view contributes
to Electron's application-activity and power-save-blocker policy when detection
is enabled; close, logout, surface replacement, and renderer-loss paths clear
that state. Detection never injects an overlay into a remote provider page, and
disabling it does not prevent a user-directed provider launch. Focused policy,
power, and Electron shell tests cover the enabled and disabled contracts. Local
repository checks passed; the local serial suite passed 637 of 641 tests with 4
expected environment skips. AWS passed 30/30 Electron contracts and 639 of 641
serial tests with 2 expected platform skips, matched 44/44 visual baselines,
exercised all seven maintained interactions, and rebuilt the unpacked Linux app.
CodeRabbit reviewed all 13 changed files in this increment and returned zero
findings.

The current standalone-settings cleanup removes the obsolete
`general.defaultSearch` control, which promised a generic address bar and web
search outside Spartan's approved standalone network boundary. General settings
now use application/workspace/profile terminology, and the visible `New tab`
startup choice is `New session`. The startup resolver retains `New tab` as a
legacy input so older profiles continue to open the local dashboard without
resuming a prior session. Focused settings/profile/startup validation passed
14/14 locally. Local repository checks passed 437/437, and the local serialized
suite passed 637 of 641 with four expected host skips. AWS passed the focused
suite 14/14 and the serialized suite 639 of 641 with two expected platform
skips. After direct inspection of the four intended settings-screen changes,
the refreshed Linux x64 baseline matched all 44 snapshots and all seven
maintained interactions; the unpacked Linux x64 Electron application also
rebuilt successfully. No full desktop environment was required beyond Xvfb.
CodeRabbit reviewed all 10 changed files in this increment and returned zero
findings.

The current desktop performance increment makes `performance.hardwareAcceleration`,
`performance.gpuPreference`, and `performance.processModel` operational in
Electron. The renderer sends the normalized choices to the main process, which
atomically persists a bounded startup policy in the Electron user-data directory
and reports when the active process must restart. On the next launch the policy
is read before Electron becomes ready: hardware acceleration selects the
software-rendering fallback, GPU preference appends `--force-low-power-gpu` or
`--force-high-performance-gpu`, and process model appends `--site-per-process`
or `--enable-low-end-device-mode`. Missing, malformed, and non-boolean values
retain the defaults. Focused startup-policy, renderer-policy, and runtime
validation passes 14/14, and the full Electron contract suite passes 53/53 after
adding bound, switch-application, restart-detection, and persistence coverage.
AWS matched all 44 visual snapshots and exercised twelve maintained interactions,
including changing GPU preference and process model, observing restart-required
state, reading the persisted next-launch policy from disk, reloading the saved
profile, and restoring defaults. AWS visual testing earlier exposed that the
former ESM preload never ran inside the sandboxed renderer; Electron's
documented constraint requires plain JavaScript/CommonJS there. The bridge now
uses `preload.cjs` without weakening sandboxing or context isolation.
Local repository checks pass 442/442 and the serialized suite passes 637 of 641
with four expected host skips; AWS passes 639 of 641 with two expected platform
skips and rebuilt the unpacked Linux x64 application. CodeRabbit identified one
valid concurrent-write race; startup policy writes are now queued per file with
cryptographically random temporary names, and the follow-up review returned
zero findings across all 17 changed files.
The visual harness now pins hidden in-session chrome explicitly for every
layout so the mobile-player baseline cannot inherit state from desktop settings
interactions.

The next practical desktop-settings work remains the unsupported/inert settings
inventory; the GPU preference/process-model startup contract is now wired and
validated, so continue with the remaining inert performance controls (for
example background throttling and power mode) using the same bounded,
restart-safe, fail-closed pattern. Do not implement remote product telemetry or
a generic update service without an explicit standalone endpoint, signed
artifact model, rollback evidence, and network-boundary review.

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
