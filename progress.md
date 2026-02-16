Original prompt: Let's address a separate issue. I've got Codex working to finalize our font rendering and theme handling. Task 0: review AGENTS.md for guidance. ISSUE: The game SNAKE can be challenging, especially for people with slow reflexes. Let's add this component to the UI for the game snake: npx shadcn@latest add @8bitcn/slider. We can then add a speed control to the game, so that players can choose to slow down or speed up the snake. From left to right: Slow (half speed), Normal (default/current speed), Fast (2x regular speed). We can also have a slide for difficulty: Easy, Medium, Hard. Easy = food pellets are gated to be at least 5 squares away from the walls. Medium = food pellets are gated to be at least 3 squares away from the walls. Hard = food pellets can appear anywhere in the playing area grid. Ensure that documentation is updated at path: Before implementing these changes, please write details about this issue and the implementation to path: /Users/russbook/lotto/docs/GAME.md /Users/russbook/lotto/docs/ISSUES.md

## TODO
- Update docs/GAME.md with pre-implementation details for Snake speed + difficulty sliders.
- Update docs/ISSUES.md with a dedicated issue entry and implementation plan.
- Install @8bitcn/slider and integrate controls into Snake page.
- Implement speed multipliers and difficulty-based food spawn gating.
- Update localization keys, Arcade styles, changelog/planning docs, and run validation.

## Notes
- Current worktree is already dirty; avoid touching unrelated diffs.
- Snake logic currently lives in src/app/(arcade)/arcade/snake/page.tsx with setInterval tick loop.
- Deterministic initial pellet logic exists to avoid hydration mismatch; preserve deterministic behavior.
- 2026-02-16: Added pre-implementation documentation entries in docs/GAME.md and docs/ISSUES.md for Snake speed + difficulty controls before code changes.
- 2026-02-16: Installed `@8bitcn/slider` with shadcn and integrated Arcade slider controls into Snake.
- 2026-02-16: Implemented speed presets (360/180/90ms) and difficulty-gated pellet spawn (5/3/0 cells from walls) with fallback behavior.
- 2026-02-16: Updated docs/changelog/planning files to reflect implemented state.
- 2026-02-16: Validation complete: `npm run lint` (warnings only, pre-existing) and `npm test` (125/125 passing).
- 2026-02-16: Playwright skill check attempted but blocked (`playwright` package not available in environment), so gameplay verification was done via code-path review + existing test suite instead.
- 2026-02-16: Moved Snake speed/difficulty sliders into a separate card directly beneath the instructions card; left the sticky bottom dock for D-pad controls only.
- 2026-02-16: Added requested slider-card heading text `DIFFICULTY SETTING` and tightened slider-card content spacing.
- 2026-02-16: Consolidated to one six-mode Snake settings slider (`VERY EASY` -> `NIGHTMARE`) and added Nightmare pellet timeout-respawn logic (`5s`).
- 2026-02-16: Removed decorative slider border framing to match the unified-slider design.
- 2026-02-16: Verified `npm test` and `npm run build` pass; `npm run lint` still reports only pre-existing warnings.
- 2026-02-16: Removed the preset text row beneath the slider so only the live setting label is shown.
- 2026-02-16: Tuned slider color tokens for WCAG non-text contrast (dark mode issue fix) and verified contrast ratios for panel/track/range/thumb combinations.
- 2026-02-16: Removed hard text-shadow styling from small Snake UI text (mode label + score/length readout) to improve readability.
- 2026-02-16: Updated `/arcade` `PLAY SNAKE` button text rendering to wrap by words for multilingual labels.
- 2026-02-16: Replaced Arcade mode-switcher icons with full 8bitcn retro geometry and flipped visibility to sun in light mode / moon in dark mode for app-wide consistency.
