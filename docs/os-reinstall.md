# OS reinstall handoff

This repository is the restore point for Spartan Gaming. Large Chromium and
emulator artifacts are stored with Git LFS.

## Restore on a new OS

```bash
git clone https://github.com/Spartan-Software-Enterprises/Spartan-Gaming.git
cd Spartan-Gaming
git lfs install
git lfs pull
npm install
npm run frontend:build
```

Build on the target operating system so Node, Chromium, native adapters, and
installer metadata match the target platform:

```bash
npm run app:package -- --platform linux --installer deb --execute
# macOS:   npm run app:package -- --platform macos --installer dmg-spec --execute
# Windows: npm run app:package -- --platform windows --installer exe-spec --execute
```

The Linux installer declares Chromium libraries, Wine, and PlayOnLinux. The
installed app stores credentials and API keys locally; those secrets are not
committed or restored from Git. Re-enter them in Settings → Accounts & API.

## Verification

```bash
npm test
npm run app:test
git lfs fsck
```

The packaged runtime manifest and SHA-256 inventory are under
`vendor/emulators/`.
