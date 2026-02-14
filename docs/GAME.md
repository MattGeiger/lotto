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

Document Version: 3.0  
Last Updated: 2026-02-14  
Revision: Replaced display-integration strategy with explicit separation-first Arcade architecture and pixel-art direction.
