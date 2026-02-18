import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ARCADE_TICKET_CALLED_EVENT } from "@/arcade/lib/events";
import SnakePage from "@/app/(arcade)/arcade/snake/page";
import { LanguageProvider } from "@/contexts/language-context";

function renderSnake() {
  return render(
    <LanguageProvider>
      <SnakePage />
    </LanguageProvider>,
  );
}

describe("Snake ticket-called pause behavior", () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.spyOn(window, "setInterval").mockImplementation(() => 0 as unknown as number);
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pauses a running game when the ticket-called event is dispatched", async () => {
    renderSnake();

    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowUp" });
    });
    expect(await screen.findByRole("button", { name: "Pause game" })).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(ARCADE_TICKET_CALLED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume game" })).toBeInTheDocument();
      expect(screen.getByText("PLAY")).toBeInTheDocument();
    });
  });
});
