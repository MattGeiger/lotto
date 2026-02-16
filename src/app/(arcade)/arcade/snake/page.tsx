"use client";

import * as React from "react";
import Link from "next/link";

import {
  ChevronArrowDownIcon,
  ChevronArrowLeftIcon,
  ChevronArrowRightIcon,
  ChevronArrowUpIcon,
} from "@/arcade/components/icons/chevron-arrow-left-icon";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/arcade/ui/8bit";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type GridPoint = { x: number; y: number };
type GameStatus = "READY" | "RUNNING" | "PAUSED" | "GAME_OVER";

const GRID_SIZE = 20;
const INITIAL_SNAKE_LENGTH = 3;
const TICK_INTERVAL_MS = 180;
const SCORE_PER_PELLET = 10;
const INITIAL_DIRECTION: Direction = "RIGHT";

const DIRECTION_VECTORS: Record<Direction, GridPoint> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT",
};

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
};

const isSamePoint = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y;

const createInitialSnake = (): GridPoint[] => {
  const midpoint = Math.floor(GRID_SIZE / 2);
  return Array.from({ length: INITIAL_SNAKE_LENGTH }, (_, index) => ({
    x: midpoint - index,
    y: midpoint,
  }));
};

const createInitialFoodPellet = (snakeBody: GridPoint[]): GridPoint => {
  const occupied = new Set(snakeBody.map((segment) => `${segment.x},${segment.y}`));
  for (let y = 1; y < GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < GRID_SIZE - 1; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        return { x, y };
      }
    }
  }

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: 0 };
};

const createFoodPellet = (snakeBody: GridPoint[]): GridPoint => {
  const occupied = new Set(snakeBody.map((segment) => `${segment.x},${segment.y}`));
  const totalCells = GRID_SIZE * GRID_SIZE;

  if (occupied.size >= totalCells) {
    return { x: 0, y: 0 };
  }

  for (let attempt = 0; attempt < totalCells * 2; attempt += 1) {
    const point: GridPoint = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
    if (!occupied.has(`${point.x},${point.y}`)) {
      return point;
    }
  }

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: 0 };
};

export default function SnakePage() {
  const [snake, setSnake] = React.useState<GridPoint[]>(() => createInitialSnake());
  const snakeRef = React.useRef<GridPoint[]>(snake);
  const [food, setFood] = React.useState<GridPoint>(() => createInitialFoodPellet(createInitialSnake()));
  const foodRef = React.useRef<GridPoint>(food);
  const [score, setScore] = React.useState(0);
  const directionRef = React.useRef<Direction>(INITIAL_DIRECTION);
  const queuedDirectionRef = React.useRef<Direction | null>(null);
  const [status, setStatus] = React.useState<GameStatus>("READY");
  const playAreaRef = React.useRef<HTMLElement>(null);

  const resetGame = React.useCallback((nextStatus: Exclude<GameStatus, "GAME_OVER">) => {
    const nextSnake = createInitialSnake();
    const nextFood = createFoodPellet(nextSnake);

    snakeRef.current = nextSnake;
    foodRef.current = nextFood;
    directionRef.current = INITIAL_DIRECTION;
    queuedDirectionRef.current = null;
    setSnake(nextSnake);
    setFood(nextFood);
    setScore(0);
    setStatus(nextStatus);
  }, []);

  const resetRun = React.useCallback(() => {
    resetGame("READY");
  }, [resetGame]);

  const restartRun = React.useCallback(() => {
    resetGame("RUNNING");
  }, [resetGame]);

  React.useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);

  React.useEffect(() => {
    foodRef.current = food;
  }, [food]);

  React.useEffect(() => {
    if (status !== "GAME_OVER") {
      return;
    }
    queuedDirectionRef.current = null;
  }, [status]);

  const handleDirection = React.useCallback(
    (nextDirection: Direction) => {
      if (status === "GAME_OVER" || status === "PAUSED") {
        return;
      }
      const activeDirection = queuedDirectionRef.current ?? directionRef.current;
      if (
        nextDirection === activeDirection ||
        OPPOSITE_DIRECTIONS[activeDirection] === nextDirection
      ) {
        return;
      }
      queuedDirectionRef.current = nextDirection;
      if (status === "READY") {
        setStatus("RUNNING");
      }
    },
    [status],
  );

  const focusPlayArea = React.useCallback(() => {
    const playArea = playAreaRef.current;
    if (!playArea) {
      return;
    }

    playArea.scrollIntoView({ behavior: "smooth", block: "start" });
    playArea.focus({ preventScroll: true });
  }, []);

  const handlePlayNow = React.useCallback(() => {
    if (status === "READY" || status === "PAUSED") {
      setStatus("RUNNING");
    } else if (status === "GAME_OVER") {
      restartRun();
    }
    focusPlayArea();
  }, [focusPlayArea, restartRun, status]);

  const handleCenterControl = React.useCallback(() => {
    if (status === "RUNNING") {
      queuedDirectionRef.current = null;
      setStatus("PAUSED");
      return;
    }
    if (status === "PAUSED") {
      setStatus("RUNNING");
      return;
    }
    if (status === "READY") {
      setStatus("RUNNING");
      focusPlayArea();
      return;
    }
    if (status === "GAME_OVER") {
      restartRun();
      focusPlayArea();
    }
  }, [focusPlayArea, restartRun, status]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) {
        return;
      }
      event.preventDefault();
      handleDirection(direction);
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleDirection]);

  React.useEffect(() => {
    if (status !== "RUNNING") {
      return;
    }

    const tickId = window.setInterval(() => {
      let nextDirection = directionRef.current;
      const queuedDirection = queuedDirectionRef.current;
      if (queuedDirection && OPPOSITE_DIRECTIONS[nextDirection] !== queuedDirection) {
        nextDirection = queuedDirection;
      }

      queuedDirectionRef.current = null;
      directionRef.current = nextDirection;

      const vector = DIRECTION_VECTORS[nextDirection];
      const currentSnake = snakeRef.current;
      const currentHead = currentSnake[0];
      const nextHead: GridPoint = {
        x: currentHead.x + vector.x,
        y: currentHead.y + vector.y,
      };
      const ateFood = isSamePoint(nextHead, foodRef.current);

      const hitWall =
        nextHead.x < 0 ||
        nextHead.x >= GRID_SIZE ||
        nextHead.y < 0 ||
        nextHead.y >= GRID_SIZE;
      const bodyToCheck = ateFood ? currentSnake : currentSnake.slice(0, currentSnake.length - 1);
      const hitBody = bodyToCheck.some(
        (segment) => segment.x === nextHead.x && segment.y === nextHead.y,
      );

      if (hitWall || hitBody) {
        setStatus("GAME_OVER");
        return;
      }

      const nextSnake = ateFood
        ? [nextHead, ...currentSnake]
        : [nextHead, ...currentSnake].slice(0, currentSnake.length);
      snakeRef.current = nextSnake;
      setSnake(nextSnake);

      if (ateFood) {
        const nextFood = createFoodPellet(nextSnake);
        foodRef.current = nextFood;
        setFood(nextFood);
        setScore((previousScore) => previousScore + SCORE_PER_PELLET);
      }
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(tickId);
    };
  }, [status]);

  const centerControlLabel =
    status === "RUNNING" ? "PAUSE" : status === "PAUSED" ? "PLAY" : "START";
  const centerControlAriaLabel =
    status === "RUNNING" ? "Pause game" : status === "PAUSED" ? "Resume game" : "Start game";

  return (
    <div className="arcade-pixel-grid arcade-snake-shell mx-auto max-w-6xl px-4 pb-6 pt-8 sm:px-6 sm:pt-10">
      <div className="mb-4 flex justify-start">
        <Button asChild size="sm" className="px-3">
          <Link href="/arcade" className="inline-flex items-center gap-2">
            <ChevronArrowLeftIcon className="pixelated inline-block h-3.5 w-auto shrink-0" />
            <span>BACK</span>
          </Link>
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl text-[var(--arcade-dot)] sm:text-2xl">
            Snake
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="arcade-ui list-none space-y-2 text-xs text-[var(--arcade-text)]/90 sm:text-sm">
            <li>* USE ARROWS TO MOVE</li>
            <li>* EAT PELLETS FOR POINTS</li>
            <li>* EATING MAKES YOU GROW</li>
            <li>* AVOID WALLS AND YOUR BODY</li>
            <li>* CRASHING ENDS THE GAME</li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button type="button" size="lg" className="min-w-44" onClick={handlePlayNow}>
          PLAY NOW
        </Button>
        {status === "GAME_OVER" ? (
          <Button type="button" variant="outline" className="min-w-36" onClick={resetRun}>
            RESET
          </Button>
        ) : null}
      </div>

      {status === "GAME_OVER" ? (
        <div className="mt-3 flex justify-center">
          <p className="arcade-retro arcade-snake-alert text-[10px] text-[var(--arcade-neon)] sm:text-xs">
            GAME OVER: COLLISION DETECTED
          </p>
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {status === "GAME_OVER" ? "Game over." : null}
      </div>

      <section
        ref={playAreaRef}
        className="arcade-snake-stage mt-6"
        tabIndex={-1}
        aria-label="Snake play area"
      >
        <div className="arcade-snake-readout arcade-snake-readout-metrics arcade-ui">
          <p className="text-[9px] text-[var(--arcade-dot)]">SCORE: {score}</p>
          <p className="text-[9px] text-[var(--arcade-dot)]">LENGTH: {snake.length}</p>
        </div>

        <div
          className="arcade-snake-board pixelated"
          role="img"
          aria-label="Snake board movement demo"
          onClick={status === "GAME_OVER" ? restartRun : undefined}
        >
          <div className="arcade-snake-track" aria-hidden="true">
            <div
              className="arcade-snake-pellet"
              style={{
                left: `${(food.x / GRID_SIZE) * 100}%`,
                top: `${(food.y / GRID_SIZE) * 100}%`,
              }}
            />
            {snake.map((segment, index) => (
              <div
                key={`${segment.x}-${segment.y}-${index}`}
                className={
                  index === 0
                    ? "arcade-snake-segment arcade-snake-segment-head"
                    : "arcade-snake-segment"
                }
                style={{
                  left: `${(segment.x / GRID_SIZE) * 100}%`,
                  top: `${(segment.y / GRID_SIZE) * 100}%`,
                }}
              />
            ))}
          </div>
          {status === "GAME_OVER" ? (
            <div className="arcade-snake-overlay">
              <p className="arcade-retro text-2xl text-[var(--arcade-neon)] sm:text-4xl">GAME OVER</p>
              <p className="arcade-ui text-lg text-[var(--arcade-dot)] sm:text-2xl">
                TAP HERE TO PLAY AGAIN
              </p>
            </div>
          ) : null}
        </div>

      </section>

      <section className="arcade-snake-control-dock" aria-label="On-screen movement controls">
        <div className="arcade-snake-pad">
          <span aria-hidden="true" />
          <Button
            type="button"
            variant="outline"
            className="arcade-snake-control-btn"
            aria-label="Move up"
            onClick={() => handleDirection("UP")}
          >
            <ChevronArrowUpIcon className="h-4 w-auto text-[var(--arcade-dot)] sm:h-5" />
          </Button>
          <span aria-hidden="true" />

          <Button
            type="button"
            variant="outline"
            className="arcade-snake-control-btn"
            aria-label="Move left"
            onClick={() => handleDirection("LEFT")}
          >
            <ChevronArrowLeftIcon className="h-5 w-auto text-[var(--arcade-dot)]" />
          </Button>
          <Button
            type="button"
            variant="default"
            className="arcade-snake-control-btn arcade-ui text-[9px]"
            aria-label={centerControlAriaLabel}
            onClick={handleCenterControl}
          >
            {centerControlLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="arcade-snake-control-btn"
            aria-label="Move right"
            onClick={() => handleDirection("RIGHT")}
          >
            <ChevronArrowRightIcon className="h-5 w-auto text-[var(--arcade-dot)]" />
          </Button>

          <span aria-hidden="true" />
          <Button
            type="button"
            variant="outline"
            className="arcade-snake-control-btn"
            aria-label="Move down"
            onClick={() => handleDirection("DOWN")}
          >
            <ChevronArrowDownIcon className="h-4 w-auto text-[var(--arcade-dot)] sm:h-5" />
          </Button>
          <span aria-hidden="true" />
        </div>
      </section>
    </div>
  );
}
