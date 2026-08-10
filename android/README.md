# Spartan Gaming Android integration

This directory is the Android-side contract for the universal Spartan Gaming
product. The Electron/Web UI remains the primary desktop surface; Android uses
the same catalog and protocol, with device-specific handoffs kept here.

## Android application shell

`app/` is the native Android WebView shell. Its Gradle build copies the shared
`src/frontend` tree into the APK assets, serves it through AndroidX
`WebViewAssetLoader` on the app-only HTTPS asset origin, and installs the
bounded `SpartanAndroid` bridge for policy, Game Mode, controller inventory,
text-input, and GameNative requests. External HTTPS destinations leave the
WebView; cleartext traffic, arbitrary file access, and arbitrary native URLs
are disabled.

From a machine with an Android SDK and Java 17 available:

```bash
npm run test:android-shell
npm run android:build
```

AWS now has the pinned command-line toolchain (Java 17, Gradle 8.11.1,
Android API 35/build-tools 35.0.0), and `:app:assembleDebug` passed at commit
`62785ff`. The verified debug APK is 1,628,083 bytes with SHA-256
`386b910893b8a2ab884d2ea7f17f7869910e00d60da49020cfbce5b93d3024ab`.
The same wrapper build is enforced by `.github/workflows/android-debug.yml`,
which uploads the debug APK as a short-retention CI artifact.
Release signing, permissions, WebView lifecycle, and physical device behavior
remain lab gates. Android Studio is not required on the headless build server;
the committed wrapper provides the reproducible CLI build.

## GameNative

`GameNativeHandoff.kt` is a small Apache-2.0 Spartan bridge for the separately
distributed GPLv3 GameNative application. The upstream project is maintained
as the `CKissinger1988/GameNative` fork of `utkarshdalal/GameNative`; Spartan
tracks the official package/action contract but does not vendor that source.
It launches only the documented
`app.gamenative.LAUNCH_GAME` action, validates the numeric store app ID and
supported store before creating the intent, and targets the official
`app.gamenative` package. It does not copy GameNative code, install an APK,
handle credentials, or inject container configuration.

If GameNative is not installed, the Android shell may open its official HTTPS
release page. Installation and Android permissions always remain user actions.

The bridge intentionally requires an app ID selected from Spartan's verified
user-owned library. It never guesses IDs from names or sends arbitrary URLs to
the GameNative activity.

## Mobile policy boundary

The shared frontend exposes `src/frontend/platform/android.mjs` for the
Android shell to consume. It classifies the current window as a phone, tablet,
or foldable using window bounds and optional window-segment data, then emits
bounded intents for orientation, wake lock, PiP, edge-to-edge layout, mobile
data savings, and Android Game Mode. The shell remains responsible for binding
those intents to Android APIs and reporting whether each request was accepted.

`gamemode/AndroidGameModeBridge.kt` is the native Game Mode boundary. On
Android 12+ it queries `GameManager` from `Activity.onResume()`, reports the
observed system mode, and fails closed below API 31 or when the service is not
available. The application does not attempt to change the system-selected
mode; the shared frontend records the requested mode separately.

`controller/AndroidControllerInventory.kt` provides a metadata-only inventory
of Android gamepad/joystick sources, including bounded device identity fields
and vibrator presence. It is intended to feed the shared controller profile
normalizer; raw `InputDevice` or input-event objects never cross the bridge.

`src/frontend/input/text-entry.mjs` defines the shared controller/IME text-entry
boundary. It preserves bounded text, selection, and composition ranges for
Steam Deck and Android keyboard flows, but only marks an IME `show` request
allowed when it came from a focused user gesture. The matching
`text-input/AndroidGameTextInputContract.kt` is metadata-only: the Android
shell must bind the official GameTextInput C API/Prefab library and report the
result. Spartan does not expose raw `InputConnection` objects or claim Android
keyboard behavior until an Android build and device test pass.

## WebView bridge

`bridge/src/main/kotlin/com/spartan/gaming/android/SpartanAndroidBridge.kt` is
the narrow JavaScript bridge for an Android shell.
Install one instance on the primary WebView with `addJavascriptInterface` under
the name `SpartanAndroid`; the shared frontend then sends versioned messages
through `postMessage`. The bridge accepts only the bounded actions
`android.policy`, `android.game-mode.query`, `android.controllers.snapshot`,
`android.text-input`, and `android.gamenative.launch`, rejects non-object
payloads, and forwards valid requests to an Activity-owned `Handler`.
Every request carries a bounded correlation ID. An optional `ResultSink` can
emit `{requestId, action, accepted}` results for the Activity to dispatch as a
`spartan:android-result` event to the WebView.

The bridge itself enforces a positive numeric library app ID and one of
`STEAM`, `EPIC`, `GOG`, or `AMAZON` before calling the handler. The Activity
handler should then delegate to `GameNativeHandoff` so package resolution and
the official release fallback remain user-mediated.

The bridge never exposes a `Context`, raw `InputDevice`, `InputConnection`, or
arbitrary command/URL surface to JavaScript. The Activity remains responsible
for WebView lifecycle, origin policy, Android permissions, GameTextInput,
GameNative consent, and native result callbacks. This contract still requires
Android SDK compilation and physical device validation; the repository shell
test does not substitute for an APK build or device run.
