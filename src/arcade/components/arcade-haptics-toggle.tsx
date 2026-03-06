"use client";

import * as React from "react";

import { HapticsStatusIcon } from "@/components/haptics-status-icon";
import { useAppHaptics } from "@/components/haptics-provider";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/arcade/ui/8bit";
import { cn } from "@/lib/utils";

type ArcadeHapticsToggleProps = {
  className?: string;
};

export function ArcadeHapticsToggle({ className }: ArcadeHapticsToggleProps) {
  const { enabled, setEnabled } = useAppHaptics();
  const { t } = useLanguage();
  const nextEnabled = !enabled;
  const label = enabled ? t("hapticsOn") : t("hapticsOff");

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      font="normal"
      haptic="none"
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      className={cn(
        "h-9 w-9 p-0 text-[var(--arcade-dot)] hover:text-[var(--arcade-neon)]",
        enabled ? "bg-[var(--arcade-wall)]/20" : null,
        className,
      )}
      onClick={() => setEnabled(nextEnabled)}
    >
      <HapticsStatusIcon enabled={enabled} className="size-5" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
