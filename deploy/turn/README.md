# TURN relay service

This directory contains an operator-run coturn service template. It does not
provision a public relay or contain credentials.

Generate `/etc/spartan-gaming/turnserver.conf` from the signaling TURN shared
secret before starting the service:

```bash
install -d -m 0750 /etc/spartan-gaming
npm run deployment:turn-config -- \
  --secret-file /run/secrets/spartan-turn-shared-secret \
  --output /etc/spartan-gaming/turnserver.conf \
  --realm turn.example.com \
  --external-ip 203.0.113.10 \
  --tls-cert /etc/spartan-gaming/turn.crt \
  --tls-key /etc/spartan-gaming/turn.key
```

Install `deploy/turn/coturn.service` as
`/etc/systemd/system/spartan-turn.service`, review the network firewall for
the configured listener and relay-port range, then run:

```bash
systemctl daemon-reload
systemctl enable --now spartan-turn.service
```

The service is intentionally disabled by default in source control. Operators
must provide coturn, certificates, the shared-secret file, and firewall/NAT
configuration for their deployment.
