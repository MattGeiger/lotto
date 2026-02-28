/* ── Brick Mayhem – Fragment particle system ── */

import {
  BRICK_H,
  BRICK_TOP_OFFSET,
  BRICK_W,
  FRAGMENT_GRAVITY,
  FRAGMENT_INITIAL_VY,
  FRAGMENT_MAX_AGE,
  FRAGMENT_SPREAD_X,
} from "./constants";
import { ROW_COLORS } from "./effects";
import type { Brick } from "./types";

/** A single visual fragment — purely cosmetic, no gameplay collision. */
export type Fragment = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Width of this fragment piece. */
  w: number;
  /** Height of this fragment piece. */
  h: number;
  /** Fill colour (inherits from the brick's row). */
  color: string;
  /** Age in ticks — fragment is pruned when age >= FRAGMENT_MAX_AGE. */
  age: number;
};

/**
 * Spawn 4 quarter-sized fragments from a destroyed brick.
 * Each fragment gets a small outward velocity plus upward kick.
 */
export function spawnBrickFragments(brick: Brick): Fragment[] {
  const bx = brick.col * BRICK_W;
  const by = BRICK_TOP_OFFSET + brick.row * BRICK_H;
  const hw = BRICK_W / 2;  // half-width  = 8
  const hh = BRICK_H / 2;  // half-height = 4
  const color = ROW_COLORS[brick.row % ROW_COLORS.length]!;

  // Four corners: TL, TR, BL, BR.
  // Each gets a small horizontal spread outward from centre and a random upward pop.
  return [
    // Top-left
    {
      x: bx, y: by, vx: -FRAGMENT_SPREAD_X * (0.5 + Math.random() * 0.5),
      vy: FRAGMENT_INITIAL_VY * (0.7 + Math.random() * 0.3),
      w: hw, h: hh, color, age: 0,
    },
    // Top-right
    {
      x: bx + hw, y: by, vx: FRAGMENT_SPREAD_X * (0.5 + Math.random() * 0.5),
      vy: FRAGMENT_INITIAL_VY * (0.7 + Math.random() * 0.3),
      w: hw, h: hh, color, age: 0,
    },
    // Bottom-left
    {
      x: bx, y: by + hh, vx: -FRAGMENT_SPREAD_X * (0.5 + Math.random() * 0.5),
      vy: FRAGMENT_INITIAL_VY * (0.4 + Math.random() * 0.3),
      w: hw, h: hh, color, age: 0,
    },
    // Bottom-right
    {
      x: bx + hw, y: by + hh, vx: FRAGMENT_SPREAD_X * (0.5 + Math.random() * 0.5),
      vy: FRAGMENT_INITIAL_VY * (0.4 + Math.random() * 0.3),
      w: hw, h: hh, color, age: 0,
    },
  ];
}

/**
 * Advance all fragments by one tick: apply velocity, gravity, age.
 * Returns only the fragments that are still alive (age < max).
 */
export function tickFragments(fragments: Fragment[]): Fragment[] {
  const alive: Fragment[] = [];
  for (const f of fragments) {
    const age = f.age + 1;
    if (age >= FRAGMENT_MAX_AGE) continue;
    alive.push({
      ...f,
      x: f.x + f.vx,
      y: f.y + f.vy,
      vy: f.vy + FRAGMENT_GRAVITY,
      age,
    });
  }
  return alive;
}
