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
