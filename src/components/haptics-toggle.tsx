"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { HapticsStatusIcon } from "@/components/haptics-status-icon";
import { useAppHaptics } from "@/components/haptics-provider";
import { useLanguage } from "@/contexts/language-context";

export function HapticsToggle() {
  const { enabled, setEnabled } = useAppHaptics();
  const { t } = useLanguage();
  const nextEnabled = !enabled;
  const label = enabled ? t("hapticsOn") : t("hapticsOff");

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      haptic="none"
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      className="!h-[3.375rem] !w-[3.375rem]"
      onClick={() => setEnabled(nextEnabled)}
    >
      <HapticsStatusIcon enabled={enabled} className="size-[1.55rem]" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
