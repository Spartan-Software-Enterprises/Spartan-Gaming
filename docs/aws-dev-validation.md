# AWS Linux validation host

This runbook describes a low-cost Amazon Linux 2023 host for reproducible
Spartan Gaming Linux checks. It is a development and contract-validation host,
not evidence of Windows/macOS hardware support or a production relay.

Keep the instance security group restricted to the operator's SSH address.
Do not open game, signaling, Redis, TURN, or administration ports until a
reviewed production configuration and TLS boundary are ready.

## Install the project toolchain

Clone `main`, install the repository-compatible Node release, and install
Docker without starting a deployment:

```bash
sudo dnf install -y nodejs22 docker
sudo alternatives --set node /usr/bin/node-22
sudo systemctl enable docker
sudo usermod -aG docker "$USER"
cd ~/Spartan-Gaming
npm ci --ignore-scripts --no-audit --no-fund
```

The repository requires Node 20 or newer. Log in again after changing group
membership before using Docker as the unprivileged user.

## Enable bounded Linux uinput checks

The virtual-gamepad probe needs a dedicated device group. This grants the
operator account access only to `/dev/uinput`; it does not grant access to
network ports or claim a physical controller:

```bash
sudo groupadd --system spartan-gaming 2>/dev/null || true
sudo usermod -aG spartan-gaming "$USER"
printf '%s\n' 'KERNEL=="uinput", GROUP="spartan-gaming", MODE="0660"' \
  | sudo tee /etc/udev/rules.d/99-spartan-uinput.rules >/dev/null
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=misc --sysname-match=uinput

# Also install deploy/host/linux/99-spartan-gamepad.rules so the generated
# virtual gamepad event node is readable/writable without broad input access.
sudo install -m 0644 deploy/host/linux/99-spartan-gamepad.rules \
  /etc/udev/rules.d/99-spartan-gamepad.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=input --sysname-match=event*
```

After logging in again, build and exercise the Linux input boundary:

```bash
npm run native:build-linux
npm run native:verify-linux -- \
  --install-root "$PWD/out/native-linux/install" \
  --execute --report-file /tmp/spartan-linux-input.json
```

The report must say `status: ready` and `input: verified`. Run the optional
`--rumble` check separately; a headless cloud VM may expose uinput while still
lacking a kernel or device path capable of force feedback.

## Current development evidence

On commit `b669886`, the Amazon Linux host ran the standalone Electron visual
matrix twice under Xvfb. The real Electron main process loaded the private
`spartan-app://app` origin without a frontend HTTP server and used a fresh
temporary user-data directory. It rendered all 11 maintained routes at desktop
(1440x900), handheld (1280x800), mobile (390x844), and television (1920x1080)
layouts: 44 screenshots with meaningful bodies, the expected presentation and
navigation mode, and no document-level horizontal overflow. It also exercised
dashboard search in every layout, desktop global-shortcut persistence, and
television remote focus.

The first run created the reviewed `electron-linux-x64.json` perceptual
baseline; the second independently captured all routes and matched 44/44 with
zero mismatches. Exact PNG SHA-256 values remain in the evidence while bounded
32x32 luminance signatures avoid false failures from harmless live diagnostics
pixels. Contact sheets for all four layouts were visually inspected; no blank
route, broken styling, overlapping primary control, or obvious clipping was
observed. Screenshots and the candidate report remain under
`/home/ec2-user/Spartan-Gaming/out/playwright/electron`. This is virtual-display
Linux evidence, not physical display, controller, audio, haptics, or
other-platform approval.

The visual host has `Xvfb`, `ImageMagick`, and `dbus-x11` installed. No desktop,
VNC, RDP, or public application port is required; Xvfb is the minimal display
layer for repeatable Electron screenshots.

On 2026-08-11, the Amazon Linux host built the final `6877b75` Electron
desktop package configuration after installing the bounded packaging
prerequisites `ruby` and `libxcrypt-compat` required by Electron Builder's
bundled FPM on Amazon Linux. `npm run electron:test` passed all 16 Electron
contract tests. `npm run desktop:package` produced both
`Spartan-Gaming-0.1.0-linux-x86_64.AppImage` (120,320,592 bytes) and
`Spartan-Gaming-0.1.0-linux-amd64.deb` (93,250,768 bytes), plus the Linux
update manifest. The Debian payload contains the synchronized
`com.spartan.gaming.desktop` entry with `StartupWMClass=com.spartan.gaming`,
the `spartan://` handler, and the expected package metadata. An Xvfb launch
opened the unpacked Electron process, but this headless cloud probe does not
exercise interactive windows, real displays, audio, input, haptics, or
desktop-environment integration.

On 2026-08-11, the provider-session isolation increment was synchronized to
the same Amazon Linux host before publication. `npm run electron:test` passed
29/29 contracts. Running `npm run playwright:electron` through Xvfb exercised
all 44 maintained desktop, handheld, mobile, and television route snapshots,
all seven maintained interactions, and matched the committed Linux baseline
44/44 with no horizontal overflow. `npm run test:serial` passed 639 of 641
tests with 2 expected platform skips and 0 failures. This verifies the bounded
partition policy and Electron wiring on Linux; it does not substitute for real
provider sign-in, restart persistence, session-expiry recovery, or account
switching evidence.

The follow-up provider auto-detection increment passed 30/30 Electron
contracts on the Amazon Linux host. The full serial suite passed 639 of 641
tests with 2 expected platform skips and 0 failures; the Xvfb Electron matrix
again matched 44/44 baselines across all four layouts and seven interactions.
The synchronized tree also rebuilt the unpacked Linux application. This proves
the bounded provider-activity and shared power-policy contracts on Linux, not a
real external provider stream or hardware power/suspend behavior.

The same synchronized tree also completed `npm run desktop:package -- --dir`
and launched the unpacked `Spartan-Gaming` executable under Xvfb for the
bounded startup probe. `xdg-utils` and `desktop-file-utils` are installed so
the packaged app can exercise Linux desktop/protocol registration helpers;
the server still uses a virtual display rather than a full desktop session.

The configured Amazon Linux 2023 development host has been synchronized with
`main` and has successfully run the repository dependency install, Linux
native package build, executable `/dev/uinput` button/axis sequence, and the
full desktop exercise using the Docker-pinned FFmpeg wrapper. The latest Linux
hardware report recorded `status: ready` with capture, audio, input, and
haptics verified. The host also runs the reference signaling, Redis, and TURN
development services. These results remain Linux-host evidence only; they do
not prove Windows, macOS, Android hardware, Fire TV, Roku, or production
package signing.

The latest remote Chromium/Playwright pass used Playwright 1.55.0 and headless
Chromium on commit `7c996e1`, using the repository-owned
`scripts/playwright/smoke.mjs` with `SPARTAN_PLAYWRIGHT_MODULE` pointed at the
temporary AWS installation. It covered 11 maintained routes at 1280x800 and
390x844, including dashboard, settings, player, diagnostics, adapters,
emulation, host, workspaces, providers, and both controller tools. All 22
navigations returned 200 with meaningful bodies, dashboard search and settings
controls rendered, and mobile horizontal overflow was false. The exact report
is retained at
`~/.config/spartan-dev/evidence/playwright/spartan-playwright-runner.json`; it is
protected evidence outside Git. Headless Chromium may report a non-fatal
WebGPU initialization warning. Retain artifacts only in the protected evidence
directory:

```bash
evidence="$HOME/.config/spartan-dev/evidence/playwright"
install -d -m 700 "$evidence"
cp -a /tmp/spartan-playwright-results "$evidence/"
cp /tmp/spartan-playwright-pure.json "$evidence/spartan-playwright-runner.json"
chmod -R go-rwx "$evidence"
rm -rf /tmp/spartan-playwright-results /tmp/spartan-playwright-pure.json
```

The protected copies are outside Git at
`~/.config/spartan-dev/evidence/playwright/`.

The standalone Electron application has a separate visual smoke command that
never starts the frontend test server:

```bash
xvfb-run -a --server-args="-screen 0 1440x900x24" npm run playwright:electron
```

It launches the real Electron main process, requires the private
`spartan-app://app` origin, captures every maintained application route at all
four release layouts, exercises representative interactions, and compares the
result with `scripts/playwright/baselines/electron-linux-x64.json`. Use
`npm run playwright:electron:candidate` only for an intentional UI change,
visually inspect its `out/playwright/electron/visual-baseline.json` and contact
sheets, then update the reviewed baseline in the same commit. Copy
`out/playwright/electron/` into the protected evidence directory after a
passing run; do not commit generated screenshots.

The controller-settings verification increment runs 44/44 matched route
snapshots with no horizontal overflow and seven representative interactions.
The desktop controller interaction changes player slots, dead zone, and input
polling through Settings, opens the bundled Controller Tester, and requires the
exact normalized policy summary before restoring defaults for the remaining
layout matrix. The tester screenshots were visually inspected at desktop,
mobile, and television sizes; the policy summary remains readable and the
existing panels retain their intended layout.

### Connection and host inventory

The following identifies the existing development host without publishing any
secret material:

| Field                  | Value                                                   |
| ---------------------- | ------------------------------------------------------- |
| AWS instance           | `i-0d3d5c3c1724d02f4`                                   |
| Instance type          | `t3.small`                                              |
| OS                     | Amazon Linux 2023                                       |
| Region/AZ              | `us-east-1b`                                            |
| Public address         | Resolve at connection time; not reserved and may change |
| Disk                   | 30 GiB encrypted gp3                                    |
| SSH source restriction | `173.80.1.14/32`                                        |
| Project checkout       | `/home/ec2-user/Spartan-Gaming`                         |
| Frontend test origin   | `http://127.0.0.1:4173` (SSH-local only)                |
| Evidence directory     | `/home/ec2-user/.config/spartan-dev/evidence`           |

Resolve the current address from the instance ID and region, then connect:

```bash
instance_id='i-0d3d5c3c1724d02f4'
region='us-east-1'
public_ip="$(aws ec2 describe-instances --region "$region" \
  --instance-ids "$instance_id" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)"
ssh -i ~/.ssh/spartan-dev "ec2-user@$public_ip"
```

The private key is operator-managed at
`/data/data/com.termux/files/home/.ssh/spartan-dev` on the development device.
Private keys, passwords, TLS private keys, Redis credentials, TURN secrets,
and provider credentials must never be copied into this repository, README,
handoff, issue, or chat transcript. The host's secret files are referenced by
path and environment configuration only; their values are intentionally
redacted. Rotate the key or service secrets through the operator's secret
store if exposure is suspected.

The installed toolchain is Git, Rust/Cargo, GCC, CMake, Node.js/npm, Python,
Docker, Xvfb, ImageMagick, dbus-x11, xdg-utils, desktop-file-utils, and the
Amazon Linux GUI/media dependencies needed by Chromium and Electron. Playwright
1.62.1 is pinned in the repository;
an older Playwright 1.55.0 installation remains available only for the legacy
browser smoke harness. The development services are Redis,
signaling, and TURN;
no public game ports are opened.
The report is retained outside Git at
`~/.config/spartan-dev/evidence/production/rollout.json`.

The development rollout report is regenerated with
`NODE_EXTRA_CA_CERTS=/home/ec2-user/.config/spartan-dev/tls.crt`, allowing the
strict TLS probe to trust the operator-local self-signed certificate without
disabling verification. Running `scripts/roadmap/acceptance.mjs` with that
rollout report verifies only the `production-services` contract when the report
includes external-secret custody, configured TLS, the Redis broker backend, and
reachable TURN network probing. The full acceptance result remains
`incomplete` because no real Windows/macOS/Linux
hardware reports, desktop virtual-gamepad driver exercises, or signed package
reports were supplied.

This is deliberately not production acceptance evidence: the host uses
operator-local development secrets and a development TLS setup, has no public
game ports, and cannot prove physical Windows/macOS devices, desktop virtual
gamepad drivers, or external signing custody. The Linux force-feedback probe
also remains a separate capability result from basic uinput input readiness.

## SSH recovery procedure

On 2026-08-10 the configured host repeatedly timed out during the SSH banner
after a small-host Gradle release-signing workload. Treat that as an
infrastructure incident, not as proof of a code or signing result. Before any
state-changing action, use the protected AWS inventory to inspect the instance
state, system-status checks, CPU-credit balance, security-group source range,
and current public address. Do not stop/start, resize, replace, or open ports
on this instance without a cost and network review: the address is ephemeral
and the project is subject to an AWS credit limit.

After SSH recovers, run `uptime`, inspect for leftover Gradle/Java processes,
confirm `git status -sb`, and then rerun only bounded Android or repository
commands. If the host remains unavailable, GitHub Actions is the authoritative
fallback for repository, cross-platform, and Android debug contract checks;
those results must not be described as physical hardware or production
evidence.

## Evidence boundary

This host can provide Linux package-build and uinput-input evidence. It does
not satisfy the roadmap's real-hardware gate unless capture, audio, haptics,
and the required device capabilities are exercised successfully. It cannot
provide Windows or macOS virtual-device-driver evidence. Production rollout
also requires operator-managed secret files, TLS, Redis, TURN, and external
package-signing custody; none should be fabricated on this validation host.

The 2026-08-10 standalone-settings validation passed the focused
settings/profile/startup suite 14/14 and the serialized repository suite 639 of
641 with two expected platform skips. The intended removal of the obsolete
generic-search control changed the settings screenshots; handheld, mobile,
television, and desktop candidates were inspected directly for readable
reflow, clipping, and overflow before updating only those four baseline
fingerprints. A second Xvfb run then matched all 44 Linux x64 snapshots,
exercised all seven maintained interactions, and rebuilt the unpacked Linux
x64 Electron application successfully. Xvfb remains sufficient for this
automated desktop matrix; a full desktop environment is not currently needed.
CodeRabbit reviewed all 10 changed files in this increment and returned zero
findings.

The 2026-08-11 Electron startup-policy run corrected the primary window preload
from unsupported sandboxed ESM to CommonJS while retaining `sandbox: true` and
context isolation. The Xvfb matrix then matched all 44 Linux x64 snapshots and
completed eight interactions. The new performance interaction changed hardware
acceleration through the real preload/IPC bridge, received restart-required
state, verified profile persistence after reload, inspected the bounded policy
file in the temporary Electron user-data directory, and restored the launch
value before continuing the layout matrix.
AWS also passed the 34/34 Electron contract suite and rebuilt the unpacked Linux
x64 application. CodeRabbit's initial review found a concurrent startup-policy
write race. The corrected implementation serializes writes per policy file,
uses cryptographically random temporary names, and passes a false-then-true
concurrency test; the follow-up review returned zero findings across all 17
changed files.
The harness explicitly pins hidden in-session chrome for every release layout,
preventing the mobile-player baseline from inheriting desktop interaction state.

The 2026-08-11 local-diagnostics increment passed 41/41 Electron contracts on
the Amazon Linux host. The Xvfb matrix matched the existing 44/44 Linux x64
perceptual baselines and completed nine interactions. Its desktop diagnostics
interaction enabled local crash and verbose logging, selected one-day
retention, emitted a real renderer console warning, verified that its URL and
token were absent from the owner-local file, inspected the persisted startup
policy, and cleared the file through the sandboxed preload/IPC bridge. A
dedicated full-page screenshot exposed a clipped active-toggle label; the
shared toggle geometry was corrected and inspected at desktop, handheld, and
mobile widths before the matrix was repeated. Xvfb remained sufficient and no
full desktop environment or application port was required.
The final synchronized repository check passed 438/438 and the serialized
suite passed 640 of 642 with the two expected Windows/macOS package skips. A
full Electron Builder run produced a 120,348,741-byte AppImage and a
93,273,544-byte Debian package containing the diagnostics module, CommonJS
preload, and corrected Settings stylesheet. That run exposed the default
Electron icon warning; after adding the existing Spartan mark as
`desktop/build-resources/icon.svg`, a second AppImage build completed without
the warning. The SVG is Electron Builder's shared scalable source for Linux,
Windows, and macOS development artifacts; signed/installed icon inspection on
each real platform remains part of release validation.

The 2026-08-11 Developer Mode increment used the existing Xvfb environment; a
full desktop installation was not required. The synchronized AWS repository
check passed 439/439. The Electron matrix matched all 44 Linux x64 perceptual
baselines and completed ten interactions, including enabling Developer Mode,
observing its primary-window application-menu command, opening the application
renderer DevTools through the sandboxed Settings bridge, then disabling the
setting and observing both the inspector and menu command disappear. The
dedicated full-page Settings screenshot was inspected directly and showed a
readable active toggle, description, and action without clipping or horizontal
overflow. Provider views remain excluded by targeting only the primary
window's WebContents.
The serialized AWS suite passed 640 of 642 with only the expected Windows and
macOS package-contract skips. Electron Builder produced a 120,279,029-byte
AppImage and a 93,203,464-byte Debian package. Inspection of the packaged ASAR
confirmed that the Developer Mode policy module, CommonJS preload bridge, and
Settings implementation are present.
A complete staged CodeRabbit review explicitly included all 19 increment files,
including both new Developer Mode policy files, and returned zero findings.

The 2026-08-11 packaged-update increment reused Xvfb; installing a full desktop
environment was unnecessary. The synchronized repository check passed 441/441,
and the Electron contract suite passed 51/51. Actionlint 1.7.7 accepted the new
manual desktop release workflow. The real Electron matrix matched all 44 Linux
x64 baselines and completed eleven interactions, including selecting Beta,
checking safely from a development build, reloading the persisted channel, and
confirming that unsupported component-updater toggles are absent. The dedicated
Updates screenshot was inspected at full resolution with no clipping, overlap,
or horizontal overflow. The retained initial status exposed a real mobile
overflow: its no-wrap text widened the main pane beyond the scrollbar-reduced
viewport. Mobile status text now wraps, the category rail owns its horizontal
scroll, and retained updater status is shown only in the Updates category. The
original reviewed fingerprints then matched all 44 routes with zero overflow. The
serialized AWS suite passed 641 of 643 with only the expected Windows/macOS
package-contract skips.

Electron Builder produced a final 120,771,271-byte stable AppImage and a
93,561,932-byte Debian package with `latest-linux.yml`; a second explicit beta
build produced `beta-linux.yml`. The packaged ASAR contains
`electron-updater` and the Spartan update controller, while `app-update.yml`
targets the project GitHub repository. A final ten-second Xvfb launch kept the
unpacked packaged app alive while updater internals remained muted; the
renderer receives only bounded status. Headless GPU initialization messages
and forced-timeout shutdown output are environment noise, not physical display
evidence.

CodeRabbit's complete staged review covered all 24 initial increment files and
found two valid issues: a retained updater status needed a sender-validated read
path, and release actions needed immutable commit pins. After those fixes, the
next full review found that a delayed save timer could overwrite active updater
status; the third found that the mobile CSS regression regex could cross media
boundaries. Status ownership and balanced-brace CSS block extraction now cover
both cases. The final clean re-review was attempted, but the free CLI returned a
29-minute rate limit before analysis; no clean final CodeRabbit result is
claimed.
