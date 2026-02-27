"use client";

import * as React from "react";
import Link from "next/link";
import localFont from "next/font/local";
import { ArrowRight } from "@/components/animate-ui/icons/arrow-right";
import { EyeIcon, type EyeIconHandle } from "@/components/lucide-animated/eye";
import { LanguageMorphText } from "@/components/language-morph-text";
import { useLanguage } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

const ARROW_RESET_MS = 360;
const EYE_RESET_MS = 420;

const arcadeDisplayFont = localFont({
  src: "../arcade/fonts/SevenFifteen-V0_013/SevenFifteenMonoRounded-Regular.ttf",
  display: "swap",
  weight: "400",
  style: "normal",
});

function ArcadePixelFrame({ className }: { className?: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -top-1 left-1 h-1 w-[calc(50%-2px)] bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -top-1 right-1 h-1 w-[calc(50%-2px)] bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-1 left-1 h-1 w-[calc(50%-2px)] bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-1 right-1 h-1 w-[calc(50%-2px)] bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-0 size-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-0 top-0 size-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 size-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-0 right-0 size-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -left-1 top-1 h-[calc(100%-8px)] w-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-1 top-1 h-[calc(100%-8px)] w-1 bg-foreground dark:bg-ring",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-foreground/20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1 h-1 w-3 bg-foreground/20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-foreground/20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 right-0 h-1 w-3 bg-foreground/20"
      />
    </>
  );
}

export function StaffCtaButtons() {
  const { t } = useLanguage();
  const [isDashboardIconActive, setIsDashboardIconActive] = React.useState(false);
  const eyeIconRef = React.useRef<EyeIconHandle>(null);
  const arrowResetTimerRef = React.useRef<number | null>(null);
  const eyeResetTimerRef = React.useRef<number | null>(null);

  const triggerDashboardIcon = React.useCallback(() => {
    setIsDashboardIconActive(true);
    if (arrowResetTimerRef.current !== null) {
      window.clearTimeout(arrowResetTimerRef.current);
    }
    arrowResetTimerRef.current = window.setTimeout(() => {
      setIsDashboardIconActive(false);
      arrowResetTimerRef.current = null;
    }, ARROW_RESET_MS);
  }, []);

  const triggerBoardIcon = React.useCallback(() => {
    eyeIconRef.current?.startAnimation();
    if (eyeResetTimerRef.current !== null) {
      window.clearTimeout(eyeResetTimerRef.current);
    }
    eyeResetTimerRef.current = window.setTimeout(() => {
      eyeIconRef.current?.stopAnimation();
      eyeResetTimerRef.current = null;
    }, EYE_RESET_MS);
  }, []);

  React.useEffect(() => {
    triggerDashboardIcon();
    triggerBoardIcon();

    return () => {
      if (arrowResetTimerRef.current !== null) {
        window.clearTimeout(arrowResetTimerRef.current);
      }
      if (eyeResetTimerRef.current !== null) {
        window.clearTimeout(eyeResetTimerRef.current);
      }
    };
  }, [triggerBoardIcon, triggerDashboardIcon]);

  return (
    <div className="flex flex-wrap items-start gap-3">
      <Button
        asChild
        size="lg"
        onMouseEnter={triggerDashboardIcon}
        onPointerDown={triggerDashboardIcon}
        onClick={triggerDashboardIcon}
      >
        <Link href="/admin">
          Open Staff Dashboard{" "}
          <ArrowRight
            animate={isDashboardIconActive ? "default" : false}
            className="size-4"
            initialOnAnimateEnd
          />
        </Link>
      </Button>

      <div className="flex flex-col gap-3">
        <Button
          asChild
          variant="secondary"
          size="lg"
          onMouseEnter={triggerBoardIcon}
          onPointerDown={triggerBoardIcon}
          onClick={triggerBoardIcon}
        >
          <Link href="/display">
            View Public Board <EyeIcon ref={eyeIconRef} size={16} className="inline-flex text-current" />
          </Link>
        </Button>

        <Button
          asChild
          type="button"
          className="relative m-1 rounded-none border-none bg-[#ffd75c] text-black transition-transform active:translate-y-0.5 hover:bg-[#ff6de8] hover:text-black dark:bg-[#ffd75c] dark:text-black dark:hover:bg-[#ff6de8]"
        >
          <Link href="/arcade" className="relative inline-flex items-center justify-center gap-2">
            <LanguageMorphText
              text={t("visitArcade")}
              className={cn(arcadeDisplayFont.className, "tracking-[0.12em]")}
              motionMode="simple"
            />
            <span aria-hidden="true" className="text-base leading-none">
              👾
            </span>
            <ArcadePixelFrame />
          </Link>
        </Button>
      </div>
    </div>
  );
}
