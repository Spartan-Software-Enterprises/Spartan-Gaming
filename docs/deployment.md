# Self-hosted deployment

Spartan Gaming includes a dependency-free reference signaling service for
user-owned hosts. It routes authenticated protocol-v1 control messages only;
it does not carry game media, terminate TLS, provide STUN/TURN, launch games,
or store credentials.

## Docker Compose

Generate a long random secret, then start the service:

```bash
export SPARTAN_SIGNALING_SECRET="$(openssl rand -base64 32)"
docker compose up --build signaling
```

For the production-shaped template, provide secret files, TLS files, exact
HTTPS origins, the TURN endpoints, and run:

```bash
export SPARTAN_SIGNALING_SECRET_FILE=/run/secrets/spartan-signaling-secret
export SPARTAN_SIGNALING_ADMIN_SECRET_FILE=/run/secrets/spartan-signaling-admin
export SPARTAN_SIGNALING_TURN_SECRET_FILE=/run/secrets/spartan-turn-shared-secret
export SPARTAN_SIGNALING_TLS_KEY_FILE=/run/secrets/signaling.key
export SPARTAN_SIGNALING_TLS_CERT_FILE=/run/secrets/signaling.crt
export SPARTAN_SIGNALING_ALLOWED_ORIGINS=https://play.example.com
export SPARTAN_SIGNALING_SESSION_STORE=redis
export SPARTAN_SIGNALING_TURN_URLS=turns:turn.example.com:5349
docker compose -f docker-compose.production.yml up --build signaling
```

`docker-compose.production.yml` uses the repository's Redis-backed broker and
provisions a private Redis service for short-lived role ownership and pub/sub.
The broker never persists signaling payloads. Set
`SPARTAN_SIGNALING_REDIS_URL` when using an operator-managed Redis cluster;
use `rediss://` for a TLS Redis endpoint outside the Compose network. TURN
credentials are minted through the admin-only TURN credential route from the
mounted shared secret. Certificate issuance/rotation and the exact browser
origin remain operator-owned production inputs.

Before reloading a rotated certificate pair, validate that it is not expired
and that the private key matches the certificate:

```bash
npm run deployment:tls-check -- --key /run/secrets/signaling.key --cert /run/secrets/signaling.crt
```

The checker prints only certificate subject, issuer, and remaining days. For
an application-owned pair, `rotateTlsCertificatePair()` in
`scripts/deployment/tls-rotation.mjs` validates the replacement first, stages
the key with mode `0600` and certificate with mode `0644`, publishes both, and
restores the previous pair if publication fails. Reload the signaling process
only after the rotation operation succeeds; the utility does not restart
containers or contact an external certificate authority.

The default Compose mapping binds `127.0.0.1:8790` on the host. The service
health endpoint is:

```text
http://127.0.0.1:8790/health
```

The service rejects oversized or unmasked WebSocket frames, requires the
authenticated join frame before protocol messages, and enforces bounded
connections and message rates. For browser deployments, set an exact-origin
allowlist, for example:

```bash
export SPARTAN_SIGNALING_ALLOWED_ORIGINS="https://play.example.com"
export SPARTAN_SIGNALING_MAX_CONNECTIONS=512
export SPARTAN_SIGNALING_MAX_MESSAGES_PER_SECOND=240
```

The reference signaling process supports direct TLS when both certificate
paths are supplied:

```bash
export SPARTAN_SIGNALING_TLS_KEY=/run/secrets/signaling.key
export SPARTAN_SIGNALING_TLS_CERT=/run/secrets/signaling.crt
```

This changes the advertised endpoint from `ws://` to `wss://` and protects the
health/admin HTTP routes with the same certificate. A production deployment
should normally terminate TLS at a managed reverse proxy and rotate keys
outside the application container.

The direct host agent accepts the same deployment pattern with
`SPARTAN_HOST_TLS_KEY` and `SPARTAN_HOST_TLS_CERT`, or `--tls-key` and
`--tls-cert`. The frontend can then store the resulting `wss://.../session`
endpoint in a host profile and retain the one-time pairing code boundary.

The health response reports configured limits and rejected connection counts,
but never returns tickets, subjects, or session payloads.

For operator tooling, optionally set a separate
`SPARTAN_SIGNALING_ADMIN_SECRET`. With that secret, use `Authorization: Bearer
<secret>` over a private TLS-admin route: `GET /admin/health` returns the same
bounded operational counters, and `POST /admin/tickets` accepts
`{"sessionId":"...","role":"client|host","subject":"...","ttlMs":60000}`
and returns a short-lived scoped ticket. The admin secret must be delivered by
a secret manager and must never be placed in browser configuration, URLs, or
logs. The admin API is disabled when the secret is empty.

`POST /admin/turn-credentials` accepts `{"subject":"browser-01","ttlSeconds":600}`
and returns an ephemeral TURN REST username, HMAC credential, TTL, and the
configured TURN URLs. It requires the same admin bearer secret and a distinct
mounted TURN shared secret.

`POST /admin/host-enrollment` accepts
`{"endpoint":"wss://signal.example/signal","sessionId":"...","subject":"host-01","ttlMs":60000}`
and returns the endpoint plus one role-scoped host ticket. The endpoint must
be credential-free and remote endpoints must use `wss://`. This is the audited
operator enrollment handoff consumed by `host/enrollment.mjs`; the returned
ticket must be passed to the host only in memory or through a short-lived
supervisor environment and must never be persisted in a profile or log.

The container runs as the unprivileged `node` user, with a read-only root
filesystem, dropped Linux capabilities, a small no-exec temporary filesystem,
and `no-new-privileges`. The secret is supplied at runtime and is never baked
into the image or committed to the repository.

## Remote access

The Compose file is intentionally localhost-only. For a remote client, place
the service behind a maintained TLS reverse proxy with an explicit WebSocket
upgrade route for `/signal`, origin policy, rate limits, access logging that
redacts tokens, and a secret manager. Do not expose the plain `ws://` endpoint
to the public internet.

The production Compose profile includes a clustered-capable session registry
and pub/sub broker. It still needs durable operational monitoring and
separately provisioned STUN/TURN credentials; Redis is not a media relay.

`createSignalingServer()` accepts an injected broker implementing `attach`,
`issueTicket`, and `stats`. A production adapter can therefore provide
clustered session routing and ticket custody behind the same authenticated
WebSocket surface; the default in-memory broker remains development-only.
The built-in `signaling/redis-broker.mjs` adapter implements that contract
using Redis, short-lived role locks, and session pub/sub. Adapters may also
implement `health()`; when present, `/health` and
`/admin/health` expose only bounded `status` and `backend` fields. Missing or
failing health checks are reported as `not-reported` or `unavailable` and
never make secret-bearing adapter details visible.
The executable can load such an operator-installed adapter with
`SPARTAN_SIGNALING_BROKER_PACKAGE` or `--broker-package`; the package must
export `createBroker()` and return the validated broker contract.

Before promoting a deployment, run `npm run deployment:check` with
`SPARTAN_SIGNALING_SECRET` (or `SPARTAN_SIGNALING_SECRET_FILE`),
`SPARTAN_SIGNALING_ADMIN_SECRET` (or `SPARTAN_SIGNALING_ADMIN_SECRET_FILE`),
`SPARTAN_SIGNALING_TLS_KEY`, `SPARTAN_SIGNALING_TLS_CERT`,
`SPARTAN_SIGNALING_ALLOWED_ORIGINS`, `SPARTAN_SIGNALING_SESSION_STORE`, and
`SPARTAN_SIGNALING_BROKER_PACKAGE`, and `SPARTAN_SIGNALING_TURN_URLS` set. The
broker package must export the validated `createBroker()` contract; the
preflight requires strong distinct
secrets, HTTPS origins, a non-memory session store (`redis`, `database`, or
`external`), and `turn:`/`turns:` endpoints; it prints only a redacted
configuration summary and never emits secret values. Inline and file forms
cannot be supplied together. Mounted secret files are read by both the
preflight and signaling process at startup; their contents are never returned.
This validates operator
prerequisites but does not provision those external services.

For an explicit, shell-free deployment handoff, `npm run deployment:rollout`
prints a production rollout plan containing the Compose preflight, detached
startup command, and HTTPS health endpoint. Add `--execute --confirm` only on
an operator-controlled machine after the secret files, TLS material, Redis,
and TURN inputs have been reviewed. Execution runs `docker compose config
--quiet`, starts the selected services, and verifies the signaling health
response; it never accepts secrets as command-line arguments and never runs a
shell. Use `--without-turn` only when an independently provisioned relay is
already reachable through `SPARTAN_SIGNALING_TURN_URLS`.

For an operator-managed coturn relay, generate a bounded configuration from
the same shared secret used by the signaling TURN credential endpoint:

```bash
npm run deployment:turn-config -- \
  --secret-file /run/secrets/spartan-turn-shared-secret \
  --output /run/secrets/turnserver.conf \
  --realm turn.example.com \
  --external-ip 203.0.113.10 \
  --tls-cert /run/secrets/turn.crt \
  --tls-key /run/secrets/turn.key
```

The generator validates the relay and TLS settings, writes the result with
mode `0600`, and never prints the shared secret. Run coturn using the generated
file and expose only the required UDP/TCP listener and relay-port range. The
relay remains operator-owned; the repository does not silently provision a
public TURN service. For Linux systemd deployments,
`deploy/turn/coturn.service` provides a hardened, credential-free service
template for the generated configuration. `deploy/turn/README.md` documents
installation and firewall review. The unit is not enabled by the repository
and still requires an operator to install coturn, provide certificates and the
shared-secret file, and verify NAT/relay-port routing.

The production Compose file also contains an explicit `turn` profile for a
Linux coturn container. Start it only with `docker compose --profile turn up`
after supplying `SPARTAN_TURN_IMAGE`, the generated config, and certificate
secret files. The profile uses host networking because coturn allocates a
bounded UDP relay range; operators must still review the generated port range,
firewall, NAT, and image provenance. The profile is disabled by default and
does not replace external certificate or secret management.

Native package rollout artifacts are built by
`.github/workflows/native-package-rollout.yml` on a manual dispatch or a
version tag. Each target runner uploads an isolated package artifact and marks
it as unsigned; it includes a deterministic `package-manifest.unsigned.json`
with per-file SHA-256 digests. An operator must pass the artifact through the external
package-signing service and install it through the verified adapter installer;
the rollout workflow never treats a CI artifact as trusted code.

On a desktop host, `npm run native:verify-desktop` performs an observation-only
capability check against the selected native package. It does not inject input,
start capture, or start audio. Use `--platform windows|macos|linux` and
`--install-root <path>` when the package is outside its default location. The
report distinguishes package readiness, input/audio/haptics capability
readiness, Linux `/dev/uinput` access, and the separate Windows/macOS
virtual-driver requirement. Operators may add `--require-hardware`,
`--require-input`, `--require-audio`, `--require-haptics`, or
`--require-virtual-gamepad` to turn those reported requirements into distinct
non-zero exit statuses for deployment validation. The verifier only inspects
bindings and permissions; it does not claim that a physical controller is
attached or that a real haptic effect was felt. The final hardware gate must
run this check on each target operating system with the intended devices
connected, then record the result in the release handoff.

When `RELEASE_SIGNING_SERVICE_URL` is configured as a repository variable, or
`signing_service_url` is supplied to a manual rollout, the workflow can call
that external HTTPS service with the `SPARTAN_RELEASE_SIGNING_TOKEN` secret.
`npm run native:sign-release` validates that the service returns the exact
unsigned manifest plus a signature, writes a separate signed manifest, and
never accepts a token on the command line or prints it. Without both operator
inputs, the workflow intentionally remains unsigned. For a version tag, once
all three platform jobs produce signed manifests and the repository variable
`RELEASE_SIGNING_PUBLIC_KEY_JWK` is configured, the publish job verifies each
signature with WebCrypto, checks the canonical platform ID and absence of the
unsigned marker, creates deterministic platform tarballs plus a SHA-256
checksum file, and publishes them to the matching GitHub release. It never
creates a release from unsigned or cryptographically unverifiable artifacts.

Host deployment templates are under `deploy/host/`. The systemd and macOS
launchd templates keep the reference host bound to localhost by default, run
as an unprivileged user, and do not enable remote input or native media
implicitly. The Windows service guidance covers approved external wrappers.
All supervisors can consume the same shell-free argument vector from
`npm run host:deployment-plan`; pairing codes, signaling tickets, and secret
values remain session- or secret-manager-owned.

## Native reference service

Docker is optional. On a machine with Node.js 20 or newer:

```bash
SPARTAN_SIGNALING_SECRET="local-development-only" npm run signaling
```

Use `--bind`, `--port`, and `--secret` for local service customization. The
browser transport joins with a short-lived, role-scoped ticket; it must not
store the signing secret.

## Provisioning join tickets

Mint tickets out of band on the operator or host machine. Issue one ticket
for each role in the same session, and deliver the ticket only to that role:

```bash
export SPARTAN_SIGNALING_SECRET="$(openssl rand -base64 32)"
node scripts/issue-signaling-ticket.mjs --session ses-example-01 --role client --subject browser-01
node scripts/issue-signaling-ticket.mjs --session ses-example-01 --role host --subject host-01
```

The command prints a JSON record containing the short-lived ticket. Tickets
are scoped to one session and role, and should be passed in memory to
`createWebSocketSignalTransport({join})`; do not put them in a URL, profile
export, source file, or browser local storage. A production provisioning
service should authenticate the operator and deliver the same claims through
an audited secret-exchange channel.
