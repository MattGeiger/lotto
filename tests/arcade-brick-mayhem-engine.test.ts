import { describe, expect, it } from "vitest";

import { BOARD_H, BRICK_H, BRICK_TOP_OFFSET, POINTS_PER_BRICK, TIMED_EFFECT_MAX_MS, TRIPLE_POINTS_MUL } from "@/arcade/game/brick-mayhem/constants";
import { createWorld, DEFAULT_DIFFICULTY, targetBallSpeed, tick } from "@/arcade/game/brick-mayhem/engine";
import type { World } from "@/arcade/game/brick-mayhem/types";

function speedOf(world: World): number {
  const ball = world.balls[0]!;
  return Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
}

function worldForRow(row: number): World {
  const world = createWorld(0, 3, 0, DEFAULT_DIFFICULTY);
  return {
    ...world,
    launched: true,
    bricks: [{ col: 0, row, alive: true }],
    balls: [
      {
        id: 1,
        x: 1,
        y: BRICK_TOP_OFFSET + row * BRICK_H + 1,
        vx: 0.3,
        vy: 0.25,
        speedEffect: "normal",
      },
    ],
    nextBallId: 2,
  };
}

describe("Brick Mayhem engine effects", () => {
  it("applies speed effects from baseline without compounding on repeated same-color hits", () => {
    const first = tick(worldForRow(0), 0, DEFAULT_DIFFICULTY).world;
    expect(first.balls[0]?.speedEffect).toBe("red");

    const expectedRedSpeed = targetBallSpeed(0, "red", DEFAULT_DIFFICULTY);
    expect(speedOf(first)).toBeCloseTo(expectedRedSpeed, 6);

    const secondInput: World = {
      ...first,
      bricks: [{ col: 1, row: 8, alive: true }],
      balls: [
        {
          ...first.balls[0]!,
          x: 17,
          y: BRICK_TOP_OFFSET + 8 * BRICK_H + 1,
        },
      ],
    };
    const second = tick(secondInput, 0, DEFAULT_DIFFICULTY).world;

    expect(second.balls[0]?.speedEffect).toBe("red");
    expect(speedOf(second)).toBeCloseTo(expectedRedSpeed, 6);
  });

  it("spawns another ball on orange hit and only marks life loss when the last ball drops", () => {
    const spawned = tick(worldForRow(1), 0, DEFAULT_DIFFICULTY);
    expect(spawned.world.balls.length).toBe(2);

    const multiBallDropWorld: World = {
      ...spawned.world,
      launched: true,
      bricks: [],
      balls: [
        { ...spawned.world.balls[0]!, y: BOARD_H + 4, vy: 1 },
        { ...spawned.world.balls[1]!, x: 48, y: 32, vx: 0.2, vy: 0.3 },
      ],
    };
    const oneDropped = tick(multiBallDropWorld, 0, DEFAULT_DIFFICULTY);
    expect(oneDropped.ballLost).toBe(false);
    expect(oneDropped.world.balls.length).toBe(1);

    const lastBallDropWorld: World = {
      ...oneDropped.world,
      launched: true,
      balls: [{ ...oneDropped.world.balls[0]!, y: BOARD_H + 8, vy: 1 }],
    };
    const lastDropped = tick(lastBallDropWorld, 0, DEFAULT_DIFFICULTY);
    expect(lastDropped.ballLost).toBe(true);
    expect(lastDropped.world.launched).toBe(false);
    expect(lastDropped.world.balls.length).toBe(1);
  });

  it("activates and extends gold timed points buff with max cap", () => {
    const firstGold = tick(worldForRow(7), 0, DEFAULT_DIFFICULTY);
    expect(firstGold.world.score).toBe(POINTS_PER_BRICK * TRIPLE_POINTS_MUL);
    expect(firstGold.world.activeEffects.timed.triplePointsMs).toBeGreaterThan(0);

    const cappedInput: World = {
      ...firstGold.world,
      bricks: [{ col: 2, row: 7, alive: true }],
      balls: [
        {
          ...firstGold.world.balls[0]!,
          x: 33,
          y: BRICK_TOP_OFFSET + 7 * BRICK_H + 1,
        },
      ],
      activeEffects: {
        ...firstGold.world.activeEffects,
        timed: {
          ...firstGold.world.activeEffects.timed,
          triplePointsMs: TIMED_EFFECT_MAX_MS - 1,
        },
      },
    };
    const capped = tick(cappedInput, 0, DEFAULT_DIFFICULTY);
    expect(capped.world.activeEffects.timed.triplePointsMs).toBe(TIMED_EFFECT_MAX_MS);
  });

  it("enables clone paddle once and keeps it active through repeated green hits", () => {
    const firstGreen = tick(worldForRow(3), 0, DEFAULT_DIFFICULTY).world;
    expect(firstGreen.activeEffects.clonePaddle).toBe(true);

    const secondGreenInput: World = {
      ...firstGreen,
      bricks: [{ col: 1, row: 3, alive: true }],
      balls: [
        {
          ...firstGreen.balls[0]!,
          x: 17,
          y: BRICK_TOP_OFFSET + 3 * BRICK_H + 1,
        },
      ],
    };
    const secondGreen = tick(secondGreenInput, 0, DEFAULT_DIFFICULTY).world;
    expect(secondGreen.activeEffects.clonePaddle).toBe(true);
  });

  it("resets all brick effects when creating the next level world", () => {
    const withEffects: World = {
      ...createWorld(0, 3, 120, DEFAULT_DIFFICULTY),
      activeEffects: {
        clonePaddle: true,
        timed: {
          widePaddleMs: 12_000,
          triplePointsMs: 18_000,
        },
      },
      balls: [
        {
          id: 1,
          x: 20,
          y: 44,
          vx: 0.9,
          vy: -0.8,
          speedEffect: "purple",
        },
      ],
      launched: true,
    };

    const nextLevel = createWorld(withEffects.level + 1, withEffects.lives + 1, withEffects.score, DEFAULT_DIFFICULTY);
    expect(nextLevel.activeEffects.clonePaddle).toBe(false);
    expect(nextLevel.activeEffects.timed.widePaddleMs).toBe(0);
    expect(nextLevel.activeEffects.timed.triplePointsMs).toBe(0);
    expect(nextLevel.balls[0]?.speedEffect).toBe("normal");
  });
});
