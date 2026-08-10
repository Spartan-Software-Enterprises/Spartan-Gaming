# Spartan Host deployment templates

`spartan-host.service` is a hardened Linux systemd template. Copy it to
`/etc/systemd/system/`, create an externally managed
`/etc/spartan-gaming/host.env`, install the selected verified native package,
then enable the service. Keep `SPARTAN_HOST_BIND` on localhost unless a
maintained TLS reverse proxy or direct host TLS is configured.

For Windows Services, macOS launchd, or another supervisor, use
`npm run host:deployment-plan -- --platform ...` to produce the same shell-free
argument vector. The plan contains no pairing code, signaling ticket, or secret;
those values must be delivered only for the active session.
