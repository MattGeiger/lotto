import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BrickMayhemPage from "@/app/(arcade)/arcade/brick-mayhem/page";
import SnakePage from "@/app/(arcade)/arcade/snake/page";
import { LanguageProvider } from "@/contexts/language-context";

const triggerMock = vi.fn();
const tickMock = vi.fn();

vi.mock("@/components/haptics-provider", () => ({
  HapticsProvider: ({ children }: { children: ReactNode }) => children,
  useAppHaptics: () => ({
    enabled: true,
    isNative: true,
    setEnabled: vi.fn(),
    trigger: triggerMock,
  }),
}));

vi.mock("@/arcade/game/brick-mayhem/engine", () => ({
  initialWorld: vi.fn(() => ({
    launched: false,
    score: 0,
    lives: 3,
    level: 0,
    paddle: { x: 20 },
    balls: [],
    bricks: [],
  })),
  launchBall: vi.fn((world: unknown) => ({
    ...(world as Record<string, unknown>),
    launched: true,
  })),
  effectivePaddleWidth: vi.fn(() => 16),
  createWorld: vi.fn((level: number, lives: number, score: number) => ({
    launched: false,
    score,
    lives,
    level,
    paddle: { x: 20 },
    balls: [],
    bricks: [],
  })),
  tick: (...args: unknown[]) => tickMock(...args),
}));

vi.mock("@/arcade/game/brick-mayhem/particles", () => ({
  spawnBrickFragments: vi.fn(() => []),
  tickFragments: vi.fn(() => []),
}));

function renderWithLanguage(ui: React.ReactNode) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe("Arcade native game haptics", () => {
  beforeEach(() => {
    triggerMock.mockReset();
    tickMock.mockReset();

    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null as unknown as CanvasRenderingContext2D,
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("restores native Snake reward haptics when a pellet is eaten", async () => {
    let tickCallback: (() => void) | null = null;
    vi.spyOn(window, "setInterval").mockImplementation((callback: TimerHandler) => {
      tickCallback = callback as () => void;
      return 1 as unknown as number;
    });
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);

    renderWithLanguage(<SnakePage />);

    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowUp" });
    });
    triggerMock.mockReset();

    for (let step = 0; step < 7; step += 1) {
      await act(async () => {
        tickCallback?.();
      });
    }

    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
    });
    triggerMock.mockReset();

    for (let step = 0; step < 7; step += 1) {
      await act(async () => {
        tickCallback?.();
      });
    }

    expect(triggerMock).toHaveBeenCalledWith("gameReward");
  });

  it("restores native Snake failure haptics on collision", async () => {
    let tickCallback: (() => void) | null = null;
    vi.spyOn(window, "setInterval").mockImplementation((callback: TimerHandler) => {
      tickCallback = callback as () => void;
      return 1 as unknown as number;
    });
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);

    renderWithLanguage(<SnakePage />);

    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowUp" });
    });
    triggerMock.mockReset();

    for (let step = 0; step < 11; step += 1) {
      await act(async () => {
        tickCallback?.();
      });
    }

    expect(triggerMock).toHaveBeenCalledWith("gameFailure");
  });

  it("restores native Brick Mayhem impact/contact haptics during the game loop", async () => {
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    tickMock.mockReturnValue({
      world: {
        launched: true,
        score: 10,
        lives: 3,
        level: 0,
        paddle: { x: 20 },
        balls: [],
        bricks: [],
      },
      destroyedBricks: [{}],
      paddleBounced: true,
      levelCleared: false,
      ballLost: false,
    });

    renderWithLanguage(<BrickMayhemPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "PLAY NOW" }));
    });
    triggerMock.mockReset();

    await act(async () => {
      rafCallback?.(16);
    });
    await act(async () => {
      rafCallback?.(40);
    });

    expect(triggerMock).toHaveBeenCalledWith("gameImpact");
    expect(triggerMock).toHaveBeenCalledWith("gameContact");
  });

  it("restores native Brick Mayhem failure haptics when the ball is lost", async () => {
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    tickMock.mockReturnValue({
      world: {
        launched: true,
        score: 10,
        lives: 3,
        level: 0,
        paddle: { x: 20 },
        balls: [],
        bricks: [],
      },
      destroyedBricks: [],
      paddleBounced: false,
      levelCleared: false,
      ballLost: true,
    });

    renderWithLanguage(<BrickMayhemPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "PLAY NOW" }));
    });
    triggerMock.mockReset();

    await act(async () => {
      rafCallback?.(16);
    });
    await act(async () => {
      rafCallback?.(40);
    });

    expect(triggerMock).toHaveBeenCalledWith("gameFailure");
  });
});
