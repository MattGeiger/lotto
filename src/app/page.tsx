"use client";

import * as React from "react";
import { ReadOnlyDisplay } from "@/components/readonly-display";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Search } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";

export default function DisplayPage() {
  const [searchValue, setSearchValue] = React.useState("");
  const [searchSubmission, setSearchSubmission] = React.useState<{ ticketNumber: number; triggerId: number } | null>(null);
  const searchTriggerRef = React.useRef(0);
  const { language, t } = useLanguage();

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
      <div className="absolute left-8 right-8 top-4 z-50 flex items-center justify-between py-2 sm:left-10 sm:right-10 lg:left-12 lg:right-12">
        <LanguageSwitcher />
        <div className="flex-1 flex justify-center px-3">
          <div className="min-w-0 flex-1 max-w-[260px]">
            <label htmlFor="ticket-search" className="sr-only">
              {t("searchTicketLabel")}
            </label>
            <div className="flex w-full items-center gap-3">
              <InputGroup className="flex-1">
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
                variant="outline"
                size="icon"
                className="!h-[3.375rem] !w-[3.375rem]"
                onClick={handleSearchSubmit}
              >
                <Search className="size-5" />
                <span className="sr-only">{t("searchButtonLabel")}</span>
              </Button>
            </div>
          </div>
        </div>
        <ThemeSwitcher />
      </div>
      <ReadOnlyDisplay ticketSearchRequest={searchSubmission ?? undefined} />
    </div>
  );
}
