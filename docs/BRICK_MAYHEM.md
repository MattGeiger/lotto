# Brick Mayhem - Game Design Document

## Status
- **MVP implemented.** Core gameplay is fully playable.
- Scaffolding (page shell, CSS, translations, menu entry) is complete.
- Game engine (physics, collision, rendering, levels) is complete.
- Paddle slider control, keyboard input, and game loop are wired up.
- 5 progressive levels ship in the MVP.

## Concept

Brick Mayhem is a breakout-style arcade game. The player controls a horizontal paddle at the bottom of the play area to bounce a ball upward into rows of bricks. Bricks shatter on contact. The objective is to clear a path through the brick layers so the ball reaches the top of the play area.

The game is designed as the second Arcade offering alongside Snake, sharing the same retro pixel-art visual system and page layout conventions.

---

## Core Rules

### Objective
- Clear bricks to open a path for the ball to reach the top of the play area.
- Reaching the top completes the current level.

### Lives
- The player starts each game with **3 lives**.
- A life is lost when the ball falls past the paddle (drops below the play area floor).
- A life is **gained** each time the ball reaches the top of the play area (level clear).
- The game ends when the player has **0 lives** remaining after dropping the ball.

### Levels
- Each level presents a new arrangement of brick rows.
- Levels get progressively harder (more bricks, tougher layouts, faster ball speed, or a combination).
- Completing a level (ball reaches the top) awards a bonus life and advances to the next level.

### Scoring
- Each brick destroyed awards **10 points**.
- Level multipliers and combo bonuses are deferred to post-MVP.

---

## Controls

### Design Principle
The play area must remain **completely unobstructed** during gameplay. All input is handled via the control dock below the board — the player's fingers never cover the paddle, ball, or bricks.

### Input Model
The player controls the paddle using a **slider control in the control dock**:
- **Touch (mobile):** Drag finger left/right on the slider track in the control dock. The slider thumb's X position maps directly to the paddle's X position on the board.
- **Mouse (desktop):** Click and drag the slider thumb in the control dock. All mouse input targets the dock, not the play area.
- **Keyboard (desktop):** Left/right arrow keys as a fallback input method (incremental movement).

The paddle moves **horizontally only** along the bottom edge of the play area. The slider acts as a 1:1 spatial proxy for the paddle — thumb at the left edge of the slider = paddle at the left wall, thumb at the right edge = paddle at the right wall.

### Control Dock Layout
The control dock (sticky bottom bar) contains two controls stacked vertically with generous spacing to prevent accidental pauses while dragging the slider:
1. A small **Pause/Play button** (top) — toggles between `RUNNING` and `PAUSED` states.
2. A **paddle slider control** (bottom) — a horizontal track the player drags to position the paddle. This is the primary input for both touch and mouse.

The Snake-style D-pad is not used. Brick Mayhem replaces directional controls with a single-axis slider. No input is accepted on the play area itself — the board is view-only.

---

## Play Area

### Board Dimensions
- The play area grid is **192 pixels wide x 160 pixels tall** (6:5 landscape ratio).
- The board container uses `aspect-ratio: 192 / 160` so the visible play area matches the native grid proportions. This differs from Snake's 1:1 square board.
- Container width is driven by `--arcade-board-size`; height follows from the aspect ratio.
- Rendered via HTML5 `<canvas>` for pixel-crisp drawing consistent with the Snake approach.
- The canvas is scaled up to fill the container using CSS while preserving the native pixel grid via `image-rendering: pixelated`.

### Entity Dimensions

| Entity | Size (pixels) | Notes |
|--------|---------------|-------|
| **Ball** | 4w x 4h | Square pixel ball. |
| **Paddle** | 16w x 4h | Horizontal bar. Positioned along the bottom edge of the play area. |
| **Bricks** | 16w x 8h | 12 columns × 16px = 192px (fills board width exactly). 2:1 aspect ratio per brick. |

### Entities

| Entity | Description |
|--------|-------------|
| **Paddle** | Horizontal bar at the bottom of the play area. Player-controlled. Bounces the ball upward on contact. Width is 16px (~8.3% of the board width). |
| **Ball** | A 4x4 pixel square that moves continuously, bouncing off walls, the paddle, and bricks. |
| **Bricks** | Rectangular blocks arranged in rows near the top of the play area. Destroyed on ball contact. |
| **Walls** | Left, right, and top edges of the play area are solid walls that reflect the ball. The bottom edge is open — the ball falls through if the paddle misses it. |

### Ball Physics
- The ball has continuous position and velocity: `{ x, y, vx, vy }` where `vx`/`vy` are pixels per fixed timestep.
- Starting speed is ~1–1.5 px/step. Ball speed may increase with level progression.
- Collision reflection rules:
  - **Left/right wall:** negate `vx`.
  - **Top wall:** negate `vy`.
  - **Brick bottom/top face:** negate `vy`, destroy brick.
  - **Brick side face:** negate `vx`, destroy brick.
  - **Paddle:** negate `vy`, and adjust `vx` based on where the ball struck the paddle surface. Contact offset from paddle center is normalized to a -1..+1 range across the paddle width. Dead center = straight up, edges = steep angles. This gives the player directional control over the ball.
- Collision detection uses axis-aligned bounding box (AABB) overlap checks. At ~1px/step with a 2px ball, tunneling through bricks is not a concern at early speeds. If ball speed ever exceeds ball size per step, a simple swept check along the movement vector will be added.

### Brick Layout
- Bricks are arranged in horizontal rows spanning the 192px width of the play area.
- **12 columns** at **16px wide** each fills the board exactly (12 × 16 = 192). Brick height is **8px** (2:1 aspect ratio per brick).
- Rows are positioned in the upper portion of the board, leaving open space between the bricks and the paddle.
- Level layouts are defined as plain data arrays — a 2D grid where each cell is `0` (empty) or `1` (brick). This keeps level design declarative and separate from engine logic.
- All bricks in the MVP are single-hit (one ball contact = destroyed). Multi-hit bricks may be added later.

---

## Game States

The game uses the same four-state model as Snake:

| State | Description |
|-------|-------------|
| `READY` | Initial state. Board is drawn with bricks and paddle visible. Ball is stationary on the paddle. Waiting for player to start. |
| `RUNNING` | Ball is in motion. Paddle responds to player input. Collision detection is active. |
| `PAUSED` | Ball and game logic frozen. Paddle input ignored. Triggered by pause button or ticket-called event. |
| `GAME_OVER` | All lives lost. Final score displayed. Player can restart. |

### Level Transitions
- When the ball reaches the top: game briefly pauses, awards a bonus life, clears remaining bricks (if any), then initializes the next level layout and resumes from `READY` with the ball on the paddle.
- The transition between levels is TBD (could be instant, or could include a short celebration animation).

---

## Engine Architecture

### Separation Principle
All game logic lives in pure functions under `src/arcade/game/brick-mayhem/`. The page component is a thin shell that wires up a canvas, an animation loop, and input listeners. No game math in the React component.

### Game Loop
Brick Mayhem uses a **continuous `requestAnimationFrame` loop with a fixed timestep**, not `setInterval` like Snake. Snake is tick-based (discrete grid movement); breakout requires sub-pixel continuous 2D physics.

The loop uses a delta-time accumulator with a fixed step (~16ms):

```
accumulator += deltaTime
while (accumulator >= FIXED_STEP) {
  world = tick(world, FIXED_STEP)
  accumulator -= FIXED_STEP
}
render(world)
```

This keeps physics deterministic regardless of frame rate.

### Rendering
One canvas, one `drawBoard(world)` function per frame. Each frame: clear canvas → draw bricks → draw paddle → draw ball. At 192×160 native resolution scaled up via CSS, this is trivially fast.

### Ball Drop and Life Loss
When the ball's Y position exceeds 160 (falls past the bottom edge):
- Decrement lives by 1.
- If lives > 0: reset ball to sitting on the paddle, return to a `READY` sub-state (waiting for player to launch).
- If lives = 0: transition to `GAME_OVER`.

---

## Arcade Integration

Brick Mayhem follows the same Arcade integration patterns established by Snake:

- **Route:** `/arcade/brick-mayhem` under the `(arcade)` route group.
- **Layout:** Inherits `ArcadeShell` + `NowServingBanner` + language/mode switchers from the shared Arcade layout.
- **Ticket-called event:** Listens for `ARCADE_TICKET_CALLED_EVENT` and auto-pauses to `PAUSED` if currently `RUNNING`.
- **Play-resumed event:** Dispatches `ARCADE_PLAY_RESUMED_EVENT` on start/resume to dismiss the ticket-called overlay.
- **Styling:** Uses Arcade-scoped CSS classes (`arcade-brick-*`) and shared Arcade CSS custom properties. No global theme changes.
- **Data boundary:** All game state is local client state. No raffle API dependency.
- **Translations:** Instruction keys are defined for all 8 supported locales under `brickMayhem*` prefixes.

---

## Implementation State

### Complete
- [x] Route directory: `src/app/(arcade)/arcade/brick-mayhem/page.tsx`
- [x] Page shell: back button, instructions card, play now/reset buttons, score/lives/level readout, board, control dock
- [x] CSS classes: `arcade-brick-shell`, `arcade-brick-stage`, `arcade-brick-readout`, `arcade-brick-board`, `arcade-brick-canvas`, `arcade-brick-overlay`, `arcade-brick-control-dock`, `arcade-brick-pad`, `arcade-brick-slider-track`, `arcade-brick-control-btn` (with light/dark mode, responsive, and RTL variants)
- [x] Board aspect ratio: `192 / 160` (6:5 landscape)
- [x] Translations: `brickMayhemTitle` + 5 instruction keys + `lives` + `level` across all 8 locales
- [x] Arcade menu: entry points to `/arcade/brick-mayhem`
- [x] Game state skeleton: `READY`/`RUNNING`/`PAUSED`/`GAME_OVER` status with pause/play/reset wiring
- [x] Ticket-called event listener (auto-pause)
- [x] Play-resumed event dispatch
- [x] Canvas rendering (board, paddle, ball, bricks with row-colored palette)
- [x] Paddle slider control in control dock (touch drag + mouse drag)
- [x] Ball physics and movement loop (`requestAnimationFrame` with fixed ~16ms timestep)
- [x] Brick layout generation (data-driven level arrays — 5 levels)
- [x] Collision detection (ball vs. paddle, ball vs. bricks, ball vs. walls — AABB)
- [x] Paddle-position-influenced ball reflection angles (±60° max)
- [x] Life tracking and life-loss detection (3 starting lives)
- [x] Level progression (ball speed increases per level, bonus life on level clear)
- [x] Scoring system (10 points per brick)
- [x] Win/level-clear state (ball reaches top → advance level)
- [x] Keyboard arrow key input for paddle (fallback)
- [x] Space bar for start/pause/resume
- [x] Auto-start on slider drag or arrow key from READY state
- [x] Theme-aware rendering (light/dark mode via CSS custom properties)
- [x] Control dock stacked layout with generous spacing to prevent accidental pauses

### Not Yet Implemented
- [ ] Sound effects (deferred)
- [ ] Power-ups (deferred)
- [ ] Multi-hit bricks (deferred)
- [ ] Level-clear transition animation (currently instant)

---

## File Structure

```text
src/
  app/
    (arcade)/
      arcade/
        brick-mayhem/
          page.tsx              # game page (canvas, loop, controls, state)
  arcade/
    game/
      brick-mayhem/
        types.ts                # World, Ball, Paddle, Brick, LevelConfig, Vec2
        constants.ts            # board dimensions, paddle size, ball speed, brick sizing
        engine.ts               # pure game-logic functions (tick, collision, reflection)
        levels.ts               # 5 level layouts as 2D data arrays (0 = empty, 1 = brick)
        renderer.ts             # drawBoard(ctx, world) — single canvas pass per frame
    styles/
      arcade.css                # arcade-brick-* classes
```

---

## Implementation Sequence

Build incrementally in this order, each step producing a testable result:

1. **Types & constants** — Define `World`, `Ball`, `Paddle`, `Brick` types and all numeric constants in `types.ts` and `constants.ts`.
2. **Canvas + static render** — Wire up `<canvas>` in the page component, implement `drawBoard()` in `renderer.ts`. Draw a static paddle, a stationary ball, and a hardcoded brick layout. Visually verify proportions.
3. **Game loop + ball movement** — Implement the `requestAnimationFrame` accumulator loop. Ball moves and bounces off walls. No paddle interaction yet.
4. **Paddle input** — Add the slider control to the control dock. Wire touch drag, mouse drag, and keyboard arrow keys. Paddle tracks slider position on canvas.
5. **Collision detection** — Ball vs. paddle (with position-influenced reflection), ball vs. bricks (AABB, destroy on contact), ball vs. bottom edge (life loss).
6. **Game state + lives + levels** — Wire up life tracking, level progression, `READY`/`RUNNING`/`PAUSED`/`GAME_OVER` transitions, level-clear bonus life, and multiple level layouts in `levels.ts`.
7. **Scoring + polish** — Implement scoring system, game-over screen integration, and any visual polish (brick colors, animations, etc.).

---

## Decided Specifications

| Parameter | Value |
|-----------|-------|
| Board grid | 192w x 160h pixels |
| Board aspect ratio | 192:160 (6:5) — container matches grid ratio, not square |
| Ball size | 4w x 4h pixels |
| Paddle size | 16w x 4h pixels |
| Brick size | 16w x 8h pixels (2:1 aspect ratio) |
| Brick columns | 12 columns × 16px = 192px (fills board exactly) |
| Reflection model | Paddle-position-influenced — contact offset normalized to -1..+1, center = straight up, edges = steep angles |
| Collision detection | Axis-aligned bounding box (AABB) overlap checks |
| Game loop | Continuous `requestAnimationFrame` with delta-time accumulator and ~16ms fixed timestep |
| Engine separation | Pure functions in `src/arcade/game/brick-mayhem/`, React page is a thin shell |
| Level data format | 2D arrays — each cell is `0` (empty) or `1` (brick) |
| Rendering | Single `<canvas>`, one `drawBoard()` pass per frame at 192×160 native resolution |
| Starting ball speed | 1.2 px/step, +0.15/level, capped at 2.5 |
| Scoring | 10 points per brick |
| Starting lives | 3 |
| MVP levels | 5 (progressive density) |
| Max bounce angle | ±60° from vertical |

## Open Questions

- Paddle width — fixed at 16px or variable (shrinks at higher levels)?
- Level-clear transition — add a brief animation or keep instant?
- Power-ups — deferred, but which types when added?
- Sound effects — deferred, revisit post-MVP.
- Additional levels beyond the initial 5.

---

Document Version: 2.0
Last Updated: 2026-02-27
