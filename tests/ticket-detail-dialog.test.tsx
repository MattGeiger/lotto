import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "@/contexts/language-context";
import { TicketDetailDialog } from "@/components/ticket-detail-dialog";

vi.mock("@/components/language-morph-text", () => ({
  LanguageMorphText: ({ text }: { text: string | string[] }) => (
    <>{Array.isArray(text) ? text[0] : text}</>
  ),
}));

vi.mock("@/components/animate-ui/icons/clock", () => ({
  Clock: ({ className }: { className?: string }) => <svg className={className} />,
}));

vi.mock("@/components/animate-ui/icons/users", () => ({
  Users: ({ className }: { className?: string }) => <svg className={className} />,
}));

vi.mock("@/components/animate-ui/icons/x", () => ({
  X: ({ className }: { className?: string }) => <svg className={className} />,
}));

describe("TicketDetailDialog", () => {
  it("renders metric cards in the new hierarchy order", () => {
    render(
      <LanguageProvider>
        <TicketDetailDialog
          open
          onOpenChange={() => {}}
          ticketNumber={24}
          queuePosition={8}
          ticketsAhead={5}
          estimatedWaitMinutes={11}
          language="en"
        />
      </LanguageProvider>,
    );

    const estimatedWaitLabel = screen.getByText("Estimated Wait");
    const ticketsAheadLabel = screen.getByText("Tickets Ahead");
    const queuePositionLabel = screen.getByText("Queue Position");

    expect(
      estimatedWaitLabel.compareDocumentPosition(ticketsAheadLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      ticketsAheadLabel.compareDocumentPosition(queuePositionLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the returned-ticket alert branch", () => {
    render(
      <LanguageProvider>
        <TicketDetailDialog
          open
          onOpenChange={() => {}}
          ticketNumber={24}
          queuePosition={8}
          ticketsAhead={5}
          estimatedWaitMinutes={11}
          language="en"
          ticketStatus="returned"
        />
      </LanguageProvider>,
    );

    expect(
      screen.getByText(/This ticket number is marked as "Returned" and will not be called\./),
    ).toBeInTheDocument();
    expect(screen.queryByText("Estimated Wait")).not.toBeInTheDocument();
  });
});

