/* ── Brick Mayhem – Pure game-logic functions ── */

import {
  BALL_SIZE,
  BALL_SPEED_INITIAL,
  BALL_SPEED_MAX,
  BALL_SPEED_PER_LEVEL,
  BOARD_H,
  BOARD_W,
  BRICK_H,
  BRICK_TOP_OFFSET,
  BRICK_W,
  INITIAL_LIVES,
  MAX_BOUNCE_ANGLE,
  PADDLE_H,
  PADDLE_W,
  PADDLE_Y,
  POINTS_PER_BRICK,
} from "./constants";
import { LEVELS } from "./levels";
import type { Brick, LevelConfig, World } from "./types";

/* ── Helpers ── */

/** Ball speed for the given level index (0-based). */
export function ballSpeedForLevel(level: number): number {
  return Math.min(BALL_SPEED_INITIAL + level * BALL_SPEED_PER_LEVEL, BALL_SPEED_MAX);
}

/** Build the brick array from a level config. */
export function buildBricks(config: LevelConfig): Brick[] {
  const bricks: Brick[] = [];
  for (let row = 0; row < config.length; row++) {
    const cols = config[row];
    for (let col = 0; col < (cols?.length ?? 0); col++) {
      if (cols![col] === 1) {
        bricks.push({ col, row, alive: true });
      }
    }
  }
  return bricks;
}

/** Get pixel rect for a brick. */
function brickRect(b: Brick) {
  return {
    x: b.col * BRICK_W,
    y: BRICK_TOP_OFFSET + b.row * BRICK_H,
    w: BRICK_W,
    h: BRICK_H,
  };
}

/* ── World creation ── */

/** Create a fresh world for the given level index. */
export function createWorld(level: number, lives: number, score: number): World {
  const config = LEVELS[level % LEVELS.length]!;
  const paddleX = (BOARD_W - PADDLE_W) / 2;

  return {
    ball: {
      x: paddleX + PADDLE_W / 2 - BALL_SIZE / 2,
      y: PADDLE_Y - BALL_SIZE,
      vx: 0,
      vy: 0,
    },
    paddle: { x: paddleX },
    bricks: buildBricks(config),
    level,
    lives,
    score,
    launched: false,
  };
}

/** Create the initial world (level 0). */
export function initialWorld(): World {
  return createWorld(0, INITIAL_LIVES, 0);
}

/** Launch the ball from the paddle. */
export function launchBall(world: World): World {
  if (world.launched) return world;
  const speed = ballSpeedForLevel(world.level);
  // Launch at a slight random angle so the game isn't purely vertical.
  const angle = ((Math.random() - 0.5) * Math.PI) / 6; // +-15 degrees from vertical
  return {
    ...world,
    ball: {
      ...world.ball,
      vx: speed * Math.sin(angle),
      vy: -speed * Math.cos(angle),
    },
    launched: true,
  };
}

/* ── Tick (one fixed-timestep update) ── */

export type TickResult = {
  world: World;
  /** True when the ball fell past the paddle this tick. */
  ballLost: boolean;
  /** True when the ball reached the top this tick (level clear). */
  levelCleared: boolean;
};

export function tick(world: World, paddleX: number): TickResult {
  if (!world.launched) {
    // Ball sitting on paddle — just track paddle position.
    const clampedPx = clampPaddleX(paddleX);
    return {
      world: {
        ...world,
        paddle: { x: clampedPx },
        ball: {
          ...world.ball,
          x: clampedPx + PADDLE_W / 2 - BALL_SIZE / 2,
          y: PADDLE_Y - BALL_SIZE,
        },
      },
      ballLost: false,
      levelCleared: false,
    };
  }

  let { x, y, vx, vy } = world.ball;
  let { score } = world;
  const bricks = world.bricks.map((b) => ({ ...b }));
  const px = clampPaddleX(paddleX);

  // Move ball.
  x += vx;
  y += vy;

  // ── Wall collisions ──

  // Left wall.
  if (x <= 0) {
    x = 0;
    vx = Math.abs(vx);
  }
  // Right wall.
  if (x + BALL_SIZE >= BOARD_W) {
    x = BOARD_W - BALL_SIZE;
    vx = -Math.abs(vx);
  }
  // Top wall — level cleared.
  if (y <= 0) {
    return {
      world: {
        ...world,
        ball: { x, y: 0, vx, vy: Math.abs(vy) },
        paddle: { x: px },
        bricks,
        score,
      },
      ballLost: false,
      levelCleared: true,
    };
  }

  // ── Paddle collision ──

  if (
    vy > 0 &&
    y + BALL_SIZE >= PADDLE_Y &&
    y + BALL_SIZE <= PADDLE_Y + PADDLE_H &&
    x + BALL_SIZE > px &&
    x < px + PADDLE_W
  ) {
    // Reflect with position-influenced angle.
    const hitOffset = (x + BALL_SIZE / 2 - (px + PADDLE_W / 2)) / (PADDLE_W / 2);
    const clampedOffset = Math.max(-1, Math.min(1, hitOffset));
    const angle = clampedOffset * MAX_BOUNCE_ANGLE;
    const speed = Math.sqrt(vx * vx + vy * vy);
    vx = speed * Math.sin(angle);
    vy = -speed * Math.cos(angle);
    y = PADDLE_Y - BALL_SIZE;
  }

  // ── Brick collisions ──

  for (const brick of bricks) {
    if (!brick.alive) continue;

    const br = brickRect(brick);

    // AABB overlap check.
    if (x + BALL_SIZE <= br.x || x >= br.x + br.w || y + BALL_SIZE <= br.y || y >= br.y + br.h) {
      continue;
    }

    brick.alive = false;
    score += POINTS_PER_BRICK;

    // Determine collision face for reflection.
    const overlapLeft = x + BALL_SIZE - br.x;
    const overlapRight = br.x + br.w - x;
    const overlapTop = y + BALL_SIZE - br.y;
    const overlapBottom = br.y + br.h - y;

    const minOverlapX = Math.min(overlapLeft, overlapRight);
    const minOverlapY = Math.min(overlapTop, overlapBottom);

    if (minOverlapX < minOverlapY) {
      vx = -vx;
    } else {
      vy = -vy;
    }

    // Only handle one brick collision per tick to avoid double-reflect.
    break;
  }

  // ── Ball lost (below board) ──

  if (y >= BOARD_H) {
    return {
      world: {
        ...world,
        ball: { x, y, vx: 0, vy: 0 },
        paddle: { x: px },
        bricks,
        score,
        launched: false,
      },
      ballLost: true,
      levelCleared: false,
    };
  }

  return {
    world: {
      ...world,
      ball: { x, y, vx, vy },
      paddle: { x: px },
      bricks,
      score,
    },
    ballLost: false,
    levelCleared: false,
  };
}

/* ── Utilities ── */

function clampPaddleX(x: number): number {
  return Math.max(0, Math.min(BOARD_W - PADDLE_W, x));
}

/** Count alive bricks in the world. */
export function aliveBrickCount(world: World): number {
  return world.bricks.filter((b) => b.alive).length;
}
