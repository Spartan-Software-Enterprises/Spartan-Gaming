# Spartan Host reference agent

This directory contains the portable reference control plane for user-owned streaming hosts.

```bash
npm run host -- --pairing-code ABCD23
```

The default development endpoints are:

- `http://127.0.0.1:8787/health` for a redacted health/capability document.
- `ws://127.0.0.1:8787/session` for protocol-v1 session offers.

The agent accepts one correctly paired `session.offer`, returns a protocol-valid `session.answer`, and rejects replayed or expired pairing codes. It is intentionally dependency-free and runs anywhere Node.js 20 runs. This is a control-plane reference only: it does not launch games, capture or encode media, inject OS input, provide TLS, or operate STUN/TURN. Those capabilities belong in platform-specific host adapters and the production signaling/deployment layer.

The health response also reports the selected platform adapter, detected `ffmpeg`/GStreamer tools, and conservative readiness flags. A detected encoder tool is evidence only that a future media adapter may be possible; it is not a claim that capture, WebRTC publication, or game launching is implemented.
