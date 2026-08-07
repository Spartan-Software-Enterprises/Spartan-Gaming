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

The default Compose mapping binds `127.0.0.1:8790` on the host. The service
health endpoint is:

```text
http://127.0.0.1:8790/health
```

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

Production deployments also need a clustered session registry, durable
operational monitoring, and separately provisioned STUN/TURN credentials.
The in-memory broker is a reference boundary and is not a media relay.

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
