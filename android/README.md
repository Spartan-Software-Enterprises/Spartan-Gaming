# Spartan Gaming Android integration

This directory is the Android-side contract for the universal Spartan Gaming
product. The Electron/Web UI remains the primary desktop surface; Android uses
the same catalog and protocol, with device-specific handoffs kept here.

## GameNative

`GameNativeHandoff.kt` is a small Apache-2.0 Spartan bridge for the separately
distributed GPLv3 GameNative application. It launches only the documented
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
