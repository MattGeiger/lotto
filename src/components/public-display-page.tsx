// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

"use client";

import * as React from "react";
import { ReadOnlyDisplay } from "@/components/readonly-display";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BottomTabBar } from "@/components/navigation/bottom-tab-bar";
import { TicketCalledCelebration } from "@/components/ticket-called-celebration";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Search } from "@/components/animate-ui/icons/search";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";
import { useDisplayLanguageRotation } from "@/hooks/use-display-language-rotation";
import type { RaffleState } from "@/lib/state-types";
import type { RealtimeCanaryClientConfig } from "@/lib/realtime/client-canary-config";

export function PublicDisplayPage({
  realtimeCanary = null,
  realtimeSourceCanary = null,
}: {
  realtimeCanary?: RealtimeCanaryClientConfig | null;
  realtimeSourceCanary?: RealtimeCanaryClientConfig | null;
}) {
  const [searchValue, setSearchValue] = React.useState("");
  const [searchSubmission, setSearchSubmission] = React.useState<{ ticketNumber: number; triggerId: number } | null>(
    null,
  );
  const searchTriggerRef = React.useRef(0);
  const { hasSessionLanguageOverride, isLanguageHydrated, t } = useLanguage();
  const [latestState, setLatestState] = React.useState<RaffleState | null>(null);
  const [rotationPausedForSession, setRotationPausedForSession] = React.useState(false);
  const rotation = latestState?.displayLanguageRotation ?? null;

  // Auto-rotate by default, but any explicit browser-session choice owns the
  // session, including English selected from the homepage.
  useDisplayLanguageRotation(rotation, {
    paused: !isLanguageHydrated || hasSessionLanguageOverride || rotationPausedForSession,
  });

  // Hide the bottom nav after the rotation cadence so the board stays clean
  // between language cycles; fall back to 5 minutes when rotation is off or has
  // no valid interval. Activity restores the bar (handled inside BottomTabBar).
  const NAV_AUTOHIDE_FALLBACK_SECONDS = 300;
  const navAutoHideSeconds =
    rotation?.enabled && rotation.intervalSeconds > 0
      ? rotation.intervalSeconds
      : NAV_AUTOHIDE_FALLBACK_SECONDS;

  const handleManualLanguageChange = React.useCallback(() => {
    setRotationPausedForSession(true);
  }, []);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = event.target.value.replace(/\D/g, "");
    setSearchValue(digitsOnly.slice(0, 6));
  };

  const handleSearchSubmit = () => {
    if (!searchValue) return;
    const ticketNumber = Number(searchValue);
    if (Number.isNaN(ticketNumber)) return;
    const nextId = searchTriggerRef.current + 1;
    searchTriggerRef.current = nextId;
    setSearchSubmission({ ticketNumber, triggerId: nextId });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchSubmit();
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-6 right-6 top-4 z-30 flex items-center justify-between gap-5 py-2 sm:left-8 sm:right-8 lg:left-10 lg:right-10">
        <LanguageSwitcher onLanguageChange={handleManualLanguageChange} />
        <div className="flex-1 flex justify-center px-2">
          <div className="min-w-0 flex-1 max-w-[360px]">
            <label htmlFor="ticket-search" className="sr-only">
              {t("searchTicketLabel")}
            </label>
            <div className="flex w-full items-center gap-0 rounded-full bg-card/80 px-0 py-0.5 shadow-sm">
              <InputGroup className="flex-1 border-0 shadow-none bg-transparent dark:bg-transparent !bg-transparent !dark:bg-transparent">
                <InputGroupInput
                  id="ticket-search"
                  placeholder={t("searchTicketPlaceholder")}
                  aria-label="Search ticket number"
                  value={searchValue}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  inputMode="numeric"
                  enterKeyHint="search"
                  maxLength={6}
                />
              </InputGroup>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="!h-[3.375rem] !w-[3.375rem] !border-0 !rounded-full bg-card/80 hover:bg-accent hover:text-accent-foreground shadow-[var(--base-shadow-lg)] [&_svg]:!size-[1.8rem]"
                onClick={handleSearchSubmit}
              >
                <AnimateIcon
                  animateOnView="path"
                  animateOnHover="find"
                  animateOnTap="default"
                  completeOnStop
                  className="inline-flex"
                >
                  <Search size={29} />
                </AnimateIcon>
                <span className="sr-only">{t("searchButtonLabel")}</span>
              </Button>
            </div>
          </div>
        </div>
        <ThemeSwitcher />
      </div>
      <ReadOnlyDisplay
        ticketSearchRequest={searchSubmission ?? undefined}
        onStateChange={setLatestState}
        realtimeCanary={realtimeCanary}
        realtimeSourceCanary={realtimeSourceCanary}
      />
      <BottomTabBar autoHideAfterSeconds={navAutoHideSeconds} />
      <TicketCalledCelebration state={latestState} />
    </div>
  );
}
