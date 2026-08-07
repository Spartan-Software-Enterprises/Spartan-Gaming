# ADR 0002: Chromium baseline and repository boundaries

## Status

Accepted

## Decision

Spartan Gaming development tracks Chromium `refs/heads/main` in an external
checkout. The repository records the integration contract and overlay changes;
it never vendors Chromium source or generated output.

Rebases are performed at least weekly and before every integration milestone.
Each rebase records the Chromium commit position in the release notes and runs
the Linux, macOS, and Windows contract matrix. Release candidates are cut from
an upstream stable `refs/branch-heads/<milestone>` commit, pinned by commit
hash in the release manifest; release branches never consume an unpinned
moving `main` revision.

The repository owns four explicit layers:

| Layer | Owns | Must not own |
| --- | --- | --- |
| `src/frontend/`, `protocol/`, catalogs | Browser UX, session contracts, provider/emulator descriptors, diagnostics | Native OS privileges, provider credentials, game/firmware content |
| `chromium/` | Build manifest, GN templates, branding/integration patch metadata | Chromium checkout, generated binaries, upstream dependency history |
| `signaling/`, `docker/`, `scripts/` | Reference signaling, deployment contracts, ticket tooling, CI/build orchestration | Media relay, long-term secrets, game execution |
| `host/` | Privileged host lifecycle, capture/encode/publish/input/audio adapter contracts | Browser UI, catalog policy, unvalidated remote commands |

`protocol/` is the only shared dependency boundary between frontend, service,
and host layers. Native implementations may be added behind the contracts, but
the browser layer cannot import privileged host modules.

## Consequences

- Upstream Chromium churn is isolated to an external source workspace and a small reviewable overlay.
- Development can move on `main`, while releases remain reproducible from stable branch-head commits.
- Host and service code can later split into separate packages without changing the protocol or frontend catalog contracts.
- CI can validate the shared layers without downloading Chromium.
