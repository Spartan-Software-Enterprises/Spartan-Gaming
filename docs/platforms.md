# Platform strategy

Spartan Gaming is intended to be universal across practical Chromium-supported environments. “Universal” means a shared product and protocol foundation with native platform adapters, not identical feature parity on every device.

| Platform | Initial role | Platform-specific work |
| --- | --- | --- |
| Windows | Primary desktop target | Win32 windowing, DirectX/GPU paths, controller and capture integrations, signing |
| macOS | Primary desktop target | App bundle, Metal/GPU paths, permissions, signing/notarization |
| Linux | Primary desktop target | Ozone/Wayland/X11, VA-API/Vulkan paths, packages, controller/device permissions |
| ChromeOS | Large-screen and lightweight target | ChromeOS integration, kiosk/fullscreen, device and power behavior |
| Android | Mobile and handheld target | Touch controls, Android media codecs, lifecycle, controller UX, Play distribution |
| iOS/iPadOS | Conditional mobile target | Apple browser-engine, entitlement, distribution, and media constraints |
| TV/embedded | Later exploration | Remote navigation, gamepad UX, television display and input constraints |

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

