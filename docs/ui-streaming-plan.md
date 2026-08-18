# Spartan Gaming streaming-style UI plan

## Purpose

Spartan Gaming should feel like a human-friendly streaming service for games:
the user sees what is ready, what can be resumed, what needs attention, and
what action to take next. The interface must assist the user through setup and
recovery instead of describing procedures and leaving the user to perform them
alone.

This document is the product and implementation source of truth for the next
UI phase. It complements the technical architecture and platform contracts;
it does not loosen security, provider ownership, licensing, or physical-device
acceptance gates.

## Research conclusions

The most reusable patterns across current video and game streaming services
are:

- Netflix separates unfinished viewing from saved-list content and supports
  profile-specific lists, filters, and resume behavior. See
  <https://help.netflix.com/en/node/10523>.
- Disney+ separates Continue Watching, Watchlist, and Watch Again, keeps lists
  per profile, and exposes the same concepts through web, mobile, and TV
  navigation. See
  <https://help.disneyplus.com/en-GB/article/disneyplus-en-lc-managing-watchlist>
  and <https://help.disneyplus.com/article/disneyplus-en-li-profiles>.
- Prime Video keeps recommendations, progress, and watchlists isolated by
  profile. See
  <https://www.primevideo.com/help/?language=en_US&nodeId=GD8VJD2EDJ2GSNEC>.
- GeForce NOW makes linked store libraries and the distinction between owned
  and playable content central to discovery. See
  <https://www.nvidia.com/en-gb/geforce-now/how-to-play/>.
- Xbox Cloud Gaming emphasizes resume continuity across supported devices and
  increasingly exposes input capabilities before play. See
  <https://news.xbox.com/en-us/2026/02/25/february-xbox-update-1440p-streaming-on-xbox-consoles-rog-xbox-ally-updates-and-more/>.
- Steam Big Picture treats the whole shell as controller-navigable, not just
  the game viewport. See
  <https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_players>
  and <https://store.steampowered.com/news/posts/?enddate=1671645631&feed=steam_blog>.
- Netflix and Disney+ treat keyboard navigation, screen readers, captions,
  audio description, responsive layout, and configurable playback controls as
  product features. See
  <https://help.netflix.com/en/node/116022/> and
  <https://help.disneyplus.com/es-US/article/disneyplus-accessibility>.

These are interaction patterns, not branding or visual assets to copy.

## Product hierarchy

The first viewport should answer these questions in order:

1. What can I resume now?
2. Which providers and games are ready?
3. What needs sign-in, a controller, a runtime, or another setup action?
4. What is new, saved, local, remote, or available through emulation?

The dashboard rail order is:

1. Continue Playing
2. Ready to Play
3. Needs Sign-In
4. Recently Added
5. Favorites
6. Local Library
7. Cloud Providers
8. Remote Hosts
9. Emulation
10. Multiplayer and Social

Each rail is horizontally browsable with snap points, visible edge controls,
keyboard arrows, gamepad shoulder navigation, and a View all action. The page
itself must not acquire accidental horizontal overflow. Vertical scrolling is
reserved for intentionally long detail/settings content, and only when the
content cannot be represented as a horizontal rail or compact panel.

## Universal card contract

Every provider, game, emulator, host, social destination, and saved session
card must expose:

- title, type, artwork or meaningful fallback, and source;
- current readiness state;
- supported device and input hints;
- the primary action in plain language;
- a secondary action for save/favorite/collection;
- a details action where more context is needed;
- a truthful reason and recovery action for blocked states.

Preferred primary labels are `Resume`, `Launch`, `Open login`, `Connect`,
`Install runtime`, `Choose controller`, or `See why`. Avoid generic `Submit`,
`Continue`, `Check`, or icon-only actions when a human-readable label fits.

## Provider and authentication UX

Provider status checks run automatically when a profile is selected or becomes
visible. They are advisory and credential-free. They must produce one of:

- Ready/reachable — Launch
- Sign-in required — Open login
- Unavailable — See why / Try again
- Checking — live status message
- Unsupported on this device — View requirements
- Needs controller/input — Configure input

The login action opens the provider's approved official surface using the
profile-scoped Electron session or the platform-approved browser handoff.
Spartan never receives provider passwords, cookies, tokens, or arbitrary
redirects. After login, the UI automatically rechecks availability and updates
the card without requiring the user to discover another button.

## Profiles and workspaces

Profiles isolate resume history, favorites, collections, provider sessions,
controller mappings, display/performance preferences, and accessibility
preferences. Workspaces provide task-oriented defaults such as Gaming, TV,
Handheld, Guest, and Developer/Test.

The active profile/workspace indicator remains reachable from every major
surface. Switching restores the last meaningful location and focus, never
strands the user on a stale card, and does not leak credentials between
providers or profiles.

## Device-specific presentation

### Desktop

Use a compact left navigation, dense but readable cards, keyboard shortcuts,
hover details where available, and a full diagnostics surface.

### Mobile and tablet

Use touch-sized controls, bottom navigation or a compact top bar, horizontal
rails, bottom sheets for filters, one-handed actions, rotation-aware player
controls, and a touch-control preview before launch.

### Android TV, Fire TV, and Android boxes

Use a 10-foot layout: large focus targets, persistent focus rings, D-pad-first
navigation, predictable Back behavior, remote-safe dialogs, overscan-safe
padding, and no required touchscreen gestures. Menus and content shelves are
horizontal when browsing is necessary.

### SteamOS and handheld computers

Use controller-first navigation, Gamescope-safe sizing, readable text at
handheld distance, suspend/resume recovery, power-aware defaults, and an
explicit keyboard/mouse fallback.

### Desktop Electron

Keep the packaged private origin, provider security boundaries, window focus,
external-link rules, and native session lifecycle unchanged while improving
the rendered UI. HTML and modern JavaScript remain the default implementation
for the shared surface; React is not a performance or UX requirement.

## Player experience

The player uses a minimal horizontal control rail for pause/resume, reconnect,
audio output, fullscreen, picture-in-picture, controller state, diagnostics,
and end session. Less-used actions belong in a focused More panel.

The player must make failures actionable:

- connection degraded: show what changed and offer quality/reconnect;
- controller disconnected: show reconnect and alternate-input actions;
- provider session expired: offer Open login and preserve return context;
- audio failure: offer output selection and retry;
- stream ended: offer Resume, Return to library, and See diagnostics.

## Accessibility and input parity

Every interactive element needs an accessible name, visible focus, keyboard
operation, and gamepad operation where the device supports it. Required
features include reduced motion, high contrast, large text, color-vision-safe
status treatment, captions/subtitle styling, screen-reader announcements,
audio-description metadata where available, and voice/search entry points on
TV platforms.

Icons supplement labels; they never replace the only available action name.
Focus restoration is required after dialogs, provider login, filters, and
returning from the player.

## Empty, loading, and error states

Every page and rail must have a useful state for loading, empty, unavailable,
offline, authentication-required, unsupported-device, and recovery cases. Each
state must contain a next action. Never show an unexplained blank panel, a
spinner without context, or instructions with no action control.

## Implementation phases

### Phase 1: dashboard and provider clarity

Status: complete for the dashboard slice. The shared dashboard now uses the
existing catalog, launch history, readiness, favorites, and workspace state to
render the first-viewport shelves on `main`.
The default library view now groups existing catalog entries into Continue
Playing, Ready to Play, and Needs Attention horizontal shelves. Shelf arrows
are real buttons with accessible names and smooth keyboard-friendly scrolling;
search and filter views remain a precise result grid. The rendered audit treats
rail overflow as intentional content overflow while continuing to fail on
page-level overflow and missing shelf controls.

- Add the rail model and horizontal shelf component pattern.
- Add Continue Playing, Ready to Play, and Needs Sign-In sections.
- Convert provider cards to stateful action cards.
- Add profile/workspace-aware card state and focus restoration.
- Add empty/loading/error/recovery states.

### Phase 2: unified discovery

Status: complete. The dashboard exposes Favorites, Local Library, Cloud
Providers, Watch & Stream, Browser Games, and Emulation rails with accessible
View all actions that switch to focused result views. Global search now offers
catalog-backed suggestions, while provider, platform, input-capability, and
readiness selectors compose with the existing type filters.

- Add global search and suggestions. (complete)
- Add provider/platform/input/readiness filters. (complete)
- Add collections, favorites, and a unified game details view. (complete)
- Add View all routes for every rail. (complete)

### Phase 3: television, Fire TV, and SteamOS polish

Status: verified in the shared surface. Existing device-mode, safe-area,
remote-navigation, focus-ring, and SteamOS presentation contracts are now
covered by the expanded rendered matrix; shelves expose pointer-free arrow
controls and the controller navigator remains the platform input boundary.

- Add explicit D-pad focus management and focus-visible treatment.
- Add TV safe-area and remote interaction tests.
- Add SteamOS handheld presentation and suspend/resume checks.
- Add horizontal shelf controls usable without a pointer.

### Phase 4: player recovery and accessibility

Status: implemented for the current player surface. Connection errors and
ended sessions now expose direct Reconnect, See diagnostics, and Return to
library actions. Existing audio, quality, fullscreen, PiP, controller,
diagnostics, volume, caption, focus, and reduced-motion settings remain in
the shared player contract.

- Rework the player control hierarchy.
- Add actionable reconnect, controller, audio, and expired-session states.
- Add accessibility settings and runtime announcements.
- Add device-specific player controls and touch preview.

### Phase 5: validation and release

Status: software validation complete; operator-controlled release gates remain
fail-closed. The complete rendered matrix, interaction checks, Android shell,
Electron suite, repository checks, and formatting gates pass on the KVM.
The dashboard human-flow audit now also covers empty-state recovery, filter
reset, favorites, provider details, focus, accessible names, overflow, and
runtime errors across the four release viewports, and runs in its own CI
workflow.

- Exercise every route at desktop, landscape-phone, mobile, television, and
  representative Electron layouts.
- Test keyboard, mouse, touch, D-pad, gamepad, focus, dialogs, auth, offline,
  error recovery, and return-context flows.
- Run the same UI suite in Android and desktop release workflows.
- Keep signing, physical-device, store, notarization, and unsupported-platform
  gates fail-closed.

## Viewport policy

All maintained frontend routes fit the device viewport without accidental overflow. Long browsing surfaces use horizontal rails with snap, focus, arrow, and gamepad navigation. Intentional long settings, diagnostics, and detail content may scroll vertically when required, while primary actions remain in the first viewport. On narrow screens, provider browsing and editing are separate snap pages in one horizontal workspace so selection always has a visible result. Dashboard filters and shelves use compact horizontal rails. Dialogs and detail views stay contained within the viewport. Android checks GitHub on every foreground resume; semantic beta identifiers are compared numerically so beta.13 detects beta.14 and later releases.

## Console-style interaction model

Every maintained interface uses the Spartan console interaction model: a
persistent hub-style navigation rail, controller and keyboard directional focus,
obvious selected and focused states, horizontally browsable content shelves, and
a visible primary action in the first viewport. Existing Spartan colors,
typography, logos, and branding remain the visual source of truth; this model
changes hierarchy, focus, motion, and interaction behavior only.

## Acceptance criteria

- The first viewport has an obvious next action on every maintained route.
- No accidental page-level horizontal overflow exists.
- Intentional content browsing uses horizontal rails with keyboard/gamepad
  support.
- No visible control lacks an accessible name or focus state.
- Provider cards automatically report status and offer the correct recovery
  action.
- Login never asks Spartan to handle provider credentials.
- Desktop, Android, TV, Fire TV, SteamOS, tablet, phone, and browser layouts
  have explicit presentation behavior.
- Fresh rendered tests pass with no page errors, console errors, failed assets,
  clipped controls, or dead-end states.

## Working style

Autonomous work follows a quiet completion workflow: do not send progress
updates or partial results during implementation. Read `AGENTS.md`, inspect the
KVM `main` checkout, implement all affected device surfaces, expand tests, run
the complete KVM and GitHub gates, sign and publish verified artifacts, and
then provide one consolidated report. Never call a partial release complete.
When a platform signing or physical-device gate is unavailable, exhaust safe
checks and report the exact external blocker only in the final report. Release
corrections replace the existing beta tag; they do not create a new tag.

Use the existing HTML/CSS/JavaScript architecture and small, composable
modules. Prefer progressive enhancement and shared data contracts over a
framework migration. Keep styles responsive, semantic, keyboard-safe, and
device-profile aware. Add an interaction test with every user-facing change.
Run the rendered UI suite before claiming completion, inspect screenshots, and
only then commit a signed change to `main`.
