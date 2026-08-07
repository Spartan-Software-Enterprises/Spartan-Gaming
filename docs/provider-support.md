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

The shared resolver in `src/frontend/providers/integration.mjs` now turns catalog entries plus saved provider profiles into immutable integration descriptors. It selects the requested official/browser/host mode, recommends controller and quality profiles for major console/cloud-PC services, exposes watch/chat/creator surfaces, and returns reachability-only health metadata. It never claims authentication, API approval, embed permission, or a provider’s current regional availability.

Provider accounts must remain isolated by profile. Provider tokens must never be stored in the game catalog or URL-history export.

## Implementation order

1. Optimized web support for GeForce NOW, Xbox Cloud Gaming, Amazon Luna, Boosteroid, Shadow, Twitch, YouTube Live, Discord, and Steam.
2. Provider profiles with capability detection, controller presets, quality recommendations, and diagnostics.
3. Official API/OAuth integrations where approval, scopes, and terms permit them.
4. Steam Remote Play, Spartan Host, and compatible open streaming endpoints.
5. Additional regional and retro providers through the same manifest format.
