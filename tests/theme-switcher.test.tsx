import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";

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

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark", "light", "hi-viz");
    installMatchMedia(false);
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

  it("restores persisted hi-viz mode on mount", async () => {
    window.localStorage.setItem("contrast-mode", "hi-viz");

    renderSwitcher();

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("hi-viz");
    });
  });
});
