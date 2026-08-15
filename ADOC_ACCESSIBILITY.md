# Accessibility

Spartan Gaming is committed to being accessible to all gamers. This document describes the accessibility features implemented and provides guidance for maintaining and improving accessibility.

## Keyboard Navigation

### Focus Management

- **Focus-visible outlines**: `.spartan-focus-ring` class provides custom focus outlines (3px solid `#50e1d1` with 3px offset)
- **Remote controller mode**: Enhanced focus outlines (4px with 5px offset) for television/remote navigation
- **Skip links**: Primary navigation landmark with `aria-label="Primary navigation"`

### Keyboard Shortcuts

- **Escape**: Close provider view (in `main.mjs`)
- **F12/Command+Shift+I**: Toggle developer tools (gated by developer mode)
- **Tab/Shift+Tab**: Cycle through interactive elements with proper focus management

### Focus Order

- Dashboard: Navigation → Library → Favorites → Settings → Profile → Launch
- Player: Quality → Audio → Video → Overlays → Diagnostics → End session
- Settings: Categories → Panels → Controls → Runtime → Appearance

## Screen Reader Support

### ARIA Landmarks

- **Primary navigation**: `<nav aria-label="Primary navigation">`
- **Main content**: Proper heading hierarchy
- **Dashboard cards**: Descriptive `aria-label` on favorite buttons and launch buttons
- **Provider dialog**: Full ARIA labeling with `aria-labelledby`
- **Toasts/notices**: `role="status"` with `aria-live="polite"`

### ARIA Labels

All interactive elements have descriptive `aria-label` attributes:

- Buttons: Action descriptions (e.g., "Toggle fullscreen", "Mute session audio")
- Selects: Target descriptions (e.g., "Target platform", "Stream quality")
- Inputs: Purpose descriptions (e.g., "Game volume", "Session audio output")
- Links: Context descriptions (e.g., "Spartan Gaming home", "Search library")

### Live Regions

- **Toasts and notices**: `role="status"` with `aria-live="polite"` for non-interruptive updates
- **Diagnostics**: `role="status"` with `aria-live="polite"` in player session diagnostics
- **Error messages**: `role="alert"` with `aria-live="assertive"` for critical errors (implementation pending)

## Color Contrast

- **Primary accent**: `#50e1d1` on `#10151b` (Spartan blue on dark background)
- **Focus outlines**: `#50e1d1` with sufficient contrast for keyboard navigation
- **CSS variables**: Base colors defined as CSS variables for theming and contrast adjustment
- **Respects**: User system preferences for high contrast mode (implementation pending)

## Controller & Gamepad Accessibility

### Gamepad Configuration

- **Deadzone filtering**: Configurable deadzone application for analog sticks
- **Controller profiles**: Save and restore controller configurations per game/service
- **Gyro/touchpad support**: Optional motion and touch input configurations
- **Player slot limits**: 1-8 player slot configuration with visible indication

### Input Remapping

- **Live gamepad inspector**: Real-time viewing of gamepad state
- **Deadzone visualization**: Visual representation of deadzone application
- **Polling cadence**: Configurable input polling rate (default: 240 Hz)

## Television/Remote Navigation

### D-Pad Focus Navigation

- **Remote controller mode**: Special focus styling for television remote controls
- **Safe area padding**: Television mode adds 5% safe area padding to prevent content cutoff
- **Cursor hiding**: Optional cursor hiding for pure remote navigation (`data-spartan-tv-pointer="hidden"`)
- **Grid layout**: 4-column grid for television view optimizes remote navigation

### Focus Ring

- `html[data-spartan-navigation="remote-controller"] :focus-visible { outline-width: 4px; outline-offset: 5px }`
- Default: `html[data-spartan-focus-ring] :focus-visible { outline: 3px solid var(--spartan-accent,#50e1d1); outline-offset: 3px }`

## Mobile/Handheld Accessibility

### Safe Area Insets

- Mobile and handheld modes respect `env(safe-area-inset-left)` and `env(safe-area-inset-right)`
- Bottom insets: `calc(45px + env(safe-area-inset-bottom))` for control placement

### Touch Target Size

- Minimum touch target size: 48px × 48px (per accessibility guidelines)
- Sticky keys: Optional persistent modifier key state for one-handed use
- Text entry: Scrollable category rails inside viewport for keyboard text input

## Accessibility Test Coverage

The following accessibility patterns are tested:

- [x] ARIA labels on primary interactive elements
- [x] ARIA live regions for dynamic updates
- [x] Focus-visible state styling
- [x] Keyboard navigation order
- [ ] Screen reader full traversal testing (requires VoiceOver/NVDA testing)
- [ ] Color contrast automated testing (requires Axe/Lighthouse CI)
- [ ] Skip link implementation (planned for next release)
- [ ] High contrast mode support (planned for next release)

## Known Accessibility Gaps (Priority Order)

1. **Skip navigation link**: Add `<a href="#main-content" aria-label="Skip to main content">Skip</a>` at top of pages
2. **High contrast mode**: Respect `prefers-contrast` media query for color adjustments
3. **Screen reader testing**: VoiceOver (macOS/iOS), NVDA (Windows), TalkBack (Android) validation
4. **Language support**: `lang` attribute propagation across all HTML documents
5. **Focus management**: Better focus trapping in modal dialogs and provider views
6. **Alternative text**: Descriptive alt text for all informational icons and graphics

## Development Guidelines

When adding new UI components:

1. **Always include `aria-label`** or `aria-labelledby` for interactive elements
2. **Use `role="status"`** with `aria-live="polite"` for non-critical updates
3. **Apply `focus-visible` styles** for keyboard navigation
4. **Maintain logical focus order** matching visual flow
5. **Test with reduced motion** preferences where applicable
6. **Preserve `lang` attribute** when navigating between sections
7. **Test focus outline visibility** against the color palette

## Roadmap

- [x] ARIA labels on all primary interactive elements
- [x] Focus-visible CSS rules for keyboard navigation
- [x] ARIA live regions for toasts and diagnostics
- [ ] Skip navigation link implementation
- [ ] High contrast mode support via `prefers-contrast`
- [ ] Screen reader comprehensive testing
- [ ] Language attribute propagation
- [ ] Focus management in modals and dialogs
