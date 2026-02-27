"use client";

import * as React from "react";
import Link from "next/link";

import { ARCADE_PLAY_RESUMED_EVENT, ARCADE_TICKET_CALLED_EVENT } from "@/arcade/lib/events";
import {
  BALL_SIZE,
  BOARD_H,
  BOARD_W,
  FIXED_STEP_MS,
  KEYBOARD_PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
} from "@/arcade/game/brick-mayhem/constants";
import {
  createWorld,
  initialWorld,
  launchBall,
  tick,
} from "@/arcade/game/brick-mayhem/engine";
import { drawBoard } from "@/arcade/game/brick-mayhem/renderer";
import type { World } from "@/arcade/game/brick-mayhem/types";
import { ChevronArrowLeftIcon } from "@/arcade/components/icons/chevron-arrow-left-icon";
import { Button, Card, CardContent, CardHeader, CardTitle, Slider } from "@/arcade/ui/8bit";
import { useLanguage } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

type GameStatus = "READY" | "RUNNING" | "PAUSED" | "GAME_OVER";

export default function BrickMayhemPage() {
  const { t, language } = useLanguage();
  const isLargeTextLocale = language === "ar" || language === "fa" || language === "zh";

  /* ── React-rendered state ── */
  const [status, setStatus] = React.useState<GameStatus>("READY");
  const [score, setScore] = React.useState(0);
  const [lives, setLives] = React.useState(3);
  const [level, setLevel] = React.useState(0);
  const [sliderValue, setSliderValue] = React.useState(50);

  /* ── Refs for live game state (updated synchronously between frames) ── */
  const worldRef = React.useRef<World>(initialWorld());
  const statusRef = React.useRef<GameStatus>("READY");
  const paddleTargetRef = React.useRef<number>((BOARD_W - PADDLE_W) / 2);
  const keysDownRef = React.useRef<Set<string>>(new Set());
  const rafIdRef = React.useRef<number>(0);
  const accumulatorRef = React.useRef(0);
  const lastTimeRef = React.useRef(0);

  const boardCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const playAreaRef = React.useRef<HTMLElement>(null);

  /* ── Keep statusRef in sync ── */
  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /* ── Sync React state from world ── */
  const syncReactState = React.useCallback((w: World) => {
    setScore(w.score);
    setLives(w.lives);
    setLevel(w.level);
  }, []);

  /* ── Event helpers ── */

  const notifyPlayResumed = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent(ARCADE_PLAY_RESUMED_EVENT));
  }, []);

  const focusPlayArea = React.useCallback(() => {
    const playArea = playAreaRef.current;
    if (!playArea) return;
    playArea.scrollIntoView({ behavior: "smooth", block: "start" });
    playArea.focus({ preventScroll: true });
  }, []);

  /* ── Reset / restart helpers ── */

  const resetGame = React.useCallback(() => {
    const w = initialWorld();
    worldRef.current = w;
    paddleTargetRef.current = w.paddle.x;
    accumulatorRef.current = 0;
    lastTimeRef.current = 0;
    syncReactState(w);
    setSliderValue(50);
    setStatus("READY");
  }, [syncReactState]);

  const restartRun = React.useCallback(() => {
    resetGame();
    // Let resetGame set READY first, then start on next tick.
    setTimeout(() => {
      setStatus("RUNNING");
      notifyPlayResumed();
    }, 0);
  }, [resetGame, notifyPlayResumed]);

  /* ── Drawing ── */

  const draw = React.useCallback(() => {
    const canvas = boardCanvasRef.current;
    if (!canvas) return;

    // Skip in jsdom test environments.
    if (typeof navigator !== "undefined" && /\bjsdom\b/i.test(navigator.userAgent)) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== BOARD_W || canvas.height !== BOARD_H) {
      canvas.width = BOARD_W;
      canvas.height = BOARD_H;
    }

    drawBoard(ctx, worldRef.current, canvas);
  }, []);

  /* ── Initial draw + redraw on theme/resize ── */

  React.useEffect(() => {
    draw();
  }, [draw]);

  React.useEffect(() => {
    const handleRedraw = () => draw();
    const rootObserver = new MutationObserver(handleRedraw);
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    window.addEventListener("resize", handleRedraw);
    return () => {
      rootObserver.disconnect();
      window.removeEventListener("resize", handleRedraw);
    };
  }, [draw]);

  /* ── Game loop (requestAnimationFrame + fixed timestep) ── */

  React.useEffect(() => {
    if (status !== "RUNNING") {
      // When not running, cancel any pending frame and reset timing.
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      lastTimeRef.current = 0;
      accumulatorRef.current = 0;
      return;
    }

    // Launch ball if not yet launched when entering RUNNING.
    if (!worldRef.current.launched) {
      worldRef.current = launchBall(worldRef.current);
    }

    const loop = (timestamp: number) => {
      if (statusRef.current !== "RUNNING") return;

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        rafIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      accumulatorRef.current += delta;

      // Apply keyboard input to paddle target.
      const keys = keysDownRef.current;
      const hasKeyInput = keys.has("ArrowLeft") || keys.has("Left") || keys.has("ArrowRight") || keys.has("Right");
      if (keys.has("ArrowLeft") || keys.has("Left")) {
        paddleTargetRef.current = Math.max(0, paddleTargetRef.current - KEYBOARD_PADDLE_SPEED);
      }
      if (keys.has("ArrowRight") || keys.has("Right")) {
        paddleTargetRef.current = Math.min(
          BOARD_W - PADDLE_W,
          paddleTargetRef.current + KEYBOARD_PADDLE_SPEED,
        );
      }
      // Sync slider visual position when keyboard moves the paddle.
      if (hasKeyInput) {
        setSliderValue(Math.round((paddleTargetRef.current / (BOARD_W - PADDLE_W)) * 100));
      }

      while (accumulatorRef.current >= FIXED_STEP_MS) {
        const result = tick(worldRef.current, paddleTargetRef.current);
        worldRef.current = result.world;
        accumulatorRef.current -= FIXED_STEP_MS;

        if (result.levelCleared) {
          // Award bonus life, advance level.
          const nextLevel = worldRef.current.level + 1;
          const nextLives = worldRef.current.lives + 1;
          const w = createWorld(nextLevel, nextLives, worldRef.current.score);
          worldRef.current = w;
          paddleTargetRef.current = w.paddle.x;
          accumulatorRef.current = 0;
          syncReactState(w);
          setStatus("READY");
          draw();
          return;
        }

        if (result.ballLost) {
          const w = worldRef.current;
          const remainingLives = w.lives - 1;
          if (remainingLives <= 0) {
            worldRef.current = { ...w, lives: 0 };
            syncReactState({ ...w, lives: 0 });
            setStatus("GAME_OVER");
            draw();
            return;
          }
          // Reset ball onto paddle, keep bricks and score.
          const resetW: World = {
            ...w,
            lives: remainingLives,
            launched: false,
            ball: {
              x: w.paddle.x + PADDLE_W / 2 - BALL_SIZE / 2,
              y: PADDLE_Y - BALL_SIZE,
              vx: 0,
              vy: 0,
            },
          };
          worldRef.current = resetW;
          accumulatorRef.current = 0;
          syncReactState(resetW);
          setStatus("READY");
          draw();
          return;
        }
      }

      draw();
      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [status, draw, syncReactState]);

  /* ── Keyboard input ── */

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "Left" || e.key === "ArrowRight" || e.key === "Right") {
        e.preventDefault();
        keysDownRef.current.add(e.key);

        // Auto-start on arrow key press from READY state.
        if (statusRef.current === "READY") {
          setStatus("RUNNING");
          notifyPlayResumed();
        }
      }

      // Space bar to launch / pause / resume.
      if (e.key === " ") {
        e.preventDefault();
        if (statusRef.current === "READY") {
          setStatus("RUNNING");
          notifyPlayResumed();
        } else if (statusRef.current === "RUNNING") {
          setStatus("PAUSED");
        } else if (statusRef.current === "PAUSED") {
          setStatus("RUNNING");
          notifyPlayResumed();
        } else if (statusRef.current === "GAME_OVER") {
          restartRun();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current.delete(e.key);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [notifyPlayResumed, restartRun]);

  /* ── Pause game when a tracked ticket is called ── */

  React.useEffect(() => {
    const onTicketCalled = () => {
      setStatus((cur) => (cur === "RUNNING" ? "PAUSED" : cur));
    };
    window.addEventListener(ARCADE_TICKET_CALLED_EVENT, onTicketCalled as EventListener);
    return () => {
      window.removeEventListener(ARCADE_TICKET_CALLED_EVENT, onTicketCalled as EventListener);
    };
  }, []);

  /* ── Slider input (paddle control) ── */

  const handleSliderChange = React.useCallback(
    (value: number[]) => {
      const sliderVal = value[0] ?? 0;
      // Map 0..100 to 0..(BOARD_W - PADDLE_W).
      paddleTargetRef.current = (sliderVal / 100) * (BOARD_W - PADDLE_W);
      setSliderValue(sliderVal);

      // Auto-start on slider drag from READY state.
      if (statusRef.current === "READY") {
        setStatus("RUNNING");
        notifyPlayResumed();
      }
    },
    [notifyPlayResumed],
  );

  /* ── Control button handlers ── */

  const handlePlayNow = React.useCallback(() => {
    if (status === "READY" || status === "PAUSED") {
      setStatus("RUNNING");
      notifyPlayResumed();
    } else if (status === "GAME_OVER") {
      restartRun();
    }
    focusPlayArea();
  }, [focusPlayArea, notifyPlayResumed, restartRun, status]);

  const handleCenterControl = React.useCallback(() => {
    if (status === "RUNNING") {
      setStatus("PAUSED");
      return;
    }
    if (status === "PAUSED") {
      setStatus("RUNNING");
      notifyPlayResumed();
      return;
    }
    if (status === "READY") {
      setStatus("RUNNING");
      notifyPlayResumed();
      focusPlayArea();
      return;
    }
    if (status === "GAME_OVER") {
      restartRun();
      focusPlayArea();
    }
  }, [focusPlayArea, notifyPlayResumed, restartRun, status]);

  const centerControlLabel =
    status === "RUNNING" ? t("pause") : status === "PAUSED" ? t("play") : t("start");
  const centerControlAriaLabel =
    status === "RUNNING" ? "Pause game" : status === "PAUSED" ? "Resume game" : "Start game";

  return (
    <div className="arcade-pixel-grid arcade-brick-shell mx-auto max-w-6xl px-4 pb-6 pt-8 sm:px-6 sm:pt-10">
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
            {t("brickMayhemTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="arcade-ui list-none space-y-2 text-lg text-[var(--arcade-text)]/90 sm:text-xl">
            <li>* {t("brickMayhemInstructionPaddle")}</li>
            <li>* {t("brickMayhemInstructionStrike")}</li>
            <li>* {t("brickMayhemInstructionDrop")}</li>
            <li>* {t("brickMayhemInstructionClear")}</li>
            <li>* {t("brickMayhemInstructionTop")}</li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button type="button" size="lg" className="min-w-44" onClick={handlePlayNow}>
          {t("playNow")}
        </Button>
        {status === "GAME_OVER" ? (
          <Button type="button" variant="outline" className="min-w-36" onClick={resetGame}>
            {t("reset")}
          </Button>
        ) : null}
      </div>

      {status === "GAME_OVER" ? (
        <div className="mt-3 flex justify-center">
          <p className="arcade-retro arcade-brick-alert text-base text-[var(--arcade-neon)] sm:text-lg">
            {t("gameOver")}
          </p>
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {status === "GAME_OVER" ? t("gameOverAnnouncement") : null}
      </div>

      <section
        ref={playAreaRef}
        className="arcade-brick-stage mt-6"
        tabIndex={-1}
        aria-label="Brick Mayhem play area"
      >
        <div className="arcade-brick-readout arcade-brick-readout-metrics arcade-ui">
          <p
            className={cn(
              "text-[var(--arcade-dot)]",
              isLargeTextLocale ? "text-[26px] sm:text-[28px]" : "text-[13px]",
            )}
          >
            {t("score")}: {score}
          </p>
          <p
            className={cn(
              "text-[var(--arcade-dot)]",
              isLargeTextLocale ? "text-[26px] sm:text-[28px]" : "text-[13px]",
            )}
          >
            {t("lives")}: {lives}
          </p>
          <p
            className={cn(
              "text-[var(--arcade-dot)]",
              isLargeTextLocale ? "text-[26px] sm:text-[28px]" : "text-[13px]",
            )}
          >
            {t("level")}: {level + 1}
          </p>
        </div>

        <div
          className="arcade-brick-board pixelated"
          role="img"
          aria-label="Brick Mayhem play area"
          onClick={status === "GAME_OVER" ? restartRun : undefined}
        >
          <canvas
            ref={boardCanvasRef}
            className="arcade-brick-canvas pixelated"
            aria-hidden="true"
          />
          {status === "GAME_OVER" ? (
            <div className="arcade-brick-overlay">
              <p className="arcade-retro text-5xl text-[var(--arcade-neon)] sm:text-7xl">
                {t("gameOver")}
              </p>
              <p className="arcade-ui text-3xl text-[var(--arcade-dot)] sm:text-5xl">
                {t("tapToPlayAgain")}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="arcade-brick-control-dock" aria-label="Game controls">
        <div className="arcade-brick-pad">
          <Button
            type="button"
            variant="default"
            className={cn(
              "arcade-brick-control-btn arcade-ui",
              isLargeTextLocale ? "text-[20px] sm:text-[22px]" : "text-[13px]",
            )}
            aria-label={centerControlAriaLabel}
            onClick={handleCenterControl}
          >
            {centerControlLabel}
          </Button>
          <div className="arcade-brick-slider-track">
            <Slider
              min={0}
              max={100}
              step={1}
              value={[sliderValue]}
              onValueChange={handleSliderChange}
              aria-label="Paddle position"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
