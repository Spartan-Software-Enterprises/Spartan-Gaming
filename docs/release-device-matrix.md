# Device release matrix

Android and desktop releases are one synchronized release unit. Every release tag must produce the named device artifacts below and run the shared verification suite on every platform path before publication.

| Profile                     | Artifact/profile                               | Optimizations and packaging                                                             | Required evidence                                                               |
| --------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Android phone               | Spartan-Gaming-<version>-phone-android.apk     | Touch-first mobile profile, sensor orientation, phone application ID                    | Signed APK, v2 verification, Android shell suite, phone emulator/device install |
| Android tablet              | Spartan-Gaming-<version>-tablet-android.apk    | Large-screen layout and tablet application ID                                           | Signed APK, v2 verification, tablet emulator/device install                     |
| Android foldable            | Spartan-Gaming-<version>-foldable-android.apk  | Window-adaptive/foldable policy and foldable application ID                             | Signed APK, v2 verification, foldable posture/window tests                      |
| Android TV                  | Spartan-Gaming-<version>-androidTv-android.apk | Leanback launcher, no touchscreen requirement, landscape orientation, remote-first UI   | Signed APK, TV emulator/device install, D-pad/Back/focus tests                  |
| Amazon Fire TV / Fire Stick | Spartan-Gaming-<version>-fireTv-android.apk    | Fire TV-compatible leanback metadata, no touchscreen requirement, landscape orientation | Signed APK, Fire TV emulator/device install, remote/media tests                 |
| Linux desktop               | Spartan-Gaming-<version>-linux-*               | Electron desktop package for X11/Wayland and Linux hardware                             | Package inspection, Electron suite, Linux runtime/package checks                |
| SteamOS / Steam Deck        | Spartan-Gaming-<version>-steamos-*             | Handheld presentation, Steam Input/Gamescope/Proton contracts, SteamOS package profile  | Package inspection, SteamOS/Deck runtime and controller/power evidence          |
| Windows desktop             | Spartan-Gaming-<version>-windows-*             | Windows Electron installer/update package                                               | Native signed package, Electron suite, Windows runtime evidence                 |
| macOS desktop               | Spartan-Gaming-<version>-mac-*                 | macOS Electron bundle/update package                                                    | Signed/notarized package, Electron suite, macOS runtime evidence                |

The shared gate is: npm run format:check, npm run check, npm test, npm run test:serial, npm run electron:test, npm run test:android-shell, npm run frontend:build, npm run playwright:smoke, node scripts/playwright/providers-deep.mjs, and node scripts/playwright/full-verification.mjs.

Profile-specific signing, packaging, installation, physical-device, controller, remote-navigation, thermal/power, store, and notarization checks are additive. A shared automated pass never substitutes for missing physical evidence; unsupported hardware gates remain fail-closed.
