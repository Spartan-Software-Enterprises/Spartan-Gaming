# Spartan Host and user-owned streaming

Spartan Host is the native companion boundary for user-owned PCs, local emulator processes, and compatible remote-play services. The browser frontend never receives a long-lived host credential or embeds credentials in an endpoint URL.

## Connection contract

`src/frontend/host/host.mjs` provides the shared connection primitives:

- HTTPS/WSS is required for remote endpoints; insecure HTTP/WS is limited to localhost and `.local` development hosts.
- Endpoint URLs cannot contain usernames, passwords, or fragments.
- WebRTC is preferred when both sides advertise it, followed by WebTransport and WebSocket.
- Pairing codes use a short human-entered alphabet without ambiguous characters and carry an explicit expiry.
- Direct host WebSockets enforce an exact-origin allowlist when configured, a bounded connection count, and a per-connection message-rate limit.
- Returned profiles identify credentials as session-scoped, leaving storage and token exchange to the native host/signaling layer.

The browser is responsible for user consent, endpoint validation, capability negotiation, input routing, quality requests, and diagnostics. Browser Host applies bounded bitrate, framerate, and adaptive-resolution requests to WebRTC sender encodings when the browser exposes compatible sender controls, with graceful unsupported reporting. The host is responsible for authentication, process ownership, game/emulator launch, media capture/encode, and enforcement of local permissions.

The optional Werift host runtime forwards quality requests to its media session’s sender-control hook when the installed WebRTC adapter exposes one. The result is reported as applied, unsupported, or failed without terminating the session; platform encoders remain responsible for translating the request into their native pipeline controls.

The host manager at `src/frontend/host/index.html` stores only non-secret host profiles in local browser storage. It can generate a `host.pair` request for a one-time code supplied by a running host agent, show the selected transport, and export/import endpoint preferences. The reference host agent validates the request, enforces expiry/replay protection, and now exposes bounded origin, connection, and message-rate controls; production credentials and deployment remain operator-owned.

The repository includes `host/agent.mjs` as a dependency-free Node.js reference control plane. Run `npm run host -- --pairing-code ABCD23` to expose a local `ws://127.0.0.1:8787/session` endpoint and `/health`. It validates the pairing code once, answers protocol-v1 offers, records quality requests and input-event counts, and handles reconnect messages. In its default mode it intentionally reports `media.state: not-configured`: capture, encode, OS input injection, and TURN are separate host deployment work. For a directly TLS-terminated remote host, provide both `--tls-key /run/secrets/host.key --tls-cert /run/secrets/host.crt` (or `SPARTAN_HOST_TLS_KEY` and `SPARTAN_HOST_TLS_CERT`) to advertise `wss://` and protect `/health`; supplying only one path fails closed.

An operator with the optional `werift` package and an installed platform binding
can run the executable media path with `--enable-native-media`. This mode keeps
the same one-time pairing and launch-request checks, then bridges the accepted
session into `createNativeWeriftHostFromPlatformBindings`; use
`--enable-native-audio` only when microphone capture is explicitly permitted.
The native mode requires the platform package's capture binding and fails at
startup when Werift or the binding is unavailable, rather than silently falling
back to a non-streaming host. `--enable-input` remains an independent opt-in.

For a controlled local emulator launch, the reference agent can also own one
host-local process lifecycle. Start it with `--enable-game-launch`,
`--runtime-id`, `--runtime-kind`, `--runtime-version`, `--runtime-path`,
`--game-path`, and `--host-content-id`. The agent accepts a browser launch
descriptor only when its runtime identity, opaque content ID, and game filename
match those flags; it starts the shell-free process after pairing and stops it
when the session closes. These flags are intentionally opt-in, and the health
endpoint exposes readiness and process state without returning local paths.

For a deployed signaling service, the same agent can join as a host participant with `--signal-endpoint`, `--signal-session`, and `--signal-ticket`. The ticket is role-scoped, supplied out of band, held in memory, and never written to the health response. The direct endpoint and outbound signaling mode share the same session answer and input/quality handling path.

`host/adapter-installer.mjs` is the native updater boundary for signed frontend install requests. It validates user-scoped paths, stages artifacts under a private staging directory, verifies the declared SHA-256 digest and an injected signature verifier, publishes a versioned directory and atomically replaced `current.json` pointer, and removes its own staging/publication on failure. It never invokes a shell or extracts/executes an artifact; platform package managers and archive-specific adapters remain outside this transaction.

`host/adapter-package.mjs` adds the package-content boundary. Package manifests
must be signed, platform-scoped, normalized, and composed only of regular files
and directories. Extraction rejects traversal, absolute paths, duplicate names,
symlink-like entries, oversized packages, and digest/size mismatches. Archive
reading is injected, so the host does not shell out to `tar`, `unzip`, or an
untrusted package command; failed extraction removes only its new staging
directory.

`host/archive-readers.mjs` supplies dependency-free ZIP (stored/deflated) and
TAR readers. Encrypted ZIP entries, archive links, traversal paths, duplicate
names, unsupported compression, and oversized entries fail closed. Formats such
as `tar.zst` still require an explicitly supplied native codec adapter.

`host/package-signing.mjs` provides the release-side signing boundary. It
canonicalizes manifests with signature fields removed, signs through an
injected WebCrypto private key, and verifies through the existing public-key
contract. Keys are never loaded from disk, persisted, or embedded in package
metadata beyond the signer identifier and signature value.

`release/package-signing-service.mjs` is the deployment-neutral custody
boundary. It authorizes each request, rate-limits signing, obtains a private
key only from an injected custody provider, signs canonical package manifests,
and reports only signer/algorithm/request counters in health data. A real
deployment can connect that provider to KMS/HSM infrastructure without
changing the package contract.

`host/media.mjs` provides the next boundary for those platform implementations. It generates shell-free FFmpeg capture plans for Linux X11/PipeWire, Windows desktop capture, and macOS AVFoundation, validates basic permission context, and generates codec/bitrate encoder plans for H.264, VP9, and AV1. These plans target a future WebRTC publisher and are deliberately not executed by the reference agent.

The native package manifest and `npm run native:plan -- --matrix` provide the
cross-platform CMake workflow for the Windows, macOS, and Linux binding
packages. The command is plan-first, keeps source/build/install directories
isolated, reports source readiness, and requires `--execute` before invoking
CMake. All three packages now have checked-in input implementations; capture,
audio, gamepad, and haptics remain capability-specific rather than being
claimed by package presence alone.

`host/publisher.mjs` composes those plans into a transport-neutral publisher
contract. It reports `unconfigured` or `plan-only` until a native capture
adapter and WebRTC publisher are installed, and carries bounded codec,
resolution, framerate, audio, and transport capabilities into host health and
session answers. The reference agent therefore exposes truthful readiness
without pretending that FFmpeg output is already playable media.

`host/native-session.mjs` composes the executable media, audio, and input
lifecycles. Media starts first, audio startup failure rolls media back, input is
accepted only while the session is active, and shutdown closes input before
audio and media in reverse order. OS APIs remain injected, so the same
orchestrator can be used by Windows, macOS, and Linux adapters.

`host/platform-runtime.mjs` selects the platform-specific FFmpeg capture and
audio plans: Desktop capture/WASAPI on Windows, AVFoundation/CoreAudio on
macOS, and PipeWire or X11/Pulse fallback paths on Linux. It validates the
selected plan platform before binding it to the native session; actual OS
capture, encoding, audio, and input implementations remain injected adapters.

`host/executable-platform-host.mjs` composes those platform plans with the
native media pipeline, RTP media publisher, optional audio publisher, and
permissioned input executor. This is the end-to-end host assembly boundary:
the session lifecycle is now executable with injected platform adapters while
remaining shell-free and testable on every desktop OS. Concrete Windows,
macOS, and Linux API packages still belong outside the portable core.

When audio packetization and transport are supplied, the same factory now
builds a shell-free audio capture/encode pipeline from `plans.audio` and
`plans.audioEncoder`, creates an RTP audio publisher, and starts/stops it
transactionally with video and input. Audio still requires an explicit
microphone permission grant; without one, the optional path remains absent.

An installed package can provide a ready `createPlatformAdapterBoundary` and
pass it as `adapterBoundary`; input operations then cross the same guarded
platform/kind boundary as capability reporting. Explicit `inputAdapter` values
remain available for direct tests and specialized deployments, while missing
or non-ready implementations fail closed before remote input is delivered.

`host/adapter-runtime.mjs` is the activation boundary for extracted packages.
It validates the current pointer, package identity, platform, entrypoint, and
injected signature verification before loading a factory module. The factory
must return a platform-matched executable adapter; an unverified or malformed
package never reaches module loading.

`host/native-adapter-kit.mjs` defines the package-facing native contract for
the three desktop platforms. Windows packages advertise Graphics Capture,
WASAPI, and SendInput bindings; macOS packages advertise ScreenCaptureKit,
CoreAudio, and CGEvent/HID bindings; Linux packages advertise PipeWire/portal,
PipeWire/PulseAudio, and uinput bindings. The checked-in Windows and macOS
packages implement keyboard and pointer input through SendInput and Core
Graphics, and compose guarded FFmpeg capture/audio lifecycles. Windows
additionally exposes rumble through XInput for attached Xbox-compatible
controllers, but does not claim virtual gamepad injection. Linux exposes a
uinput virtual gamepad and force feedback when `/dev/uinput` is available.
macOS additionally exposes haptic output for attached controllers that report
GameController/CoreHaptics support; it does not claim virtual gamepad
injection. Missing controllers or unsupported haptic localities fail closed.
The kit delegates only declared operations (`start`/`stop` for capture and
audio, `execute` for input) and fails closed when a package does not provide
its required methods.

`host/native-binding-loader.mjs` discovers the optional binary packages
`@spartan-gaming/native-windows`, `@spartan-gaming/native-macos`, and
`@spartan-gaming/native-linux`. It never substitutes shell commands or a fake
implementation: missing packages, malformed exports, and missing capability
bindings are reported as unavailable. When a package is present, its bindings
are passed through the native adapter kit before host startup.

`native/package-manifest.json` and `host/native-package.mjs` provide the
reproducible package distribution contract. Each desktop target has one
scoped Node-API package, required platform APIs, an artifact name, and a
three-step shell-free CMake plan (`configure`, `build`, `install`). Readiness
stays `planned` until the package probe finds an installed binary; CMake being
available alone is not reported as native capability readiness.

Its `createBoundary()` method additionally requires a `ready` registry
descriptor and returns a guarded platform boundary. The
`createExecutablePlatformHostFromInstalledAdapter()` factory uses that method
before constructing the native session, so a verified package is selected as
an executable input adapter only when the platform registry explicitly marks
that capability ready.

`host/input.mjs` is the matching input boundary. It maps normalized browser
events to shell-free plans for Windows `SendInput`, macOS Core Graphics/HID,
and Linux `uinput` adapters. Plans declare the required permission (`remote-input`,
`virtual-gamepad`, or `haptic-output`) and remain `plan-only` until a native
adapter is installed. The reference agent records the latest plan in health
output rather than injecting OS input.

`createNativeInputExecutor` is the next executable boundary. It accepts only a
platform-matched adapter with an `execute(operation)` method, reuses the
permissioned normalized plans, applies a bounded event rate, and exposes
explicit close/failure states. OS-specific adapters remain separate packages;
the core never shells out or interprets arbitrary executable arguments.

`host/game-launcher.mjs` is the matching user-owned emulation launch boundary.
It turns a trusted native runtime profile and an explicitly selected local game
file into a shell-free process plan, then owns the emulator process lifecycle.
`createNativeHostSession` can start that launcher before media capture and stop
it after audio/video teardown, rolling the game back if media setup fails.
Paths are metadata and process arguments only; Spartan never downloads ROMs,
BIOS files, keys, or executes a browser-provided path without the native host
operator's explicit launch decision.

The same launcher can be supplied to `createNativeWeriftHost`; it is started
only after the remote offer has passed capability negotiation, before video or
audio publishers start, and is stopped during session teardown.

When a native game launcher is configured, every accepted offer must include a
consented metadata-only launch request and a validator must confirm its runtime,
opaque host content ID, and game filename. The package-backed factory requires
`hostContentId` alongside the configured runtime and game path; incomplete
launch configuration fails during construction rather than silently widening
the host's launch authority.

`createNativeWeriftHostFromPlatformBindings` is the package-backed assembly
factory. Given a verified platform binding, explicit capture/microphone grants,
and optional RTP packetizers, it creates the shell-free video and optional audio
pipelines, connects them to Werift tracks, and routes negotiated input events
through the guarded executor. If packetizers are not supplied, the factory uses
the dependency-free packetizers in `host/rtp-packetizer.mjs`: H.264 supports
Annex-B and AVCC with RFC 6184 single-NAL/FU-A framing, VP9 and AV1 use their
minimal payload descriptors, and Opus preserves one encoded frame per RTP
packet. A production encoder must still emit the selected codec's elementary
stream; the packetizer does not transcode media.

`host/launch-request.mjs` validates the corresponding metadata-only native
emulator handoff at the host boundary. A native host may accept it only when
the runtime ID, opaque host content ID, and game metadata match its own
operator-configured launch plan; the request cannot carry a path, executable,
source handle, or bytes.

`host/werift-runtime.mjs` treats offer admission as a transaction: if launch
validation, session construction, or SDP acceptance fails, the media session
is closed, the active session identity is cleared, and a later offer can retry
without reusing a partially initialized publisher or peer.

`host/audio.mjs` adds the return-audio boundary for Windows WASAPI, macOS
CoreAudio, and Linux PipeWire/PulseAudio. It validates microphone/session
permissions, creates bounded FFmpeg PCM capture plans, and composes an Opus or
AAC publisher plan. Audio remains `unconfigured` in the reference host until
a native audio capture and WebRTC audio publisher are installed.

It also exposes the bounded raw-f32le-to-Opus/AAC encoder plan used by the
executable host composition; the actual capture device and RTP implementation
remain injected platform adapters.

The same module now provides `createAudioPublisher` and
`createRtpAudioPublisher`. These accept an injected encoded audio pipeline,
require an explicit permission grant, bound chunk sizes, stop the pipeline on
sink failure, and delegate RTP framing/delivery to an injected adapter. They do
not request permissions, launch capture processes, or claim that raw PCM is
already an Opus/AAC stream.

`src/frontend/host/browser-publisher.mjs` provides a browser-host path for
user-approved display capture. It bounds capture constraints, calls
`getDisplayMedia` only when the host UI explicitly requests it, adds the
returned tracks to a WebRTC peer, accepts a remote offer, emits ICE candidates,
and stops all tracks on close. It is intended for authenticated host-role
signaling sessions and does not replace the native host agent or claim OS-level
game capture, process launch, or input injection.

`src/frontend/host/browser-host-runtime.mjs` binds that publisher to an
authenticated host-role signaling transport. It accepts a validated client
offer after capture is active, negotiates bounded protocol capabilities,
returns an SDP answer, forwards ICE candidates, and exposes input and quality
callbacks to the host UI. It still requires an application to provision a
short-lived host signaling ticket and obtain explicit display-capture consent.

The user-facing `src/frontend/host/browser-studio.html` page is the reference
application for that path. It keeps the endpoint, session ID, and role-scoped
ticket in memory, requires an explicit display selection before connecting,
shows a local preview and bounded activity log, and stops the publisher on
navigation. It intentionally does not launch processes, record media, or
inject native input.

The session player has the matching authenticated client flow. Open
`src/frontend/player/index.html`, enter the same signaling endpoint and
session ID with a short-lived `client` ticket, and select **Connect securely**.
The player joins the broker before sending its SDP offer; the ticket is never
persisted. The legacy one-time pairing flow remains available for the local
reference host, which does not use broker tickets.

For a repeatable localhost smoke test of this browser-host path, run
`npm run lan:demo`. It starts the frontend and signaling services on ephemeral
ports, issues one short-lived ticket for each role, and prints the values to
enter in Browser Host Studio and the session player. The demo proves the
browser capture/WebRTC path only; native game launch, OS input injection, and
production TLS/STUN/TURN remain separate host deployments.

## Compatibility targets

The adapter boundary can support Spartan Host first, then user-owned Steam Remote Play, Sunshine/Moonlight-compatible endpoints, Parsec, Xbox Remote Play, and PlayStation Remote Play where official protocols and platform rules permit. Compatibility is not permission to bypass authentication, DRM, anti-cheat, or undocumented service controls.
The Host Profiles page now completes the direct-host onboarding handoff: it
validates the endpoint, normalizes the one-time pairing code, stores only an
expiry-aware session-scoped handoff record, and opens the player with the host
ID and pairing code. The player consumes and clears that record before
starting the session offer; no password, signaling ticket, or persistent host
credential is stored in the handoff.

## Linux reference adapter

`native/linux/reference-adapter.mjs` is the first concrete platform adapter
behind the binding boundary. It reports available FFmpeg, X11, PipeWire, and
Pulse session capabilities; launches validated FFmpeg x11grab/PipeWire or
audio plans through shell-free process arguments after explicit permission; and
maps normalized keyboard and pointer operations to X11 `xdotool` argv calls.
Gamepad/uinput, portal consent UI, hardware encoder selection, and signed
distribution are intentionally not claimed by this reference adapter. The
compiled `@spartan-gaming/native-linux` package now adds a Node-API `uinput`
virtual gamepad for normalized buttons, axes, and rumble effects. It is built with
`npm run native:build-linux`, installed into the isolated native artifact, and
verified in Linux CI. Rumble is advertised only when `/dev/uinput` is readable
and writable; hosts without that device or permission fail closed. Portal
consent workflow and hardware encoder selection remain unimplemented.

The reference host calls `detectHostRuntime()` during startup. It loads the
optional package when installed, exposes only its serializable readiness and
input capabilities through `/health` and session negotiation, and keeps the
raw binding object private to host composition. If the package is absent or
does not report a capability, the host advertises that path as unconfigured;
remote input is never enabled merely because the host has a desktop OS.
For an operator-approved host session, `host/agent.mjs --enable-input` routes
normalized input events through the same permission and rate-limit executor;
the default agent mode remains observation-only.

## Windows and macOS input packages

`native/windows` and `native/macos` are the first concrete non-Linux native
packages. Their CMake targets compile Node-API addons on the target OS and
install a small ESM package wrapper. Windows uses `SendInput` for normalized
keyboard and relative pointer events; macOS uses `CGEventPost` and Core
Graphics for the same operations. Each package also composes the shared,
shell-free FFmpeg capture/audio lifecycle: Windows uses gdigrab/WASAPI plans
and macOS uses AVFoundation/CoreAudio plans. Capture and microphone starts
require explicit permission flags and never spawn until permission is granted.
The Windows package exposes XInput rumble for controller indexes 0 through 3,
and macOS uses GameController/CoreHaptics for attached supported controllers;
the Linux package composes its uinput virtual gamepad/force-feedback path with
the reference keyboard and pointer path so installing the gamepad binding does
not remove desktop input support. Windows and macOS still expose no virtual
gamepad injection. All packages fail
closed when the binary is missing or the OS permission is denied; their build
and installed-package contracts run on the Windows and macOS CI runners.
