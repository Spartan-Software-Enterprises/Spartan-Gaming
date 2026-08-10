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

## Evidence boundary

This host can provide Linux package-build and uinput-input evidence. It does
not satisfy the roadmap's real-hardware gate unless capture, audio, haptics,
and the required device capabilities are exercised successfully. It cannot
provide Windows or macOS virtual-device-driver evidence. Production rollout
also requires operator-managed secret files, TLS, Redis, TURN, and external
package-signing custody; none should be fabricated on this validation host.
