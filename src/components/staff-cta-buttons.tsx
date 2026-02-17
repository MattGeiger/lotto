"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "@/components/animate-ui/icons/arrow-right";
import { EyeIcon, type EyeIconHandle } from "@/components/lucide-animated/eye";

import { Button } from "@/components/ui/button";

const ARROW_RESET_MS = 360;
const EYE_RESET_MS = 420;

export function StaffCtaButtons() {
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
    <div className="flex flex-wrap gap-3">
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
    </div>
  );
}
