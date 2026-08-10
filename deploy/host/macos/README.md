# macOS host service

`com.spartan.gaming.host.plist` is a launchd template for an operator-owned
host installation. Replace the paths and identity placeholders before copying
it to `/Library/LaunchDaemons/`.

The template starts the host bound to localhost and leaves remote input,
native media, and native audio disabled. Use `npm run host:deployment-plan` to
produce the authoritative shell-free argument vector when adding an installed
native package or an operator-installed virtual-gamepad adapter.

Pairing tickets and TLS material must be supplied through a short-lived
supervisor environment or secret manager; never write them into the plist.
