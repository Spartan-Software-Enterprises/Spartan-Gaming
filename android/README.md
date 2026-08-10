# Spartan Gaming Android integration

This directory is the Android-side contract for the universal Spartan Gaming
product. The Electron/Web UI remains the primary desktop surface; Android uses
the same catalog and protocol, with device-specific handoffs kept here.

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

`SpartanAndroidBridge.kt` is the narrow JavaScript bridge for an Android shell.
Install one instance on the primary WebView with `addJavascriptInterface` under
the name `SpartanAndroid`; the shared frontend then sends versioned messages
through `postMessage`. The bridge accepts only the bounded actions
`android.policy`, `android.game-mode.query`, `android.controllers.snapshot`,
and `android.text-input`, rejects non-object payloads, and forwards valid
requests to an Activity-owned `Handler`.

The bridge never exposes a `Context`, raw `InputDevice`, `InputConnection`, or
arbitrary command/URL surface to JavaScript. The Activity remains responsible
for WebView lifecycle, origin policy, Android permissions, GameTextInput,
GameNative consent, and native result callbacks. This contract is compile and
device-lab work until an Android shell is added and exercised on real targets.
