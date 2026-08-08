# iOS/iPadOS compatibility strategy

Status: Web/PWA-first; native engine and App Store distribution remain gated
platform work.

## Product paths

1. **Web/PWA path (default):** serve the shared frontend over HTTPS and use the
   browser engine supplied by the device. This supports the common dashboard,
   official provider handoffs, capability-gated WebRTC playback, touch controls,
   and browser emulation where the current browser exposes the required APIs.
2. **WebKit native shell:** a future iOS/iPadOS wrapper may use the system WebKit
   framework, but it must be treated as a platform-adapted client rather than a
   Chromium/Blink build. Native capture, filesystem, background execution,
   controller, audio, and entitlement behavior require separate implementation
   and on-device validation.
3. **Alternative-engine browser:** a separately maintained browser target may
   use an alternative engine only when Apple grants the relevant entitlement and
   the build is distributed under the applicable regional rules. It must not be
   implied by the normal web frontend or desktop Chromium build.

## Feature policy

| Area | Default web/PWA stance | Native follow-up |
| --- | --- | --- |
| Library and settings | Shared responsive UI | Native lifecycle, links, and storage integration |
| Cloud/provider handoff | Official HTTPS service, subject to provider support | Review each provider’s iOS policy and App Store constraints |
| Remote streaming | Use WebRTC only when capability probing reports it | Validate video/audio/foreground lifecycle and controller behavior on devices |
| Browser emulation | WebAssembly/WebGL/WebGPU only when detected | Evaluate performance, memory pressure, and file-selection UX |
| Fullscreen and capture | Request only from user gestures; tolerate rejection | Implement native presentation/capture paths where permitted |
| Native Chromium/Blink | Not claimed | Separate entitled engine project and security/release process |

The browser cannot infer Apple entitlements from JavaScript. The compatibility
profile therefore defaults to `webkit-required` for iOS/iPadOS and only exposes
`alternative-engine-entitled` when the native wrapper explicitly supplies that
fact to the platform layer.

## Release gates

- Maintain a WebKit/PWA smoke matrix for current iPhone and iPadOS releases.
- Validate WebRTC playback, touch controls, controller discovery, safe areas,
  fullscreen fallback, recording/screenshot behavior, and foreground recovery.
- Keep provider authentication and purchase flows on the official service;
  never invent an embedded entitlement or account integration.
- For a native browser submission, obtain the applicable browser/engine
  entitlements, implement the required isolation/update process, and complete
  App Review/distribution review before changing the support claim.

## Authoritative references

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Web Browser Engine entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.web-browser-engine.host)
- [BrowserEngineKit](https://developer.apple.com/documentation/browserenginekit)
- [Alternative browser engines in the European Union](https://developer.apple.com/support/alternative-browser-engines/)
