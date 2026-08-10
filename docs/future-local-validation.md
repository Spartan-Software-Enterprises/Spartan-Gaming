# Future local validation lab

This runbook defines the future operator-controlled lab required to close the
acceptance gates that the current AWS Amazon Linux development server cannot
prove. It is intentionally separate from the remote Linux contract-validation
host. Do not mark a gate complete from a plan, capability description, VM
claim, or browser-only test.

## What the AWS dev server cannot prove

The current server is useful for Linux package builds, Linux uinput exercise,
service contracts, headless Chromium, Playwright, and remote CI reproduction.
It cannot provide reliable evidence for:

- real Windows and macOS capture, audio, display, input, haptics, and packaged
  Electron behavior;
- the final Linux gate on a representative physical Linux desktop with a real
  display, audio device, GPU, and controller;
- Windows virtual gamepad drivers or macOS virtual gamepad drivers installed
  and exercised on their target operating systems;
- physical Xbox, PlayStation, Nintendo, handheld, wheel, HOTAS, adaptive
  trigger, gyro, touchpad, and multi-controller combinations;
- Android APK installation, lifecycle, PiP, orientation, touch, Game Mode,
  GameNative handoff, or Android permission behavior on real devices;
- Fire TV / Fire Stick and Roku remote navigation, packaging, certification,
  display safe areas, and vendor runtime behavior;
- real GPU WebGPU, HDR, AV1 decode/encode, high-refresh, multi-display,
  fullscreen, capture, and end-to-end input-to-photon behavior;
- production activation, public DNS, operator-managed production secrets,
  external package-signing custody, or release artifact notarization.

Apple mobile/iOS validation remains out of product scope.

## Researched feature and function register

This register is the standing backlog for features that are already represented
by shared contracts or have been identified during platform research. “Local
lab” means the feature can be designed and contract-tested remotely, but final
behavior must be exercised on the target device or operating system.

| Feature/function | Remote status | Local-lab work |
| --- | --- | --- |
| Electron Provider Player isolation, permission prompts, navigation limits, IPC sender validation, and caption track selection | Contract-tested | Launch packaged builds on every desktop OS and test real remote-provider handoffs and caption tracks |
| Electron fullscreen, quit guard, background behavior, tray restore/quit actions, power mode, native power telemetry, and privacy controls | Contract-tested, including tray policy, runtime synchronization, bounded power events, and session-aware power-save blocking | Verify native window behavior, tray icon/menu behavior, suspend/resume, thermal/speed-limit events, GPU use, permissions, and shutdown on Windows/macOS/Linux |
| Hardware display capture and system/microphone audio | Linux wrapper verified | Verify OS permission prompts, physical displays, audio devices, source selection, and teardown on every desktop OS |
| WebGPU, hardware decode, AV1, HDR, high refresh, multi-display, and display targeting | Browser capability/policy contracts | Test real GPUs, monitors, HDR modes, refresh rates, fullscreen targets, and power/thermal behavior |
| PWA install surface, install prompt, launch display fallbacks, launcher shortcuts, and offline shell caching | Manifest/icon/service-worker contracts and deferred install-prompt controller tested; manifest is explicitly precached | Install from supported desktop/mobile browsers and verify prompt availability, icons, shortcut launch targets, display-mode fallbacks, update recovery, and offline startup |
| Active-session screen wake lock | Shared controller is contract-tested; it starts only for connected/reconnecting sessions, reacquires after visibility recovery, and fails closed when unsupported or denied | Verify browser/WebView policy, Android battery behavior, desktop sleep prevention, and release on end/background across target devices |
| Universal controller profiles, HID, rumble, gyro, touchpad, adaptive triggers, wheels, HOTAS, Android controller inventory, and multiple players | Shared normalization and negotiation tested; Android gamepad/joystick inventory is bounded to metadata and approved capabilities | Exercise the controller bench and native driver paths with real devices |
| Windows/macOS virtual gamepad injection | Package boundary tested only | Install, verify, exercise, uninstall, and recover the signed target driver |
| Android touch layout, lifecycle, orientation, PiP, edge-to-edge, Game Mode, large-screen and foldable behavior | Shared Android policy and API-31+ `GameManager` query-on-resume contract tested | Build/install APKs and test phones, tablets, foldables, permissions, rotation, PiP, Game Mode changes, and resume flows |
| SteamOS / Steam Deck handheld profile, Steam Input, Gamescope, Proton/native launch, and Game Mode behavior | Explicit SteamOS host profile, bounded 1280×800/30-40-60 policy, Gamescope plan, portable Steam Input action/glyph contract, action-level capability negotiation for trackpads/gyro/rear buttons/touchscreen/text entry/haptics/controller navigation, launch-mode readiness metadata, Proton launch boundary, battery-aware session quality policy, and shared handheld/controller contracts tested; SteamOS-specific runtime behavior remains gated | Test a physical Deck and supported SteamOS host in Desktop/Game Mode, with the installed Steam Input bridge, glyphs/actions, text entry, trackpad/gyro/rear controls, haptics, controller-only navigation, Gamescope, suspend/resume, battery, external display, Steam/non-Steam handoffs, and real Proton/native games |
| GameNative handoff | Kotlin contract tested | Test installed/missing GameNative, supported stores, intent resolution, release fallback, and Android lifecycle |
| Fire TV remote/gamepad focus navigation and lean-back playback | Shared television profile plus keyboard-style D-pad/Back navigation tested | Test D-pad focus, Back/Home/microphone interruption, Bluetooth controllers, safe areas, and vendor packaging |
| Roku remote navigation and playback surface | Shared television profile tested | Verify the actual Roku runtime, packaging/certification feasibility, focus model, playback, and controller limits |
| WebRTC/WebTransport/WebSocket transport fallback and session recovery | Protocol and fake-transport tests passed | Exercise real WAN/LAN loss, NAT/TURN paths, reconnects, datagrams, media continuity, and device sleep/wake |
| Screenshots, local recording, instant replay, Media Session, and Picture-in-Picture | Browser contracts tested | Verify codecs, storage permissions, sustained recording, battery/thermal impact, and OS media controls |
| Signed adapters, native packages, updates, rollback, and external signing custody | Verification and rollback contracts tested; SteamOS user-scope Flatpak plans now cover digest-gated install, update, uninstall, commit-pinned rollback, and consent-gated desktop/Steam non-Steam registration metadata without executing the package manager or Steam | Use the signing service/HSM boundary and install signed artifacts on every target OS, including a physical immutable SteamOS host; perform actual desktop and Steam registration there |
| Production Redis, TURN, TLS, DNS, rollout, and secret rotation | Dev services and preflight verified | Run operator-controlled production activation, external monitoring, rotation, rollback, and incident recovery |

The Android and large-screen items follow the platform guidance for PiP,
large-screen continuity, and controller support; Fire TV remote input is based
on Android key/input-device behavior. Electron validation follows the current
security requirements for context isolation, sandboxing, permission handlers,
restricted navigation, and current Electron releases.

Research references: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security),
[Electron powerMonitor](https://www.electronjs.org/docs/latest/api/power-monitor/),
[Electron powerSaveBlocker](https://www.electronjs.org/docs/latest/api/power-save-blocker),
[HTML media text tracks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/textTracks),
[Roku closed captions](https://developer.roku.com/dev/docs/closed-caption),
[PWA display modes](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display_override),
[PWA shortcuts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts),
[Android PiP](https://developer.android.com/develop/ui/views/picture-in-picture),
[Android Game Mode API](https://developer.android.com/games/optimize/adpf/gamemode/gamemode-api),
[Android Game Controller Library](https://developer.android.com/games/sdk/game-controller),
[Android large-screen quality](https://developer.android.com/docs/quality-guidelines/archive/adaptive/large-screen-app-quality),
[Fire TV remote input](https://developer.amazon.com/docs/fire-tv/remote-input.html), and
[Fire TV controller identification](https://developer.amazon.com/docs/fire-tv/identify-controllers.html),
[Steam Deck compatibility](https://partner.steamgames.com/doc/steamhardware/compat),
[SteamOS recommendations](https://partner.steamgames.com/doc/steamhardware/recommendations),
[Steam Input](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs),
[Gamescope](https://github.com/ValveSoftware/gamescope), and
[Proton](https://github.com/ValveSoftware/Proton), and
[Flatpak command reference](https://docs.flatpak.org/en/latest/flatpak-command-reference.html).

## Required lab matrix

At minimum, provide these operator-controlled targets:

| Target | Required evidence |
| --- | --- |
| Windows 11 desktop | Electron package launch, display/audio capture, controller input, rumble, signed virtual-gamepad driver exercise |
| macOS supported release | Electron package launch, Screen Recording/Microphone/Input Monitoring permissions, capture/audio, controller/haptics, signed virtual-gamepad driver exercise |
| Physical Linux desktop | X11 or Wayland capture, PipeWire/Pulse audio, `/dev/uinput`, physical controller, force feedback, GPU codecs |
| Android phone/tablet/foldable | APK install, lifecycle, orientation, PiP, touch layout, Game Mode, GameNative handoff, permissions |
| Fire TV / Fire Stick | Remote focus navigation, safe area, playback, app/browser packaging feasibility |
| Roku target | Remote navigation, web surface feasibility, playback, packaging/certification feasibility |
| Controller bench | Xbox/XInput, DualSense/DInput, Nintendo layout, generic HID, wheel/HOTAS, gyro/touchpad/adaptive trigger where available |
| Signing workstation/service | Per-platform signed manifests, public-key verification, custody audit, installer/package verification |

The lab may use separate physical machines. A VM is acceptable for contract
tests, but it does not substitute for a physical hardware or driver gate.

## Evidence collection

Each target must produce a secret-free report with:

- platform, OS version, hardware class, and test-run timestamp;
- exact Spartan commit and native package version;
- capture, audio, input, haptics, display, codec, and driver results;
- executed test names and explicit pass/fail reasons;
- package digest and signature metadata without private key material;
- redacted logs and screenshots where useful;
- operator identity/custody reference stored outside Git.

Store reports in a protected evidence directory, for example. Use canonical
report platform IDs (`win32`, `darwin`, `linux`) even when a CLI accepts the
friendly aliases `windows` or `macos`:

```text
evidence/
  hardware/{win32,darwin,linux}.json
  native/{win32,darwin}-virtual-gamepad.json
  signing/{win32,darwin,linux}.json
  production/rollout.json
```

Initialize and validate the directory before running any report command:

```bash
: "${EVIDENCE:?Set EVIDENCE to a dedicated protected evidence directory}"
case "$EVIDENCE" in /|/tmp|/home|/root) echo "unsafe EVIDENCE path" >&2; exit 1;; esac
install -d -m 700 "$EVIDENCE"/{hardware,native,signing,production}
chmod 700 "$EVIDENCE" "$EVIDENCE"/{hardware,native,signing,production}
```

Use mode `0700` for the directory tree and mode `0600` for reports. Never commit
private keys, signing tokens, AWS credentials, provider credentials, TLS keys,
or raw authentication callbacks.

## Gate commands

On each physical desktop target, build the matching native package and run:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run native:build-linux                 # Linux target only
npm run native:verify-desktop -- --platform <linux|win32|darwin> \
  --execute --confirm --require-hardware --require-execution \
  --report-file "$EVIDENCE/hardware/<platform>.json"
```

On Windows and macOS, run the signed virtual-gamepad verifier only after the
driver has been installed through its documented, user-consented installer:

```bash
npm run native:verify-virtual-gamepad -- --platform <win32|darwin> \
  --execute --confirm --require-driver \
  --report-file "$EVIDENCE/native/<platform>-virtual-gamepad.json"
```

After signed package reports and the production report are present, run:

```bash
npm run roadmap:acceptance -- \
  --production-report "$EVIDENCE/production/rollout.json" \
  --hardware-report "$EVIDENCE/hardware/win32.json" \
  --hardware-report "$EVIDENCE/hardware/darwin.json" \
  --hardware-report "$EVIDENCE/hardware/linux.json" \
  --virtual-gamepad-report "$EVIDENCE/native/win32-virtual-gamepad.json" \
  --virtual-gamepad-report "$EVIDENCE/native/darwin-virtual-gamepad.json" \
  --signed-package-report "$EVIDENCE/signing/win32.json" \
  --signed-package-report "$EVIDENCE/signing/darwin.json" \
  --signed-package-report "$EVIDENCE/signing/linux.json" \
  --report-file "$EVIDENCE/acceptance.json"
```

The final status is accepted only when every gate reports `verified` and the
result is `complete`. Missing hardware, missing drivers, missing custody, or
missing production evidence must remain visible as blockers.

## Local GUI and device QA

Use Playwright for browser surfaces on each available desktop browser, but
also launch the packaged Electron app on each desktop OS and capture evidence
for startup, navigation, provider handoff, fullscreen, quit guard, permission
prompts, controller focus, and clean shutdown. Use real Android and television
devices for their device-specific flows. Browser emulation alone is not device
acceptance evidence.

## Handoff requirement

When this lab becomes available, update
`SPARTAN_GAMING_CLI_HANDOFF.md` with report paths, commit IDs, exact commands,
and gate results. Keep credentials in the protected operator environment and
record only their locations and custody references.
