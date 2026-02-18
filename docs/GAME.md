# Arcade Snake - Separation-First Technical Design

## Status
- This document is the current source of truth for Arcade planning.
- It supersedes the prior "integrate Snake into the Display Page" direction.

## Decision Summary
- Arcade is a distinct product area, not an extension of the raffle display.
- Snake must run in a dedicated Arcade route and layout.
- Arcade visuals should use simple pixel-art UI, not raffle UI elements.
- Arcade logic and styling must be isolated from raffle/admin/display code.

## Explicit Non-Goals
- Do not embed Snake in `/` or in `src/components/readonly-display.tsx`.
- Do not reuse raffle ticket cards, queue legends, or raffle status classes (`ticket-serving`, `ticket-upcoming`, etc.).
- Do not bind Snake game state to raffle state or `/api/state`.
- Do not refactor global theming just to support Arcade visuals.

## Product Experience Goals
- Arcade should feel like its own mini-application inside the repo.
- Navigation into Arcade should be intentional and explicit.
- Visual language should be retro/pixel-art and clearly different from raffle pages.
- Mobile playability is required for MVP validation.

## Architecture Boundaries

### Route Boundary
- Use route groups to separate concerns:
- `src/app/(core)/*` for raffle/admin/login/staff.
- `src/app/(arcade)/arcade/*` for Arcade routes.

### Code Boundary
- Put all game features under `src/arcade/*`.
- Keep raffle logic in existing raffle-focused paths (`src/lib/state-manager.ts`, `src/components/readonly-display.tsx`, `src/app/admin/*`).

### Style Boundary
- Keep shared global tokens in `src/app/globals.css`.
- Add Arcade-specific tokens/utilities in Arcade-scoped CSS.
- Avoid broad global changes for Arcade-only visuals.

### Data Boundary
- MVP game state is local client state.
- Optional local persistence is limited to Arcade keys in `localStorage` (for example, high score).
- No raffle API reads/writes are required for gameplay.

### UI Component Boundary
- Keep shared app UI in `src/components/ui`.
- Place Arcade-themed UI wrappers/components in `src/arcade/ui` or `src/arcade/components`.
- If using 8bitcn, scope usage to Arcade only and avoid replacing global `theme-provider` or app-wide theme files.

## Recommended File Structure

```text
src/
  app/
    (core)/
      page.tsx
      admin/
      login/
      staff/
    (arcade)/
      arcade/
        layout.tsx
        page.tsx
        snake/
          page.tsx
  arcade/
    components/
    ui/
    game/
      engine.ts
      types.ts
      constants.ts
    hooks/
    lib/
    styles/
tests/
  arcade/
public/
  arcade/
```

## Visual Direction
- Use a clean pixel-art style:
- Blocky/pixel typography where practical.
- Simple high-contrast palettes.
- Pixel borders and low-noise backgrounds.
- Minimal decorative effects.

- Avoid raffle gradients/status metaphors in Arcade:
- No queue color legends.
- No raffle ticket metaphors in gameplay visuals.
- No "Now Serving" coupling in game HUD.

## Gameplay Scope (MVP)
- Classic Snake on a fixed grid.
- Touch-friendly controls for mobile (swipe or on-screen D-pad/buttons).
- Pause, restart, game-over, and score display.
- Optional local high score.
- No backend dependency required for core gameplay.

## Mobile Validation Plan
- Validate in simulated mobile devices before any production rollout.
- Test portrait and landscape layouts.
- Verify controls under touch input.
- Verify frame stability on lower-powered emulated devices.
- Verify accessibility basics (focus order, contrast, reduced motion handling).

## Current Build State (2026-02-18)
- Completed: isolated Arcade routes and layout (`/arcade`, `/arcade/snake`) with persistent `NOW SERVING` banner.
- Completed: Arcade-scoped 8-bit visual system and Press Start 2P font.
- Completed: Arcade home `PLAY SNAKE` CTA supports per-word wrapping for multi-word translations, avoiding overflow while preserving centered button layout.
- Completed: Arcade top-bar mode switcher now uses the full 8bitcn retro icon geometry and consistent theme semantics (sun in light mode, moon in dark mode).
- Completed: Snake movement shell with stable square board container and on-screen D-pad controls.
- Completed: D-pad chevron icon assets (Up/Down/Left/Right) with Arcade-yellow rendering.
- Completed: `PLAY NOW` smooth-scroll/focus behavior to move users directly to the play area.
- Completed: Arcade banner polling migrated to adaptive interval strategy used by Display.
- Completed: Snake movement loop starts with a 3-segment body and now grows by 1 per pellet.
- Completed: Wall and self-collision detection with game-over state and restart controls.
- Completed: Food pellet spawning on unoccupied cells plus score increments on pellet collection.
- Completed: Growth-on-food behavior with collision-safe body checks during growth ticks.
- Completed: Pause/resume controls preserve active game state (`PAUSE` -> `START`) without resetting board progress.
- Completed: Snake readouts moved outside the board (above/below) to keep gameplay cells unobstructed.
- Completed: Arcade `NOW SERVING` banner uses a retro alert pulse on ticket changes to improve in-game call visibility.
- Completed: Arcade banner now reads persisted homepage ticket selection; when present it switches from `NOW SERVING` to `ESTIMATED WAIT` and renders wait in `#h #m` format.
- Completed: When a tracked ticket is called, Arcade triggers a confetti burst and dispatches a ticket-called event so Snake auto-pauses from `RUNNING` to `PAUSED`.
- Completed: Arcade tracked-ticket wait output now uses conditional full units (`# minutes` under one hour; `# hours # minutes` at one hour and above), the wait-value frame border is removed in tracked mode, and the `ESTIMATED WAIT` label is downsized to better fit longer translations.
- Completed: Snake accessibility controls now use one Arcade slider with six presets (`VERY EASY`, `EASY`, `NORMAL`, `HARD`, `VERY HARD`, `NIGHTMARE`) that combine speed + spawn rules, including Nightmare pellet expiry/respawn.
- Completed: Arcade slider contrast tokens were tuned for WCAG non-text contrast in dark mode (and parity checked in light mode) for track, range, and thumb visibility.
- Completed: Small Snake UI text (mode label and score/length readout) no longer uses the hard pseudo-bold shadow, improving readability in dark mode while preserving larger retro headings.
- Completed: Arabic, Persian, and Chinese locale typography is enlarged on Snake gameplay readout labels (`SCORE`, `LENGTH`), the settings value row (`SETTING: ...`), and the center control label (`START`/`PAUSE`/`PLAY`) for stronger legibility.
- Completed: Snake board visuals now render through a single canvas path (grid + snake + pellet), replacing separate CSS grid overlays and DOM cells to prevent responsive subpixel misalignment on small screens.
- Completed: Tracked-ticket called-state behavior now replaces wait text with an explicit `TICKET CALLED!` / `PLEASE CHECK-IN` banner, animates that alert to viewport center for 10 seconds with flash emphasis, and repeats confetti during the same window.
- Completed: Called-state check-in callout now renders as a fixed centered overlay with responsive width/typography constraints to prevent message cropping on smaller screens while center-scale animation runs.
- Completed: Called-state overlay now computes a runtime viewport-fit scale in-browser from measured rendered dimensions, ensuring long localized strings (for example, Russian) remain fully visible during center-scale animation.
- Completed: During the active called-state animation window, Arcade now applies a temporary dim backdrop behind the centered check-in overlay, mirroring Snake `GAME OVER` play-area darkening.
- Completed: While ticket-called overlay messaging is active, the top Arcade banner continues to show `NOW SERVING: #<ticket>` for live queue context.
- Completed: Ticket-called center overlay now auto-hides when the alert window ends and also dismisses immediately when the player resumes Arcade gameplay.
- Not yet completed: Snake gameplay engine modules under `src/arcade/game/snake/*`.

## Accessibility Issue: Snake Reflex Controls (Implemented - 2026-02-16)
- Problem statement: current Snake pace can be too demanding for players with slower reflexes, and pellet placement near walls can make early rounds punishing.
- Scope: add player-adjustable settings without coupling Arcade gameplay to raffle features or global app theming.
- UI requirement: install and use `@8bitcn/slider` for one unified settings control inside the Snake page.

### Implemented Unified Settings Slider
- Control type: 6-stop slider, left to right:
- `VERY EASY` = half speed (`360ms`) + pellets at least 5 cells from walls.
- `EASY` = half speed (`360ms`) + pellets at least 3 cells from walls.
- `NORMAL` = regular speed (`180ms`) + pellets at least 3 cells from walls.
- `HARD` = regular speed (`180ms`) + pellets can spawn anywhere.
- `VERY HARD` = fast speed (`90ms`) + pellets can spawn anywhere.
- `NIGHTMARE` = fast speed (`90ms`) + pellets can spawn anywhere + pellets expire after 5 seconds and respawn if not eaten.
- Spawn gating rules:
- Apply wall-distance gating only to new pellet spawn candidates (not to existing pellet position unless respawned).
- Keep snake-body exclusion logic intact.
- If no valid cell remains under the selected gate (late-game edge case), degrade safely to any unoccupied cell to avoid deadlock.
- In Nightmare mode, pellet timeout respawn avoids reusing the same location when alternative cells are available.

### Implementation Touchpoints
- `src/app/(arcade)/arcade/snake/page.tsx`:
- Add unified mode state (speed + wall gate + optional pellet lifetime).
- Derive tick interval from selected mode and rerun timer effect when mode changes.
- Route pellet spawn through difficulty-aware candidate filtering.
- Add Nightmare-only pellet lifetime timer (`5000ms`) that respawns uneaten pellets.
- `src/arcade/styles/arcade.css`:
- Add Arcade-scoped slider/control layout styling for mobile-safe placement.
- Remove decorative slider border framing after consolidating to a single slider.
- `src/contexts/language-context.tsx`:
- Add translation keys for unified mode labels and setting copy.

## Detailed Implementation Checklist (Snake Logic)

### 1) Game Engine Foundation
- [ ] Create `src/arcade/game/snake/types.ts` with `Direction`, `Point`, `SnakeSegment`, `GameStatus`, and `GameState`.
- [ ] Create `src/arcade/game/snake/constants.ts` with board size (`20x20`), initial snake, tick rate, and score constants.
- [ ] Create `src/arcade/game/snake/engine.ts` with pure functions:
- [ ] `createInitialState()`
- [ ] `queueDirection()`
- [ ] `advanceTick()`
- [ ] `spawnFood()`
- [ ] `isCollision()`
- [ ] Keep engine API UI-agnostic (no React or DOM access inside engine functions).

### 2) Tick Loop and Timing
- [ ] Add a fixed-step loop in the Snake page or a dedicated hook (`useSnakeLoop`) using `requestAnimationFrame` + accumulator.
- [ ] Keep game speed deterministic on slow devices by processing discrete ticks.
- [ ] Ensure loop starts only when game status is `running`.
- [ ] Ensure loop fully stops on `paused` and `game-over`.
- [x] Add player-selectable mode presets that map to tick intervals (`360ms`, `180ms`, `90ms`) and apply changes without resetting active run state.

### 3) Input Rules (Keyboard + D-pad)
- [x] Route keyboard and D-pad input through one direction queue.
- [x] Prevent immediate 180-degree reversal (for example `LEFT` cannot flip directly to `RIGHT` in same tick).
- [x] Apply at most one turn per tick for deterministic behavior.
- [x] Keep on-screen controls active while preserving keyboard behavior.

### 4) Movement and Collision
- [x] Move snake head by one cell each tick.
- [x] Shift body segments correctly after head movement.
- [x] Detect wall collision and self-collision.
- [x] Transition to `game-over` state on collision.

### 5) Food, Growth, and Score
- [x] Spawn food only on unoccupied cells.
- [x] On food consumption: grow snake by one segment.
- [x] On food consumption: increment score.
- [x] Immediately respawn food after consumption.
- [x] Add unified mode presets that include wall-distance gates (`5`, `3`, `0`) and speed mapping in one control.
- [x] Ensure difficulty-gated spawn falls back to any unoccupied cell if constrained area is exhausted.
- [x] Add Nightmare mode pellet expiry (`5s`) with timed respawn when pellets are not eaten.
- [ ] Optional: track local high score in Arcade-specific `localStorage` key.

### 6) UI Wiring (From Shell to Playable)
- [x] Replace board placeholder overlay with actual rendered snake/food cells.
- [x] Add score HUD near board (Arcade-scoped only).
- [x] Make `PLAY NOW` initialize/reset game state and begin loop.
- [x] Add `RESTART` action for `game-over`.
- [x] Keep board rendering pixel-crisp and mobile-safe within current container constraints.
- [x] Add Arcade-scoped unified settings slider with labeled left-to-right mode options.

### 7) Lifecycle and Stability
- [ ] Pause game loop when tab becomes hidden; resume safely when visible.
- [ ] Reset transient input queue on pause/resume transitions.
- [x] Clean up all timers/animation frames/listeners on unmount.
- [x] Keep `NOW SERVING` banner polling independent from gameplay loop.

### 8) Testing and Validation
- [ ] Add unit tests under `tests/arcade/snake-engine.test.ts` for:
- [ ] movement updates
- [ ] reversal prevention
- [ ] wall/self collision detection
- [ ] food spawn exclusion of snake cells
- [ ] score and growth increments
- [ ] Add lightweight UI test(s) for start/restart state transitions.
- [ ] Validate on simulated mobile viewport before any production deployment.

### 9) Definition of Done (Snake MVP)
- [ ] Snake is fully playable via keyboard and on-screen controls.
- [ ] Score updates correctly and game-over/restart flows are complete.
- [ ] Mobile simulation validates playability and control reliability.
- [ ] No coupling introduced to raffle gameplay/state APIs.
- [ ] `CHANGELOG.md`, `docs/GAME.md`, and `docs/V2.0_PLANNED_FEATURES.md` reflect shipped behavior and remaining scope.

## Implementation Phases

### Phase 0 - Separation Scaffolding
- Add Arcade route group and layout.
- Add Arcade feature folders under `src/arcade`.
- Add Arcade-scoped styling entry.

### Phase 1 - Core Snake Loop
- Implement grid, movement, food spawn, collision, score.
- Add keyboard and touch controls.
- Add pause/restart/game-over states.

### Phase 2 - Pixel UI Polish
- Add retro/pixel component styling and HUD.
- Apply responsive mobile-first layout tuning.
- Add optional local high score persistence.

### Phase 3 - Hardening
- Add tests under `tests/arcade`.
- Validate no coupling to raffle state/API.
- Performance and accessibility passes.

## Acceptance Criteria
- Arcade routes render and function independently of raffle display/admin routes.
- No Arcade import path depends on raffle-specific components or state manager APIs.
- Snake does not use `/api/state` for gameplay.
- Arcade visuals are pixel-art and distinct from current raffle UI.
- Mobile simulation testing passes for controls and layout.

## Open Questions
- Primary control scheme for mobile MVP: swipe, on-screen controls, or both?
- Whether to enable local high score in MVP or Phase 2.
- Whether Arcade entry point should be linked from `/staff`, `/`, or both.

---

Document Version: 3.5  
Last Updated: 2026-02-16  
Revision: Consolidated Snake settings into one six-level slider, added Nightmare pellet expiry behavior, tuned slider contrast tokens for WCAG-compliant visibility, removed heavy shadows from small Snake labels/readouts, added per-word wrapped `PLAY SNAKE` CTA text for multilingual fit, and aligned Arcade mode-switcher icons with 8bitcn + app-consistent light/dark semantics.
