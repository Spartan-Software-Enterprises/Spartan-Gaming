# Fire TV and Roku support

Television navigation, focus, safe areas, horizontal rails, and assisted recovery follow [the UI streaming plan](ui-streaming-plan.md).

Amazon Fire TV/Fire Stick and Roku are supported as television/browser targets
in the universal product model. The shared frontend detects common Fire TV
(`AFT*`/Fire TV) and Roku user-agent signals, switches to the Television
presentation profile, and enables remote/controller-first navigation.

Supported baseline:

- dashboard, settings, provider catalog, and official HTTPS handoffs;
- large-focus-target television navigation and fullscreen requests;
- keyboard-style D-pad, Enter/confirm, and Back/Escape events plus gamepad
  navigation through the shared focus controller;
- configurable remote polling speed, analog dead zone, focus wrapping, pointer
  visibility, and overscan-safe content in the Television settings category;
- capability-gated WebRTC playback, controller access, and browser emulation;
- manual device-mode override when a vendor browser hides its device identity.

Native APK/channel packaging, Amazon store submission, Roku channel packaging,
Roku SceneGraph/native media APIs, and vendor-specific controller behavior are
separate adapters. The shared web surface does not claim those capabilities
until they are built and tested on physical devices. Provider authentication,
DRM, subscriptions, and device-region support remain provider-owned.
