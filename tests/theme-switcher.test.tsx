import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { ThemeProvider } from "@/components/theme-provider";
import {
  ThemeSwitcher,
  THEME_SWITCHER_TRIGGER_ID,
} from "@/components/theme-switcher";

type ViewTransitionResult = {
  ready: Promise<void>;
  finished: Promise<void>;
};

function installMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderSwitcher() {
  render(
    <ThemeProvider>
      <ThemeSwitcher />
    </ThemeProvider>,
  );
}

function installViewTransition() {
  const startViewTransition = vi.fn(
    (callback: () => void | Promise<void>): ViewTransitionResult => {
      callback();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
      };
    },
  );

  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    writable: true,
    value: startViewTransition,
  });

  return startViewTransition;
}

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark", "light", "hi-viz");
    installMatchMedia(false);
    delete (
      document as Document & {
        startViewTransition?: unknown;
      }
    ).startViewTransition;
  });

  it("shows all four theme options", async () => {
    renderSwitcher();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /theme options/i }));

    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Hi-viz")).toBeInTheDocument();
  });

  it("uses a deterministic trigger id for hydration stability", () => {
    renderSwitcher();

    expect(
      screen.getByRole("button", { name: /theme options/i }),
    ).toHaveAttribute("id", THEME_SWITCHER_TRIGGER_ID);
  });

  it("applies hi-viz mode and persists system color scheme", async () => {
    renderSwitcher();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /theme options/i }));
    await user.click(screen.getByText("Hi-viz"));

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("hi-viz");
    });
    expect(window.localStorage.getItem("contrast-mode")).toBe("hi-viz");
    expect(window.localStorage.getItem("theme")).toBe("system");
  });

  it("switches back to dark mode and clears hi-viz", async () => {
    renderSwitcher();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /theme options/i }));
    await user.click(screen.getByText("Hi-viz"));
    await waitFor(() => {
      expect(document.documentElement).toHaveClass("hi-viz");
    });

    await user.click(screen.getByRole("button", { name: /theme options/i }));
    await user.click(screen.getByText("Dark"));

    await waitFor(() => {
      expect(document.documentElement).not.toHaveClass("hi-viz");
    });
    expect(window.localStorage.getItem("contrast-mode")).toBeNull();
    expect(window.localStorage.getItem("theme")).toBe("dark");
  });

  it("uses view transition when available for base theme changes", async () => {
    const startViewTransition = installViewTransition();

    renderSwitcher();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /theme options/i }));
    await user.click(screen.getByText("Dark"));

    await waitFor(() => {
      expect(startViewTransition).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem("theme")).toBe("dark");
    });
  });

  it("restores persisted hi-viz mode on mount", async () => {
    window.localStorage.setItem("contrast-mode", "hi-viz");

    renderSwitcher();

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("hi-viz");
    });
  });
});
