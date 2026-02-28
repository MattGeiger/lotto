/* ── Brick Mayhem – Numeric constants ── */

/** Native canvas width in pixels. */
export const BOARD_W = 192;

/** Native canvas height in pixels. */
export const BOARD_H = 160;

/** Ball width and height in pixels. */
export const BALL_SIZE = 4;

/** Paddle width in pixels. */
export const PADDLE_W = 16;

/** Paddle height in pixels. */
export const PADDLE_H = 4;

/** Paddle Y position (top edge) — sits at the bottom of the board. */
export const PADDLE_Y = BOARD_H - PADDLE_H - 2;

/** Number of brick columns. 12 * 16 = 192. */
export const BRICK_COLS = 12;

/** Brick width in pixels. */
export const BRICK_W = 16;

/** Brick height in pixels. */
export const BRICK_H = 8;

/** Vertical offset (in pixels) before the first brick row. */
export const BRICK_TOP_OFFSET = 16;

/** Starting ball speed in pixels per fixed timestep. */
export const BALL_SPEED_INITIAL = 1.2;

/** Ball speed increase per level. */
export const BALL_SPEED_PER_LEVEL = 0.15;

/** Maximum ball speed cap. */
export const BALL_SPEED_MAX = 2.5;

/** Fixed timestep in milliseconds (~60 fps). */
export const FIXED_STEP_MS = 16;

/** Starting number of lives. */
export const INITIAL_LIVES = 3;

/** Points per brick destroyed. */
export const POINTS_PER_BRICK = 10;

/** Keyboard paddle movement speed in pixels per keydown frame. */
export const KEYBOARD_PADDLE_SPEED = 3;

/**
 * Maximum deflection angle (in radians) when ball hits the edge of the paddle.
 * ~60 degrees — steep but not horizontal.
 */
export const MAX_BOUNCE_ANGLE = (Math.PI / 180) * 60;

/** Vertical offset for the clone paddle spawned by green bricks. */
export const CLONE_PADDLE_OFFSET_Y = 64;

/** Pink brick effect: paddle width multiplier. */
export const WIDE_PADDLE_MUL = 2;

/** Gold brick effect: points multiplier while active. */
export const TRIPLE_POINTS_MUL = 3;

/** Duration for timed brick effects (pink / gold). */
export const TIMED_EFFECT_DURATION_MS = 30_000;

/** Hard cap for extending timed effects via repeat hits. */
export const TIMED_EFFECT_MAX_MS = 120_000;

/** Keep ball speed within this band to reduce collision tunneling risk. */
export const BALL_SPEED_MIN = 0.6;
export const BALL_SPEED_MAX_EFFECTIVE = 4;

/** Limit multiball fan-out so gameplay remains readable and stable. */
export const MAX_BALLS = 4;

/* ── Fragment (brick shatter) constants ── */

/** Maximum lifetime of a brick fragment in ticks (~90 ticks ≈ 1.5s). */
export const FRAGMENT_MAX_AGE = 90;

/** Gravity applied to fragments each tick (pixels/tick²). */
export const FRAGMENT_GRAVITY = 0.18;

/** Horizontal spread speed range for fragments (pixels/tick). */
export const FRAGMENT_SPREAD_X = 0.8;

/** Initial upward velocity for fragments (pixels/tick). */
export const FRAGMENT_INITIAL_VY = -1.2;
