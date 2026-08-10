# Cloud gaming and streaming provider support

Spartan Gaming will treat provider support as a compatibility and integration program, not as a collection of brittle service hacks.

## Support levels

| Level | Meaning |
| --- | --- |
| A — optimized web | Official web experience works with a provider profile, fullscreen, controller routing, permissions, and diagnostics. |
| B — deep browser integration | Adds launch tiles, session detection, quality presets, provider-specific controller/layout fixes, and stream troubleshooting. |
| C — official account/API integration | Uses a documented provider API or approved OAuth flow for library, account, broadcast, chat, or session metadata. |
| D — native/self-hosted protocol | Supports an openly documented or user-owned stream endpoint such as Steam Remote Play, Sunshine/Moonlight, WebRTC, or a compatible host agent. |

We must never bypass DRM, bot detection, authentication controls, anti-cheat, regional restrictions, subscription checks, or undocumented private APIs.

## Priority cloud-gaming providers

| Provider | Category | Target support | Spartan Gaming work |
| --- | --- | --- | --- |
| NVIDIA GeForce NOW | Bring-your-own-library cloud gaming | A/B | Provider profile, launch/search, controller mapping, stream diagnostics, hardware decode matrix |
| Xbox Cloud Gaming / Game Pass | Subscription cloud gaming | A/B/C | Controller-first UX, Game Pass deep links, Xbox layout, touch controls, session recovery |
| Amazon Luna | Subscription/channel cloud gaming | A/B | Provider profile, controller presets, fullscreen, service health, compatibility checks |
| Boosteroid | Bring-your-own-library cloud gaming | A/B | Provider profile, launch links, controller and browser compatibility testing |
| PlayStation Plus Cloud Streaming | Console-library cloud streaming | A | Browser compatibility profile, DualSense support, account-safe launch flow, diagnostics |
| Shadow PC | Full cloud PC / remote desktop | A/B | Cloud-PC profile, keyboard/mouse fidelity, multi-monitor, clipboard and permission controls |
| Blacknut | Subscription cloud gaming | A/B | Provider profile, family/controller UX, catalog links, fullscreen and playback diagnostics |
| Antstream Arcade | Retro game streaming | A/B | Controller profiles, keyboard navigation, save/session links, catalog integration |

## Remote-play and self-hosted providers

| Provider or protocol | Target support | Integration direction |
| --- | --- | --- |
| Steam Remote Play / Steam Link | D | First-class launcher and controller flow for user-owned hosts and official Steam endpoints |
| Sunshine + Moonlight-compatible hosts | D | Compatible open streaming endpoints where protocol and licensing permit |
| Parsec | A/B | Optimized browser launch and controller/permission profile using official capabilities only |
| Xbox Remote Play | A/B | Official entry points, controller routing, and account-safe deep links |
| PlayStation Remote Play | A/B | Official entry points and platform compatibility guidance |
| Self-hosted Spartan Host | D | Native host agent, WebRTC signaling, pairing, input forwarding, and telemetry |

## Live streaming and broadcast providers

| Provider | Target support | Planned features |
| --- | --- | --- |
| Twitch | A/B/C | Optimized watch mode, pop-out chat, clips, rewind, creator links, official embeds/APIs where permitted |
| YouTube Live | A/B/C | Watch mode, live chat, clips, broadcast scheduling and management through the official API |
| Kick | A/B | Optimized watch mode, chat, creator links, compatibility monitoring as APIs evolve |
| Discord | A/B/C | Embedded streams, voice/chat companion, party links, official Rich Presence/deep links |
| Steam Broadcasting | A/B | Steam community watch links, chat, and supported friend/session surfaces |
| Owncast | B/C/D | Self-hosted playback, instance discovery, chat/API integration, browser-native support |
| OBS Studio | D | Local capture/recording interoperability, stream-key safety, virtual camera/audio guidance |
| Restream and multistream services | A/B | Browser launch and dashboard links; direct publishing remains provider-policy dependent |

## Universal provider UX

Every provider profile should expose supported platforms and regions, sign-in and subscription requirements, controller types, recommended quality, codec and hardware-acceleration expectations, fullscreen/input behavior, known limitations, official launch/support URLs, and a report-compatibility action.

The Provider Profiles surface also accepts a versioned community catalog. Community entries are metadata-only, HTTPS-only, marked as untrusted, limited to support level C/D, stored locally, and prevented from overriding built-in provider IDs. Importing a catalog never loads scripts, credentials, cookies, or executable adapters; hosted signing and a future Provider SDK remain separate work.

The shared resolver in `src/frontend/providers/integration.mjs` now turns catalog entries plus saved provider profiles into immutable integration descriptors. It selects the requested official/browser/host mode, recommends controller and quality profiles for major cloud, console, remote-play, cloud-PC, streaming, and self-hosted services, exposes watch/chat/creator surfaces, carries a bounded region hint and fullscreen request, and returns reachability-only health metadata. When Settings → Providers → Run provider health checks is enabled, the dashboard runs bounded credential-free HEAD probes and labels cards with advisory reachability results; health never blocks launch. For Twitch, YouTube, and KICK, an optional non-secret channel/video target produces an official embed URL only when the required target and host-domain validation pass; without a target, the planner falls back to the official site. KICK uses its documented `https://player.kick.com/<username>` player path and does not modify or obscure provider controls. Region is advisory only: Spartan Gaming never claims authentication, API approval, embed permission, or a provider’s current regional availability.

## GameNative Android companion

GameNative is listed as the `gamenative` provider for Android companion workflows. The catalog records its official package (`app.gamenative`), homepage, release page, repository, and GPLv3 license as metadata. Spartan Gaming remains Electron-primary on desktop and does not bundle GameNative source, APK payloads, credentials, or game files. On Android, users choose whether to install and launch the official companion; Spartan opens only the official HTTPS destination.

GameNative's upstream Android activity supports an explicit `LAUNCH_GAME` intent with a store and numeric app ID. Spartan does not synthesize those intents yet: a future Android bridge must be explicit, permissioned, and validated against a user's selected library item before it can launch a game. The current integration intentionally avoids guessing IDs or injecting configuration.

The dashboard applies the provider visibility and launch defaults from Settings → Providers at catalog load. Disabling **Show provider catalog** removes provider entries from the unified library while preserving emulators; enabling **Prefer official native apps** upgrades profiles that still use the default browser launch mode to the provider’s official launch mode when the catalog exposes one. Explicit per-provider launch choices remain authoritative.

Each provider card now has a capability-aware **Details** surface before launch. It summarizes the selected mode, readiness reason, quality and region hints, controller profile, provider surfaces, capabilities, setup requirements, troubleshooting notes, blocking evidence, and the official destination. The details model is metadata-only and intentionally excludes credentials, tokens, cookies, and session endpoints.

The provider manager’s **Check availability** action uses
`src/frontend/providers/health.mjs` for a credential-free `HEAD` request. It
strips query strings, omits cookies, requires HTTPS for remote targets, bounds
the timeout, and reports CORS-indeterminate results separately from HTTP
failures. A reachable response proves only that the official URL responded;
it does not prove login, subscription, regional eligibility, API approval, or
stream playback.

Provider accounts must remain isolated by profile. Provider tokens must never be stored in the game catalog or URL-history export.

Settings → Providers → **Clear sessions** removes Spartan-owned transient launch, recovery, and pairing handoffs from the current browser session. It never attempts to manipulate cross-origin provider cookies or credentials; the UI directs users to sign out through each provider’s official service when required.

## Implementation order

1. Optimized web support for GeForce NOW, Xbox Cloud Gaming, Amazon Luna, Boosteroid, Shadow, Twitch, YouTube Live, Discord, and Steam.
2. Provider profiles with capability detection, controller presets, quality recommendations, and diagnostics.
3. Official API/OAuth integrations where approval, scopes, and terms permit them.
4. Steam Remote Play, Spartan Host, and compatible open streaming endpoints.
5. Additional regional and retro providers through the same manifest format.
