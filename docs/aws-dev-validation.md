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
Docker, and the Amazon Linux GUI/media dependencies needed by headless
Chromium. Playwright 1.55.0 is installed temporarily for the protected smoke
run, outside the project checkout. The development services are Redis,
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
