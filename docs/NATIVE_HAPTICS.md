# Native Haptics Runbook

## Status

- Native mobile haptics are now implemented through a Capacitor shell.
- Browser sessions still use the web-safe direct-interaction policy.
- Async and game-loop haptics are restored only when the app is running inside the Capacitor native shell.

---

## Why This Exists

Mobile browser haptics were reliable for direct taps but not for:

- tracked-ticket alerts fired from polling/effects
- Snake pellet and collision feedback fired from the game loop
- Brick Mayhem paddle, brick, level-clear, and ball-loss feedback fired from the animation loop

The native shell solves that by routing haptics through `@capacitor/haptics` instead of browser `navigator.vibrate()` behavior.

---

## Current Architecture

### Shared semantic layer

- `src/lib/haptics.ts`
  - Defines `AppHapticIntent`
  - Maps each intent to both web and native implementations
- `src/components/haptics-provider.tsx`
  - Owns the `haptics-enabled` preference
  - Detects whether the app is running in a native shell
  - Uses `web-haptics` on the web path
  - Uses `@capacitor/haptics` on the native path
- `src/lib/native-haptics.ts`
  - Wraps Capacitor Haptics plugin calls

### Native shell files

- `capacitor.config.ts`
- `capacitor-www/index.html`
- `ios/`
- `android/`

### Diagnostic surface

- `/haptics`
  - always exposes raw `web-haptics` preset tests
  - when running inside Capacitor, also exposes direct native plugin tests

---

## Current Behavioral Policy

### Web path

- Keep haptics on direct user interactions only.
- Supported examples:
  - buttons
  - accepted Snake turns
  - confirmed difficulty changes
  - language/theme/back controls
- Not supported on the web path:
  - tracked-ticket buzz alerts
  - Snake pellet/collision haptics
  - Brick Mayhem paddle/brick/level/life haptics

### Native shell path

- Preserve the same semantic direct-input haptics as the web path.
- Restore async and game-loop haptics:
  - `/new` tracked-ticket called alert
  - Arcade tracked-ticket called alert
  - Snake pellet eaten and collision/game-over
  - Brick Mayhem brick destruction, paddle bounce, level clear, and ball lost/game over

---

## Intent Mapping

| Intent | Web path | Native shell |
|--------|----------|--------------|
| `uiSelect` | app-owned selection pulse | Capacitor selection sequence |
| `uiToggle` | `soft` | light impact |
| `uiConfirm` | `medium` | medium impact |
| `uiDestructive` | `heavy` | heavy impact |
| `uiError` | `error` | error notification |
| `gameContact` | app-owned light contact pulse | light impact |
| `gameImpact` | app-owned impact pulse | medium impact |
| `gameReward` | app-owned reward pulse | success notification |
| `gameFailure` | `error` | error notification |
| `queueAlert` | app-owned double pulse | `vibrate({ duration: 500 })` |

---

## Commands

From `/Users/russbook/lotto`:

```bash
npm install
npm run capacitor:sync
```

Open native projects:

```bash
npm run capacitor:open:ios
npm run capacitor:open:android
```

Sync against a live server URL for internal mobile testing:

```bash
npm run capacitor:sync:live -- https://williamtemple.app
```

Or with a custom environment variable:

```bash
CAPACITOR_SERVER_URL=https://your-host.example npm run capacitor:sync
```

---

## Live-Testing Notes

- `capacitor.config.ts` reads `CAPACITOR_SERVER_URL` at sync time.
- When `CAPACITOR_SERVER_URL` is set, Capacitor uses `server.url` and `allowNavigation` for the native shell.
- This live-server mode is intended for internal testing and iteration.
- The committed fallback `capacitor-www/index.html` exists so native projects remain syncable even when no live server URL is provided.

---

## Validation Checklist

1. Confirm `/haptics` works in the native shell for both raw `web-haptics` and direct Capacitor buttons.
2. Confirm `/new` vibrates when the tracked ticket is called.
3. Confirm Arcade tracked-ticket alerts vibrate during the centered callout/confetti state.
4. Confirm Snake vibrates on pellet eat and collision/game-over.
5. Confirm Brick Mayhem vibrates on paddle bounce, brick hit, level clear, and ball loss.
6. Confirm `/`, `/display`, admin, staff, and login remain haptic-free.

---

## Known Limits

- Native async/game-loop haptics require the Capacitor shell. They are not guaranteed in the browser.
- The continuous Brick Mayhem paddle slider remains intentionally haptic-free; only actual gameplay collisions vibrate in native mode.
- The haptics toggle remains advisory only. No operational flow may rely on vibration for comprehension.
