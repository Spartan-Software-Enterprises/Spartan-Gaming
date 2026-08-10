# Windows host service

The repository does not vendor a Windows service wrapper. Operators may use
an approved wrapper such as WinSW or NSSM and must review its binary and
installation policy separately. Configure the wrapper with the argument vector
from `npm run host:deployment-plan -- --platform win32`.

The service must run as a dedicated unprivileged account, use a fixed working
directory, bind to localhost by default, and restart only on failure. Keep
`--enable-input`, native-media flags, native-audio flags, signaling tickets,
TLS keys, and virtual-gamepad package settings out of the service definition
unless the operator has explicitly approved those capabilities.

The Windows native package provides SendInput and XInput rumble. It does not
create a virtual gamepad; that capability requires a separately installed and
verified driver adapter passed through `--virtual-gamepad-package`.
