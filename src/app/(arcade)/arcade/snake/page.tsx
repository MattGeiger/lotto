"use client";

import * as React from "react";
import Link from "next/link";

import { ARCADE_TICKET_CALLED_EVENT } from "@/arcade/lib/events";
import {
  ChevronArrowDownIcon,
  ChevronArrowLeftIcon,
  ChevronArrowRightIcon,
  ChevronArrowUpIcon,
} from "@/arcade/components/icons/chevron-arrow-left-icon";
import { Button, Card, CardContent, CardHeader, CardTitle, Slider } from "@/arcade/ui/8bit";
import { useLanguage } from "@/contexts/language-context";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type GridPoint = { x: number; y: number };
type GameStatus = "READY" | "RUNNING" | "PAUSED" | "GAME_OVER";
type SnakeModePreset = {
  key: "veryEasy" | "easy" | "normal" | "hard" | "veryHard" | "nightmare";
  labelKey:
    | "snakeModeVeryEasy"
    | "snakeModeEasy"
    | "snakeModeNormal"
    | "snakeModeHard"
    | "snakeModeVeryHard"
    | "snakeModeNightmare";
  tickIntervalMs: number;
  minWallDistance: number;
  pelletLifetimeMs: number | null;
};

const GRID_SIZE = 20;
const INITIAL_SNAKE_LENGTH = 3;
const TICK_INTERVAL_MS = 180;
const FAST_TICK_INTERVAL_MS = Math.max(60, Math.floor(TICK_INTERVAL_MS / 2));
const SLOW_TICK_INTERVAL_MS = TICK_INTERVAL_MS * 2;
const NIGHTMARE_PELLET_LIFETIME_MS = 5_000;
const SCORE_PER_PELLET = 10;
const INITIAL_DIRECTION: Direction = "RIGHT";
const SNAKE_MODE_PRESETS: readonly SnakeModePreset[] = [
  {
    key: "veryEasy",
    labelKey: "snakeModeVeryEasy",
    tickIntervalMs: SLOW_TICK_INTERVAL_MS,
    minWallDistance: 5,
    pelletLifetimeMs: null,
  },
  {
    key: "easy",
    labelKey: "snakeModeEasy",
    tickIntervalMs: SLOW_TICK_INTERVAL_MS,
    minWallDistance: 3,
    pelletLifetimeMs: null,
  },
  {
    key: "normal",
    labelKey: "snakeModeNormal",
    tickIntervalMs: TICK_INTERVAL_MS,
    minWallDistance: 3,
    pelletLifetimeMs: null,
  },
  {
    key: "hard",
    labelKey: "snakeModeHard",
    tickIntervalMs: TICK_INTERVAL_MS,
    minWallDistance: 0,
    pelletLifetimeMs: null,
  },
  {
    key: "veryHard",
    labelKey: "snakeModeVeryHard",
    tickIntervalMs: FAST_TICK_INTERVAL_MS,
    minWallDistance: 0,
    pelletLifetimeMs: null,
  },
  {
    key: "nightmare",
    labelKey: "snakeModeNightmare",
    tickIntervalMs: FAST_TICK_INTERVAL_MS,
    minWallDistance: 0,
    pelletLifetimeMs: NIGHTMARE_PELLET_LIFETIME_MS,
  },
];
const DEFAULT_MODE_INDEX = 2;

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
const pointKey = (point: GridPoint): string => `${point.x},${point.y}`;
const clampPresetIndex = (value: number, maxIndex: number): number =>
  Math.max(0, Math.min(maxIndex, Math.round(value)));

const isInsideWallDistanceGate = (point: GridPoint, minWallDistance: number): boolean => {
  if (minWallDistance <= 0) {
    return true;
  }

  const min = minWallDistance;
  const max = GRID_SIZE - 1 - minWallDistance;
  return point.x >= min && point.x <= max && point.y >= min && point.y <= max;
};

const createInitialSnake = (): GridPoint[] => {
  const midpoint = Math.floor(GRID_SIZE / 2);
  return Array.from({ length: INITIAL_SNAKE_LENGTH }, (_, index) => ({
    x: midpoint - index,
    y: midpoint,
  }));
};

const collectSpawnCandidates = (
  snakeBody: GridPoint[],
  minWallDistance: number,
): { gated: GridPoint[]; fallback: GridPoint[] } => {
  const occupied = new Set(snakeBody.map((segment) => pointKey(segment)));
  const gated: GridPoint[] = [];
  const fallback: GridPoint[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const point = { x, y };
      if (occupied.has(pointKey(point))) {
        continue;
      }

      fallback.push(point);
      if (isInsideWallDistanceGate(point, minWallDistance)) {
        gated.push(point);
      }
    }
  }

  return { gated, fallback };
};

const createInitialFoodPellet = (
  snakeBody: GridPoint[],
  minWallDistance: number,
): GridPoint => {
  const { gated, fallback } = collectSpawnCandidates(snakeBody, minWallDistance);
  return gated[0] ?? fallback[0] ?? { x: 0, y: 0 };
};

const createFoodPellet = (
  snakeBody: GridPoint[],
  minWallDistance: number,
  avoidPoint?: GridPoint,
): GridPoint => {
  const { gated, fallback } = collectSpawnCandidates(snakeBody, minWallDistance);
  if (fallback.length === 0) {
    return { x: 0, y: 0 };
  }

  const pool = gated.length > 0 ? gated : fallback;
  const respawnPool =
    avoidPoint && pool.length > 1
      ? pool.filter((point) => !isSamePoint(point, avoidPoint))
      : pool;
  const finalPool = respawnPool.length > 0 ? respawnPool : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)] ?? fallback[0] ?? { x: 0, y: 0 };
};

export default function SnakePage() {
  const { t } = useLanguage();
  const [snake, setSnake] = React.useState<GridPoint[]>(() => createInitialSnake());
  const snakeRef = React.useRef<GridPoint[]>(snake);
  const [food, setFood] = React.useState<GridPoint>(() =>
    createInitialFoodPellet(
      createInitialSnake(),
      SNAKE_MODE_PRESETS[DEFAULT_MODE_INDEX].minWallDistance,
    ),
  );
  const foodRef = React.useRef<GridPoint>(food);
  const [score, setScore] = React.useState(0);
  const directionRef = React.useRef<Direction>(INITIAL_DIRECTION);
  const queuedDirectionRef = React.useRef<Direction | null>(null);
  const [status, setStatus] = React.useState<GameStatus>("READY");
  const [modeIndex, setModeIndex] = React.useState(DEFAULT_MODE_INDEX);
  const playAreaRef = React.useRef<HTMLElement>(null);
  const modePreset = SNAKE_MODE_PRESETS[modeIndex] ?? SNAKE_MODE_PRESETS[DEFAULT_MODE_INDEX];

  const resetGame = React.useCallback((nextStatus: Exclude<GameStatus, "GAME_OVER">) => {
    const nextSnake = createInitialSnake();
    const nextFood = createFoodPellet(nextSnake, modePreset.minWallDistance);

    snakeRef.current = nextSnake;
    foodRef.current = nextFood;
    directionRef.current = INITIAL_DIRECTION;
    queuedDirectionRef.current = null;
    setSnake(nextSnake);
    setFood(nextFood);
    setScore(0);
    setStatus(nextStatus);
  }, [modePreset.minWallDistance]);

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
    if (isInsideWallDistanceGate(foodRef.current, modePreset.minWallDistance)) {
      return;
    }

    const nextFood = createFoodPellet(snakeRef.current, modePreset.minWallDistance);
    foodRef.current = nextFood;
    setFood(nextFood);
  }, [modePreset.minWallDistance]);

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

  const handleModeChange = React.useCallback((values: number[]) => {
    const nextValue = values[0];
    if (typeof nextValue !== "number") {
      return;
    }

    const nextIndex = clampPresetIndex(nextValue, SNAKE_MODE_PRESETS.length - 1);
    setModeIndex(nextIndex);
  }, []);

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
    const onTicketCalled = () => {
      queuedDirectionRef.current = null;
      setStatus((currentStatus) =>
        currentStatus === "RUNNING" ? "PAUSED" : currentStatus,
      );
    };

    window.addEventListener(ARCADE_TICKET_CALLED_EVENT, onTicketCalled as EventListener);
    return () => {
      window.removeEventListener(ARCADE_TICKET_CALLED_EVENT, onTicketCalled as EventListener);
    };
  }, []);

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
        const nextFood = createFoodPellet(nextSnake, modePreset.minWallDistance);
        foodRef.current = nextFood;
        setFood(nextFood);
        setScore((previousScore) => previousScore + SCORE_PER_PELLET);
      }
    }, modePreset.tickIntervalMs);

    return () => {
      window.clearInterval(tickId);
    };
  }, [modePreset.minWallDistance, modePreset.tickIntervalMs, status]);

  React.useEffect(() => {
    if (status !== "RUNNING" || modePreset.pelletLifetimeMs == null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextFood = createFoodPellet(
        snakeRef.current,
        modePreset.minWallDistance,
        foodRef.current,
      );
      foodRef.current = nextFood;
      setFood(nextFood);
    }, modePreset.pelletLifetimeMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [food, modePreset.minWallDistance, modePreset.pelletLifetimeMs, status]);

  const centerControlLabel =
    status === "RUNNING" ? t("pause") : status === "PAUSED" ? t("play") : t("start");
  const centerControlAriaLabel =
    status === "RUNNING" ? "Pause game" : status === "PAUSED" ? "Resume game" : "Start game";

  return (
    <div className="arcade-pixel-grid arcade-snake-shell mx-auto max-w-6xl px-4 pb-6 pt-8 sm:px-6 sm:pt-10">
      <div className="mb-4 flex justify-start">
        <Button asChild size="sm" className="px-3">
          <Link href="/arcade" className="inline-flex items-center gap-2">
            <ChevronArrowLeftIcon className="pixelated inline-block h-3.5 w-auto shrink-0" />
            <span>{t("back")}</span>
          </Link>
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-4xl text-[var(--arcade-dot)] sm:text-5xl">
            {t("snakeTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="arcade-ui list-none space-y-2 text-lg text-[var(--arcade-text)]/90 sm:text-xl">
            <li>* {t("snakeInstructionMove")}</li>
            <li>* {t("snakeInstructionPoints")}</li>
            <li>* {t("snakeInstructionGrow")}</li>
            <li>* {t("snakeInstructionAvoid")}</li>
            <li>* {t("snakeInstructionCrash")}</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mx-auto mt-4 w-full max-w-3xl">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-2xl text-[var(--arcade-dot)] sm:text-3xl">
            DIFFICULTY SETTING
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="arcade-snake-settings arcade-ui">
            <div className="arcade-snake-slider-group">
              <p className="arcade-snake-slider-title text-[11px] text-[var(--arcade-dot)]">
                {t("snakeSettingLabel")}: {t(modePreset.labelKey)}
              </p>
              <Slider
                className="arcade-snake-slider"
                min={0}
                max={SNAKE_MODE_PRESETS.length - 1}
                step={1}
                value={[modeIndex]}
                onValueChange={handleModeChange}
                aria-label={t("snakeSettingLabel")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button type="button" size="lg" className="min-w-44" onClick={handlePlayNow}>
          {t("playNow")}
        </Button>
        {status === "GAME_OVER" ? (
          <Button type="button" variant="outline" className="min-w-36" onClick={resetRun}>
            {t("reset")}
          </Button>
        ) : null}
      </div>

      {status === "GAME_OVER" ? (
        <div className="mt-3 flex justify-center">
          <p className="arcade-retro arcade-snake-alert text-base text-[var(--arcade-neon)] sm:text-lg">
            {t("gameOverCollision")}
          </p>
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {status === "GAME_OVER" ? t("gameOverAnnouncement") : null}
      </div>

      <section
        ref={playAreaRef}
        className="arcade-snake-stage mt-6"
        tabIndex={-1}
        aria-label="Snake play area"
      >
        <div className="arcade-snake-readout arcade-snake-readout-metrics arcade-ui">
          <p className="text-[13px] text-[var(--arcade-dot)]">{t("score")}: {score}</p>
          <p className="text-[13px] text-[var(--arcade-dot)]">{t("length")}: {snake.length}</p>
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
              <p className="arcade-retro text-5xl text-[var(--arcade-neon)] sm:text-7xl">{t("gameOver")}</p>
              <p className="arcade-ui text-3xl text-[var(--arcade-dot)] sm:text-5xl">
                {t("tapToPlayAgain")}
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
            className="arcade-snake-control-btn arcade-ui text-[13px]"
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
