/* ── Brick Mayhem – Row palette + row-hit effects ── */

export type BrickRowEffect =
  | "speedRed"
  | "spawnBall"
  | "none"
  | "clonePaddle"
  | "speedCyan"
  | "speedPurple"
  | "widePaddleTimed"
  | "triplePointsTimed";

export type BrickRowMeta = {
  color: string;
  effect: BrickRowEffect;
};

/**
 * The 8-row palette cycles by row index:
 * ROW_COLORS[row % ROW_COLORS.length].
 */
export const BRICK_ROW_META: readonly BrickRowMeta[] = [
  { color: "#ff4d6a", effect: "speedRed" },        // red-pink
  { color: "#ff6b3d", effect: "spawnBall" },       // orange
  { color: "#ffc63b", effect: "none" },            // yellow-gold
  { color: "#74f84a", effect: "clonePaddle" },     // green
  { color: "#3bdfff", effect: "speedCyan" },       // cyan
  { color: "#a87bff", effect: "speedPurple" },     // purple
  { color: "#ff6de8", effect: "widePaddleTimed" }, // pink
  { color: "#ffd75c", effect: "triplePointsTimed" }, // gold
];

export const ROW_COLORS = BRICK_ROW_META.map((entry) => entry.color);

export function getBrickRowMeta(row: number): BrickRowMeta {
  return BRICK_ROW_META[row % BRICK_ROW_META.length]!;
}
