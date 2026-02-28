/* ── Brick Mayhem – Type definitions ── */

/** 2D position with continuous coordinates. */
export type Vec2 = { x: number; y: number };

/** Ball state: position + velocity. */
export type BallSpeedEffect = "normal" | "red" | "cyan" | "purple";

/** Ball state: id + position + velocity + active speed effect. */
export type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speedEffect: BallSpeedEffect;
};

/** Paddle state: horizontal position (left edge X). */
export type Paddle = {
  x: number;
};

/** A single brick in the layout. */
export type Brick = {
  /** Column index (0-based). */
  col: number;
  /** Row index (0-based). */
  row: number;
  /** Whether this brick is still alive. */
  alive: boolean;
};

/** Level configuration – a 2D grid where 1 = brick, 0 = empty. */
export type LevelConfig = ReadonlyArray<ReadonlyArray<0 | 1>>;

/** Complete world state for one frame of the game. */
export type TimedEffects = {
  widePaddleMs: number;
  triplePointsMs: number;
};

export type ActiveEffects = {
  /** Green brick effect: spawns one persistent clone paddle for this level. */
  clonePaddle: boolean;
  timed: TimedEffects;
};

export type World = {
  balls: Ball[];
  nextBallId: number;
  paddle: Paddle;
  bricks: Brick[];
  level: number;
  lives: number;
  score: number;
  /** True when ball has been launched, false when sitting on paddle. */
  launched: boolean;
  activeEffects: ActiveEffects;
};

/** Difficulty-dependent parameters threaded through engine & renderer. */
export type DifficultyParams = {
  /** Effective paddle width in pixels. */
  paddleW: number;
  /** Speed multiplier applied to ball speed (1 = normal). */
  speedMul: number;
};
