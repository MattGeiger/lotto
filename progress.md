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
