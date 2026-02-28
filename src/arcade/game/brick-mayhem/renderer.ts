/* ── Brick Mayhem – Canvas renderer ── */

import {
  BALL_SIZE,
  BOARD_H,
  BOARD_W,
  BRICK_H,
  BRICK_TOP_OFFSET,
  BRICK_W,
  FRAGMENT_MAX_AGE,
  PADDLE_H,
  PADDLE_Y,
  PADDLE_W,
} from "./constants";
import { clonePaddleY, effectivePaddleWidth } from "./engine";
import { ROW_COLORS } from "./effects";
import type { Fragment } from "./particles";
import type { DifficultyParams, World } from "./types";

/**
 * Draw the entire board in a single pass.
 *
 * Reads CSS custom properties from the canvas element so colours follow
 * the current arcade theme (light/dark mode).
 */
export function drawBoard(
  ctx: CanvasRenderingContext2D,
  world: World,
  canvas: HTMLCanvasElement,
  dp?: DifficultyParams,
  fragments?: Fragment[],
): void {
  const pw = dp ? effectivePaddleWidth(world, dp) : PADDLE_W;
  const styles = getComputedStyle(canvas);

  // Resolve theme colours.
  const wallColor = styles.getPropertyValue("--arcade-wall").trim() || "#3b7cff";
  const paddleColor = styles.getPropertyValue("--arcade-dot").trim() || "#ffd75c";
  const ballColor = styles.getPropertyValue("--arcade-brick-ball").trim() || "#ffffff";

  // Clear.
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);

  // ── Bricks ──
  for (const brick of world.bricks) {
    if (!brick.alive) continue;

    const bx = brick.col * BRICK_W;
    const by = BRICK_TOP_OFFSET + brick.row * BRICK_H;
    const color = ROW_COLORS[brick.row % ROW_COLORS.length]!;

    ctx.fillStyle = color;
    ctx.fillRect(bx, by, BRICK_W, BRICK_H);

    // 1px dark inset border to separate bricks.
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, BRICK_W - 1, BRICK_H - 1);
  }

  // ── Fragments (brick shatter particles) ──
  if (fragments && fragments.length > 0) {
    for (const f of fragments) {
      // Fade out linearly over the fragment's lifetime.
      ctx.globalAlpha = Math.max(0, 1 - f.age / FRAGMENT_MAX_AGE);
      ctx.fillStyle = f.color;
      ctx.fillRect(Math.round(f.x), Math.round(f.y), f.w, f.h);
    }
    ctx.globalAlpha = 1;
  }

  // ── Paddle ──
  // Round to integer pixels so the CSS-scaled canvas stays crisp (no sub-pixel anti-aliasing).
  ctx.fillStyle = paddleColor;
  ctx.fillRect(Math.round(world.paddle.x), PADDLE_Y, pw, PADDLE_H);

  if (world.activeEffects.clonePaddle) {
    ctx.globalAlpha = 0.72;
    ctx.fillRect(Math.round(world.paddle.x), clonePaddleY(), pw, PADDLE_H);
    ctx.globalAlpha = 1;
  }

  // ── Balls ──
  ctx.fillStyle = ballColor;
  for (const ball of world.balls) {
    ctx.fillRect(Math.round(ball.x), Math.round(ball.y), BALL_SIZE, BALL_SIZE);
  }

  // ── Side walls — subtle vertical lines ──
  ctx.strokeStyle = wallColor;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  // Left wall.
  ctx.beginPath();
  ctx.moveTo(0.5, 0);
  ctx.lineTo(0.5, BOARD_H);
  ctx.stroke();
  // Right wall.
  ctx.beginPath();
  ctx.moveTo(BOARD_W - 0.5, 0);
  ctx.lineTo(BOARD_W - 0.5, BOARD_H);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
