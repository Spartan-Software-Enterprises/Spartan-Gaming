# ADR 0001: Project scope and platform strategy

## Status

Accepted

## Decision

Spartan Gaming will be a universal, open-source Chromium-based gaming browser with an optional self-hosted streaming stack. Shared product behavior will be implemented once where possible, with platform adapters for OS-specific browser, input, media, windowing, packaging, and security behavior.

## Rationale

Cloud gaming users span desktops, laptops, handhelds, televisions, tablets, and mobile devices. A narrow desktop-only design would create avoidable compatibility and UX debt. At the same time, every target has different distribution and browser-engine constraints, so platform support will be staged rather than promised as identical on every device.

## Consequences

- Cross-platform abstractions and CI are foundational work.
- iOS/iPadOS support requires a separate feasibility track.
- Release quality matters more than claiming simultaneous feature parity.
- Chromium rebases and third-party licensing need explicit ownership.

