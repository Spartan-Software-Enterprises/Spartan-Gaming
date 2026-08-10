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

