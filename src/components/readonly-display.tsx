"use client";

import React from "react";
import QRCode from "qrcode";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketDetailDialog } from "@/components/ticket-detail-dialog";
import { useLanguage, type Language } from "@/contexts/language-context";
import { formatDate } from "@/lib/date-format";
import { isRTL } from "@/lib/rtl-utils";
import { formatWaitTime } from "@/lib/time-format";
import type { RaffleState } from "@/lib/state-types";

const TIME_LOCALES: Record<Language, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  ru: "ru-RU",
  uk: "uk-UA",
  vi: "vi-VN",
  fa: "fa-IR",
  ar: "ar",
};

const formatTime = (input?: Date | number | null, language: Language = "en") => {
  if (!input && input !== 0) return "—";
  const date = input instanceof Date ? input : new Date(input);
  const locale = TIME_LOCALES[language] ?? "en-US";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
};

export const ReadOnlyDisplay = () => {
  const { language, t } = useLanguage();
  const [state, setState] = React.useState<RaffleState | null>(null);
  const [status, setStatus] = React.useState("");
  const [hasError, setHasError] = React.useState(false);
  const [selectedTicket, setSelectedTicket] = React.useState<number | null>(null);
  const [qrUrl, setQrUrl] = React.useState("");
  const qrCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const formattedDate = React.useMemo(() => formatDate(language), [language]);

  const fetchState = React.useCallback(async () => {
    setStatus(t("refreshing"));
    setHasError(false);
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load state");
      }
      const payload = (await response.json()) as RaffleState;
      setState(payload);
      setStatus(`${t("lastChecked")}: ${formatTime(new Date(), language)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("unknownError");
      setStatus(`${t("errorLoadingState")}: ${message}`);
      setHasError(true);
    }
  }, [language, t]);

  React.useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 4000);
    return () => clearInterval(interval);
  }, [fetchState]);

  React.useEffect(() => {
    setStatus(t("pollingState"));
  }, [t]);

  React.useEffect(() => {
    document.title = `${t("foodPantryServiceFor")} ${formattedDate}`;
  }, [formattedDate, t]);

  React.useEffect(() => {
    const fetchDisplayUrl = async () => {
      try {
        const response = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getDisplayUrl" }),
        });
        const data = await response.json();
        setQrUrl(data.displayUrl || (typeof window !== "undefined" ? window.location.href : ""));
      } catch {
        setQrUrl(typeof window !== "undefined" ? window.location.href : "");
      }
    };
    fetchDisplayUrl();
  }, []);

  React.useEffect(() => {
    const target = qrUrl || (typeof window !== "undefined" ? window.location.href : "");
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, target, { width: 150, margin: 1 }).catch(() => {
      // ignore render errors
    });
  }, [qrUrl]);

  const startNumber = state?.startNumber ?? 0;
  const endNumber = state?.endNumber ?? 0;
  const generatedOrder = state?.generatedOrder ?? [];
  const currentlyServing = state?.currentlyServing ?? null;
  const currentIndex =
    generatedOrder && currentlyServing !== null ? generatedOrder.indexOf(currentlyServing) : -1;
  const hasTickets = generatedOrder.length > 0;
  const updatedTime = formatTime(state?.timestamp ?? null, language);

  const getTicketDetails = (ticketNumber: number) => {
    if (!state?.generatedOrder?.length) return null;
    const queuePosition = state.generatedOrder.indexOf(ticketNumber) + 1;
    if (queuePosition <= 0) return null;
    const servingIndex =
      state.currentlyServing !== null ? state.generatedOrder.indexOf(state.currentlyServing) : -1;
    const ticketsAhead =
      servingIndex === -1 ? Math.max(0, queuePosition - 1) : Math.max(0, queuePosition - servingIndex - 1);
    // 165 minutes / 75 shoppers = 2.2 minutes per shopper
    const estimatedWaitMinutes = Math.round(ticketsAhead * 2.2);
    return { queuePosition, ticketsAhead, estimatedWaitMinutes };
  };

  return (
    <div
      dir={isRTL(language) ? "rtl" : "ltr"}
      lang={language}
      className="min-h-screen w-full bg-gradient-display px-2 py-8 text-foreground sm:px-4 lg:px-6"
    >
      <div className="mx-auto flex w-full flex-col gap-4">
        {/* Logo + Now Serving Row */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-[minmax(280px,320px)_1fr_minmax(280px,320px)] sm:items-center sm:gap-6">
          {/* Logo - left */}
          <div className="flex justify-center sm:justify-start">
            <img
              src="/wth-logo-horizontal.png"
              alt="William Temple House"
              className="block h-auto w-full max-w-[400px] dark:hidden"
            />
            <img
              src="/wth-logo-horizontal-reverse.png"
              alt="William Temple House"
              className="hidden h-auto w-full max-w-[400px] dark:block"
            />
          </div>

          {/* NOW SERVING - center */}
          <div className="flex justify-center">
            <div className="text-center">
              <p className="mb-1 text-lg uppercase tracking-[0.14em] text-muted-foreground">{t("nowServing")}</p>
              <p
                className="bg-gradient-serving-text bg-clip-text text-[96px] font-black leading-[1.15] text-transparent"
                aria-label="Currently serving ticket number"
              >
                {currentlyServing ?? t("waiting")}
              </p>
            </div>
          </div>

          {/* QR Code - right */}
          <div className="hidden sm:flex items-center justify-center">
            <div className="rounded-lg border border-border/60 bg-card/30 p-3">
              <canvas
                ref={qrCanvasRef}
                width={150}
                height={150}
                aria-label="Scan to view display"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 sm:gap-4">
          <Card className="border-border/80 bg-card/80 text-start">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                {t("foodPantryServiceFor")}
              </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold text-foreground">{formattedDate}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80 text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                {t("ticketsIssuedToday")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {startNumber && endNumber ? `${startNumber} – ${endNumber}` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80 text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                {t("totalTicketsIssued")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {startNumber && endNumber ? endNumber - startNumber + 1 : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg uppercase tracking-[0.14em] text-muted-foreground">
                {t("drawingOrder")}
              </CardTitle>
              <Badge
                variant="outline"
                className="border-border/60 text-xs font-medium text-muted-foreground"
              >
                {t("updated")}: {updatedTime}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasTickets && (
              <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/20 px-4 py-6 text-center text-3xl font-extrabold leading-snug text-foreground">
                <span className="block w-full">{t("welcome")}</span>
                <span className="block w-full">{t("raffleNotStarted")}</span>
                <span className="block w-full">{t("checkBackSoon")}</span>
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 md:gap-4">
              {generatedOrder.map((value, index) => {
                const baseClasses =
                  "flex items-center justify-center rounded-xl border text-center text-2xl font-extrabold leading-[1.2] px-4 py-3 cursor-pointer transition-transform hover:scale-[1.03]";
                const stateClass =
                  value === currentlyServing
                    ? "ticket-serving"
                    : currentIndex !== -1 && index < currentIndex
                      ? "ticket-served"
                      : "ticket-upcoming";
                return (
                  <div
                    key={value}
                    className={`${baseClasses} ${stateClass}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTicket(value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedTicket(value);
                      }
                    }}
                  >
                    {value}
                  </div>
                );
              })}
            </div>

            <div
              className={`text-sm ${hasError ? "text-destructive" : "text-muted-foreground"}`}
              id="status"
              aria-live="polite"
            >
              {status}
            </div>
          </CardContent>
        </Card>
        {selectedTicket !== null && getTicketDetails(selectedTicket) && (
          <TicketDetailDialog
            open={selectedTicket !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedTicket(null);
            }}
            ticketNumber={selectedTicket}
            {...getTicketDetails(selectedTicket)!}
            language={language}
          />
        )}
      </div>
    </div>
  );
};
