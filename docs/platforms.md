# Platform strategy

Spartan Gaming is intended to be universal across practical Chromium-supported environments. “Universal” means a shared product and protocol foundation with native platform adapters, not identical feature parity on every device.

| Platform | Initial role | Platform-specific work |
| --- | --- | --- |
| Windows | Primary desktop target | Win32 windowing, DirectX/GPU paths, controller and capture integrations, signing |
| macOS | Primary desktop target | App bundle, Metal/GPU paths, permissions, signing/notarization |
| Linux | Primary desktop target | Ozone/Wayland/X11, VA-API/Vulkan paths, packages, controller/device permissions |
| ChromeOS | Large-screen and lightweight target | ChromeOS integration, kiosk/fullscreen, device and power behavior |
| Android | Mobile and handheld target | Touch controls, Android media codecs, lifecycle, controller UX, Play distribution |
| SteamOS / Steam Deck | Linux handheld target | SteamOS capability signal, Steam Input action/glyph boundary, Gamescope/Game Mode behavior, Proton/native launch, handheld power and physical validation |
| Amazon Fire TV / Fire Stick | Television/browser target | Silk/Chromium-compatible web surface, remote navigation, controller and media capability gates |
| Roku | Television/browser target | Roku browser-capable surface where available, remote navigation, HTTPS provider handoffs |

The frontend now has a capability-driven presentation profile for desktop,
ChromeOS, handheld, mobile, and television classes. Automatic detection is
conservative and can be overridden in Settings; the profile changes focus
targets, navigation hints, touch-control preference, fullscreen preference,
safe-area spacing, and library density. It does not claim native packaging or
TV certification. Apple platforms are outside the supported product scope.
In television mode, the shared controller navigator also focuses the first
available control when the surface starts, so a remote/gamepad can operate the
shell without a pointer. The navigator is installed by the shared PWA/runtime
bootstrap, so the same behavior applies to Dashboard, Settings, Providers,
Emulation, Host, Diagnostics, and other frontend entrypoints. Changing the
presentation mode synchronizes the navigator and tears down polling when a
controller-first surface is no longer selected.

Android mobile policy is window-adaptive: the shared policy classifies the
current Android window as phone, tablet, or foldable from its bounds and
optional native window-segment evidence. Settings expose orientation, wake
lock, PiP, edge-to-edge, mobile-data, and Android Game Mode intent. These are
safe intents for the Android shell; they do not claim that a browser can grant
the corresponding OS permission or lifecycle behavior by itself.

SteamOS is a distinct Linux handheld target, not a user-agent alias for generic
Linux. The host boundary supports an explicitly selected, user-owned Proton
installation on Linux through a shell-free launch plan; Proton is not bundled,
downloaded, or used to bypass DRM, anti-cheat, or authentication. Remaining
SteamOS gates cover Steam Input action/glyph integration, Gamescope/Game Mode,
Deck controls and power behavior, immutable-system packaging, and physical
Steam Deck validation. See Valve's [Steam Deck compatibility
recommendations](https://partner.steamgames.com/doc/steamhardware/compat),
[developer recommendations](https://partner.steamgames.com/doc/steamhardware/recommendations),
[Steam Input guidance](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs),
[Gamescope](https://github.com/ValveSoftware/gamescope), and
[Proton](https://github.com/ValveSoftware/Proton).

## Shared layers

- Gaming dashboard and session model.
- Streaming protocol and quality controller.
- Controller profiles and input mapping.
- Diagnostics and telemetry model.
- Privacy, permission, and account abstractions.
- Provider integration contracts.

## Native adapters

- Windowing and fullscreen.
- GPU and hardware video decode/encode.
- Audio routing.
- Screen capture.
- Controller and HID access.
- Notifications and power behavior.
- Packaging, signing, updating, and platform distribution.

Every feature should declare its support level: `shared`, `platform-adapted`, `experimental`, or `unavailable`.

`host/platform-adapters.mjs` is the shared capability registry for the initial
desktop targets. It describes capture, audio, input, windowing, and packaging
boundaries per OS, reports planned versus ready state, and only invokes an
implementation when the platform and capability both match a `ready`
descriptor. It does not claim that a planned native API is already available.

## Chromium build targets

Linux, macOS, and Windows are the first desktop build targets. Their tracked
development GN templates are in `chromium/args/`, and the source checkout is
external to this repository. Run `node scripts/chromium/check-environment.mjs
--platform <linux|mac|windows>` to validate the local toolchain without
requiring Chromium in CI. Android, ChromeOS, handheld, and TV targets remain
product targets with separate packaging and feasibility gates. Apple platforms
are outside the supported product scope.
