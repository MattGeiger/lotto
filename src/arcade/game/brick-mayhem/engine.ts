/* ── Brick Mayhem – Pure game-logic functions ── */

import {
  BALL_SIZE,
  BALL_SPEED_INITIAL,
  BALL_SPEED_MAX,
  BALL_SPEED_MAX_EFFECTIVE,
  BALL_SPEED_MIN,
  BALL_SPEED_PER_LEVEL,
  BOARD_H,
  BOARD_W,
  BRICK_H,
  BRICK_TOP_OFFSET,
  BRICK_W,
  CLONE_PADDLE_OFFSET_Y,
  FIXED_STEP_MS,
  INITIAL_LIVES,
  MAX_BALLS,
  MAX_BOUNCE_ANGLE,
  PADDLE_H,
  PADDLE_W,
  PADDLE_Y,
  POINTS_PER_BRICK,
  TIMED_EFFECT_DURATION_MS,
  TIMED_EFFECT_MAX_MS,
  TRIPLE_POINTS_MUL,
  WIDE_PADDLE_MUL,
} from "./constants";
import { getBrickRowMeta } from "./effects";
import { LEVELS } from "./levels";
import type { Ball, BallSpeedEffect, Brick, DifficultyParams, LevelConfig, World } from "./types";

/** Default difficulty: normal paddle width, normal speed. */
export const DEFAULT_DIFFICULTY: DifficultyParams = { paddleW: PADDLE_W, speedMul: 1 };

/* ── Helpers ── */

/** Ball speed for the given level index (0-based), scaled by difficulty. */
export function ballSpeedForLevel(level: number, speedMul: number = 1): number {
  return Math.min((BALL_SPEED_INITIAL + level * BALL_SPEED_PER_LEVEL) * speedMul, BALL_SPEED_MAX * speedMul);
}

export function speedMultiplierForBallEffect(effect: BallSpeedEffect): number {
  switch (effect) {
    case "red":
      return 1.5;
    case "cyan":
      return 0.5;
    case "purple":
      return 2;
    case "normal":
    default:
      return 1;
  }
}

export function clampBallSpeed(speed: number): number {
  return Math.max(BALL_SPEED_MIN, Math.min(BALL_SPEED_MAX_EFFECTIVE, speed));
}

export function targetBallSpeed(level: number, effect: BallSpeedEffect, dp: DifficultyParams = DEFAULT_DIFFICULTY): number {
  return clampBallSpeed(ballSpeedForLevel(level, dp.speedMul) * speedMultiplierForBallEffect(effect));
}

export function extendTimedEffectMs(currentMs: number): number {
  return Math.min(currentMs + TIMED_EFFECT_DURATION_MS, TIMED_EFFECT_MAX_MS);
}

export function clonePaddleY(): number {
  return PADDLE_Y - CLONE_PADDLE_OFFSET_Y;
}

export function effectivePaddleWidth(world: World, dp: DifficultyParams = DEFAULT_DIFFICULTY): number {
  return world.activeEffects.timed.widePaddleMs > 0
    ? Math.round(dp.paddleW * WIDE_PADDLE_MUL)
    : dp.paddleW;
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

function createParkedBall(id: number, paddleX: number, paddleW: number): Ball {
  return {
    id,
    x: paddleX + paddleW / 2 - BALL_SIZE / 2,
    y: PADDLE_Y - BALL_SIZE,
    vx: 0,
    vy: 0,
    speedEffect: "normal",
  };
}

function normalizeVelocity(vx: number, vy: number, speed: number): Pick<Ball, "vx" | "vy"> {
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag < 1e-6) {
    return { vx: 0, vy: -speed };
  }
  return {
    vx: (vx / mag) * speed,
    vy: (vy / mag) * speed,
  };
}

function withTargetSpeed(ball: Ball, level: number, dp: DifficultyParams): Ball {
  const target = targetBallSpeed(level, ball.speedEffect, dp);
  const nextVel = normalizeVelocity(ball.vx, ball.vy, target);
  return { ...ball, ...nextVel };
}

function decayTimedEffects(world: World): World["activeEffects"]["timed"] {
  return {
    widePaddleMs: Math.max(0, world.activeEffects.timed.widePaddleMs - FIXED_STEP_MS),
    triplePointsMs: Math.max(0, world.activeEffects.timed.triplePointsMs - FIXED_STEP_MS),
  };
}

/** Create a fresh world for the given level index. */
export function createWorld(level: number, lives: number, score: number, dp: DifficultyParams = DEFAULT_DIFFICULTY): World {
  const config = LEVELS[level % LEVELS.length]!;
  const paddleW = dp.paddleW;
  const paddleX = (BOARD_W - paddleW) / 2;
  const parkedBall = createParkedBall(1, paddleX, paddleW);

  return {
    balls: [parkedBall],
    nextBallId: 2,
    paddle: { x: paddleX },
    bricks: buildBricks(config),
    level,
    lives,
    score,
    launched: false,
    activeEffects: {
      clonePaddle: false,
      timed: {
        widePaddleMs: 0,
        triplePointsMs: 0,
      },
    },
  };
}

/** Create the initial world (level 0). */
export function initialWorld(dp: DifficultyParams = DEFAULT_DIFFICULTY): World {
  return createWorld(0, INITIAL_LIVES, 0, dp);
}

/** Launch the ball from the paddle. */
export function launchBall(world: World, dp: DifficultyParams = DEFAULT_DIFFICULTY): World {
  if (world.launched || world.balls.length === 0) return world;
  const firstBall = world.balls[0]!;
  const speed = targetBallSpeed(world.level, firstBall.speedEffect, dp);
  // Launch at a slight random angle so the game isn't purely vertical.
  const angle = ((Math.random() - 0.5) * Math.PI) / 6; // +-15 degrees from vertical
  return {
    ...world,
    balls: [
      {
        ...firstBall,
        vx: speed * Math.sin(angle),
        vy: -speed * Math.cos(angle),
      },
    ],
    launched: true,
  };
}

/* ── Tick (one fixed-timestep update) ── */

export type TickResult = {
  world: World;
  /** True when the last remaining ball fell past the paddle this tick. */
  ballLost: boolean;
  /** True when the ball reached the top this tick (level clear). */
  levelCleared: boolean;
  /** Bricks destroyed this tick (for visual fragment effects). */
  destroyedBricks: Brick[];
};

export function tick(world: World, paddleX: number, dp: DifficultyParams = DEFAULT_DIFFICULTY): TickResult {
  const timed = decayTimedEffects(world);
  let activeEffects: World["activeEffects"] = {
    clonePaddle: world.activeEffects.clonePaddle,
    timed,
  };
  const pw = activeEffects.timed.widePaddleMs > 0
    ? Math.round(dp.paddleW * WIDE_PADDLE_MUL)
    : dp.paddleW;
  const px = clampPaddleX(paddleX, pw);

  if (!world.launched) {
    // Ball sitting on paddle — just track paddle position.
    const parked = world.balls[0] ?? createParkedBall(world.nextBallId, px, pw);
    const nextId = world.balls[0] ? world.nextBallId : world.nextBallId + 1;
    return {
      world: {
        ...world,
        activeEffects,
        nextBallId: nextId,
        paddle: { x: px },
        balls: [
          {
            ...parked,
            x: px + pw / 2 - BALL_SIZE / 2,
            y: PADDLE_Y - BALL_SIZE,
            vx: 0,
            vy: 0,
          },
        ],
      },
      ballLost: false,
      levelCleared: false,
      destroyedBricks: [],
    };
  }

  let { score } = world;
  let nextBallId = world.nextBallId;
  const bricks = world.bricks.map((b) => ({ ...b }));
  const nextBalls: Ball[] = [];
  const spawnedBalls: Ball[] = [];
  const destroyed: Brick[] = [];
  const cloneY = clonePaddleY();

  for (const originalBall of world.balls) {
    let ball = withTargetSpeed(originalBall, world.level, dp);
    let { x, y, vx, vy } = ball;

    // Move ball.
    x += vx;
    y += vy;

    // ── Wall collisions ──

    if (x <= 0) {
      x = 0;
      vx = Math.abs(vx);
    }
    if (x + BALL_SIZE >= BOARD_W) {
      x = BOARD_W - BALL_SIZE;
      vx = -Math.abs(vx);
    }
    if (y <= 0) {
      return {
        world: {
          ...world,
          activeEffects,
          nextBallId,
          paddle: { x: px },
          bricks,
          score,
          balls: [...nextBalls, { ...ball, x, y: 0, vx, vy: Math.abs(vy) }],
        },
        ballLost: false,
        levelCleared: true,
        destroyedBricks: destroyed,
      };
    }

    // ── Paddle collision (clone first, then primary) ──

    const paddleYs = activeEffects.clonePaddle ? [cloneY, PADDLE_Y] : [PADDLE_Y];
    for (const py of paddleYs) {
      if (vy <= 0) continue;
      if (y + BALL_SIZE < py || y + BALL_SIZE > py + PADDLE_H || x + BALL_SIZE <= px || x >= px + pw) {
        continue;
      }
      const hitOffset = (x + BALL_SIZE / 2 - (px + pw / 2)) / (pw / 2);
      const clampedOffset = Math.max(-1, Math.min(1, hitOffset));
      const angle = clampedOffset * MAX_BOUNCE_ANGLE;
      const speed = targetBallSpeed(world.level, ball.speedEffect, dp);
      vx = speed * Math.sin(angle);
      vy = -speed * Math.cos(angle);
      y = py - BALL_SIZE;
      break;
    }

    // ── Brick collisions ──

    let spawnBall = false;

    for (const brick of bricks) {
      if (!brick.alive) continue;

      const br = brickRect(brick);

      // AABB overlap check.
      if (x + BALL_SIZE <= br.x || x >= br.x + br.w || y + BALL_SIZE <= br.y || y >= br.y + br.h) {
        continue;
      }

      brick.alive = false;
      destroyed.push(brick);

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

      const rowMeta = getBrickRowMeta(brick.row);
      switch (rowMeta.effect) {
        case "speedRed":
          ball = { ...ball, speedEffect: "red" };
          break;
        case "speedCyan":
          ball = { ...ball, speedEffect: "cyan" };
          break;
        case "speedPurple":
          ball = { ...ball, speedEffect: "purple" };
          break;
        case "spawnBall":
          spawnBall = true;
          break;
        case "clonePaddle":
          activeEffects = {
            ...activeEffects,
            clonePaddle: true,
          };
          break;
        case "widePaddleTimed":
          activeEffects = {
            ...activeEffects,
            timed: {
              ...activeEffects.timed,
              widePaddleMs: extendTimedEffectMs(activeEffects.timed.widePaddleMs),
            },
          };
          break;
        case "triplePointsTimed":
          activeEffects = {
            ...activeEffects,
            timed: {
              ...activeEffects.timed,
              triplePointsMs: extendTimedEffectMs(activeEffects.timed.triplePointsMs),
            },
          };
          break;
        case "none":
        default:
          break;
      }

      const pointsMul = activeEffects.timed.triplePointsMs > 0 ? TRIPLE_POINTS_MUL : 1;
      score += POINTS_PER_BRICK * pointsMul;

      // Only handle one brick collision per ball per tick to avoid double-reflect.
      break;
    }

    ball = withTargetSpeed(
      {
        ...ball,
        x,
        y,
        vx,
        vy,
      },
      world.level,
      dp,
    );
    x = ball.x;
    y = ball.y;
    vx = ball.vx;
    vy = ball.vy;

    if (spawnBall && world.balls.length + spawnedBalls.length < MAX_BALLS) {
      const splitSpeed = targetBallSpeed(world.level, ball.speedEffect, dp);
      const baseVx = Math.abs(vx) < 0.16 ? splitSpeed * 0.35 : -vx;
      const splitVel = normalizeVelocity(baseVx, vy, splitSpeed);
      spawnedBalls.push({
        id: nextBallId++,
        x,
        y,
        vx: splitVel.vx,
        vy: splitVel.vy,
        speedEffect: ball.speedEffect,
      });
    }

    if (y >= BOARD_H) {
      continue;
    }

    nextBalls.push({
      ...ball,
      x,
      y,
      vx,
      vy,
    });
  }

  const allBalls = [...nextBalls, ...spawnedBalls];
  const finalPaddleW = activeEffects.timed.widePaddleMs > 0
    ? Math.round(dp.paddleW * WIDE_PADDLE_MUL)
    : dp.paddleW;
  const finalPx = clampPaddleX(px, finalPaddleW);

  if (allBalls.length === 0) {
    const parkedBall = createParkedBall(nextBallId, finalPx, finalPaddleW);
    return {
      world: {
        ...world,
        activeEffects,
        nextBallId: nextBallId + 1,
        paddle: { x: finalPx },
        bricks,
        score,
        balls: [parkedBall],
        launched: false,
      },
      ballLost: true,
      levelCleared: false,
      destroyedBricks: destroyed,
    };
  }

  return {
    world: {
      ...world,
      activeEffects,
      nextBallId,
      paddle: { x: finalPx },
      bricks,
      score,
      balls: allBalls,
    },
    ballLost: false,
    levelCleared: false,
    destroyedBricks: destroyed,
  };
}

/* ── Utilities ── */

function clampPaddleX(x: number, paddleW: number = PADDLE_W): number {
  return Math.max(0, Math.min(BOARD_W - paddleW, x));
}

/** Count alive bricks in the world. */
export function aliveBrickCount(world: World): number {
  return world.bricks.filter((b) => b.alive).length;
}
