# Signaling broker contract

`broker.mjs` is a dependency-free reference for the server-side signaling
boundary. It does not carry game media, persist credentials, or perform NAT
traversal. A deployment can place it behind an authenticated WebSocket or
WebTransport adapter and provide STUN/TURN separately.

The broker issues short-lived, HMAC-scoped tickets for exactly one session and
role (`client` or `host`). Attached participants can send validated protocol
v1 envelopes only to the other participant. Sessions are bounded, in-memory,
and removed after detach or inactivity. Production deployments must use a
secret manager, TLS, rate limiting, origin policy, and a durable/clustered
session registry appropriate to their scale.

The reference broker intentionally does not claim to be a production relay.
It establishes the security and routing contract that the browser runtime,
host agent, and future signaling service can share.

## Local reference service

Run the dependency-free WebSocket adapter with an explicit secret:

```bash
SPARTAN_SIGNALING_SECRET=local-development-only node signaling/agent.mjs
```

It listens on `ws://127.0.0.1:8790/signal` and `http://127.0.0.1:8790/health`.
Clients use `createWebSocketSignalTransport({ join: { sessionId, role, ticket } })`
to send the authenticated join frame before protocol envelopes.

The service applies bounded connection and message-rate limits. Set
`SPARTAN_SIGNALING_ALLOWED_ORIGINS` to a comma-separated exact-origin allowlist
when browsers should be restricted to known frontend origins; configure
`SPARTAN_SIGNALING_MAX_CONNECTIONS` and
`SPARTAN_SIGNALING_MAX_MESSAGES_PER_SECOND` for deployment capacity. The
health response exposes limits and rejected-connection counts without
exposing tickets or session contents.
