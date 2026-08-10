# Spartan Gaming agent handoff

Updated: 2026-08-10

This is the durable continuation point for Codex, OpenCode, and other CLI
agents. Read it before changing the repository, then verify Git state because
the branch may have advanced since this note was written.

## Product direction

- Electron GUI is the primary desktop interface; shared frontend code remains
  the portable product layer.
- Scope is Windows, macOS, Linux, ChromeOS, Android, Amazon Fire TV / Fire
  Stick, and Roku where a practical web/runtime surface exists. Apple mobile
  work is out of scope.
- GameNative is an external Android companion integration boundary, not copied
  into this repository.
- DRM bypass, unauthorized game distribution, credential extraction, and
  circumvention features are not supported.
- Never call a platform, device, driver, production deployment, or package
  signing path complete without its required evidence.

## Repository workflow

    cd /data/data/com.termux/files/home/Spartan-Gaming
    git status -sb
    git pull --ff-only origin main
    npm ci --ignore-scripts --no-audit --no-fund
    npm run check
    npm test

Use the remote development host for expensive or platform-sensitive checks.
Keep temporary Playwright reports and screenshots outside the repository.
Inspect `AGENTS.md` or `CLAUDE.md` if either is added in a future checkout.

## Remote development server

| Field | Value |
| --- | --- |
| Type | `t3.small` |
| OS | Amazon Linux 2023 |
| Region | `us-east-1` |
| Address | Resolve from protected infrastructure configuration |
| Disk | 30 GiB encrypted gp3 |
| SSH access | Restricted operator access |
| Checkout | `~/Spartan-Gaming` |
| Frontend | `127.0.0.1:4173`, not publicly exposed |
| Evidence | `~/.config/spartan-dev/evidence` |

    # Resolve the current host address from the private AWS inventory/runbook.
    ssh -i ~/.ssh/spartan-dev ec2-user@<current-dev-host>
    cd ~/Spartan-Gaming

Connection details and the operator-managed private-key path are maintained in
the protected AWS runbook/configuration, not this tracked handoff. Credentials
are not stored here: this includes private SSH keys, passwords, Redis/TURN
secrets, TLS private keys, provider credentials, and AWS access keys. Use the
host's existing secret paths/environment configuration; do not print or commit
their values.

### Noninteractive authorized connection

Agents on the authorized development device may connect without asking the
operator for input. The key is already provisioned at the protected local path;
resolve the current ephemeral address from the AWS instance inventory, then
use batch SSH so the command fails clearly instead of prompting:

    instance_id='i-0d3d5c3c1724d02f4'
    region='us-east-1'
    ssh_key='/data/data/com.termux/files/home/.ssh/spartan-dev'
    public_ip="$(aws ec2 describe-instances --region "$region" --instance-ids "$instance_id" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
    ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$ssh_key" "ec2-user@$public_ip" 'cd ~/Spartan-Gaming'

If AWS lookup is unavailable, use the current address from the protected
runbook/configuration. Never replace this with a password prompt or commit the
private key itself.

Remote tooling includes Git, Rust/Cargo, GCC, CMake, Node.js/npm, Python,
Docker, Playwright 1.55.0, Chromium headless, and the Linux packages required
by Chromium. Existing development services are Redis, signaling, and TURN.
Do not create, resize, or replace AWS resources without an explicit cost
review; stay within the AWS credit limit.

## Verified baseline

- `npm run check`: passed.
- `npm test`: 614 tests, 610 passed, 0 failed, 4 skipped.
- Frontend resolver tests: 2 passed, 0 failed.
- Remote Playwright: 14 route/viewport checks, all HTTP 200, meaningful pages,
  no framework overlay; dashboard search, provider navigation, Android settings,
  diagnostics, and mobile overflow checks completed successfully.
- Linux native evidence on the dev server: ready with capture, audio, input,
  and haptics verified in the latest report.
- Roadmap acceptance remains incomplete for real Windows/macOS hardware,
  Windows/macOS virtual gamepad drivers, external package signing, and
  production activation.
- CodeRabbit review was not completed because the local `coderabbit` binary is
  unusable on the ARM64 Termux host. Install and authenticate the official CLI
  before claiming a CodeRabbit review.

## Current change

The frontend server now serves `.mjs` with the JavaScript MIME type, resolves
frontend modules such as `/catalog.mjs` and `/session/*.mjs`, safely falls back
to repository modules such as `/host/launch-request.mjs`, and preserves JSON
catalog mounts under `/providers`, `/emulators`, and `/games`. Regression
coverage is in `scripts/frontend/serve.test.mjs`.

Before pushing, run `git diff --check`, `npm run check`, `npm test`, and the
remote Playwright matrix again. Commit the resolver and test changes together,
push `main`, then run `git pull --ff-only origin main` on the dev server and
record the new commit here.

## Handoff discipline

At the end of every agent session:

1. leave the worktree clean or document every intentional uncommitted file;
2. record exact commands and pass/fail/skip counts;
3. update this file with blockers and the next safe action;
4. never include secret values; record only secret paths and variable names;
5. commit and push only after focused and full checks support the change.

References: [README.md](README.md), [ROADMAP.md](ROADMAP.md),
[docs/aws-dev-validation.md](docs/aws-dev-validation.md),
[docs/future-local-validation.md](docs/future-local-validation.md),
[docs/development.md](docs/development.md), and [docs/platforms.md](docs/platforms.md).
