/* ── Brick Mayhem – Canvas renderer ── */

import {
  BALL_SIZE,
  BOARD_H,
  BOARD_W,
  BRICK_H,
  BRICK_TOP_OFFSET,
  BRICK_W,
  PADDLE_H,
  PADDLE_Y,
  PADDLE_W,
} from "./constants";
import type { World } from "./types";

/** Row hue palette — each row of bricks gets a distinct colour. */
const ROW_COLORS = [
  "#ff4d6a", // red-pink
  "#ff6b3d", // orange
  "#ffc63b", // yellow-gold
  "#74f84a", // green
  "#3bdfff", // cyan
  "#a87bff", // purple
  "#ff6de8", // pink
  "#ffd75c", // gold
];

/**
 * Draw the entire board in a single pass.
 *
 * Reads CSS custom properties from the canvas element so colours follow
 * the current arcade theme (light/dark mode).
 */
export function drawBoard(ctx: CanvasRenderingContext2D, world: World, canvas: HTMLCanvasElement): void {
  const styles = getComputedStyle(canvas);

  // Resolve theme colours.
  const wallColor = styles.getPropertyValue("--arcade-wall").trim() || "#3b7cff";
  const paddleColor = styles.getPropertyValue("--arcade-dot").trim() || "#ffd75c";
  const ballColor = styles.getPropertyValue("--arcade-ghost").trim() || "#86f0ff";

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

  // ── Paddle ──
  ctx.fillStyle = paddleColor;
  ctx.fillRect(world.paddle.x, PADDLE_Y, PADDLE_W, PADDLE_H);

  // ── Ball ──
  ctx.fillStyle = ballColor;
  ctx.fillRect(world.ball.x, world.ball.y, BALL_SIZE, BALL_SIZE);

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
