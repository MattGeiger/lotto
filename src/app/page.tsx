"use client";

import React from "react";
import { Moon, Sun, SunMoon } from "lucide-react";

import { ReadOnlyDisplay } from "@/components/readonly-display";

type ThemeChoice = "light" | "dark" | "system";

export default function DisplayPage() {
  const [choice, setChoice] = React.useState<ThemeChoice>("system");
  const [prefersDark, setPrefersDark] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersDark(event.matches);
    };
    handleChange(media);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const effectiveTheme = choice === "system" ? (prefersDark ? "dark" : "light") : choice;
  const cycleTheme = () => {
    setChoice((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  };

  return (
    <div className={effectiveTheme === "dark" ? "dark" : ""}>
      <div className="flex justify-end px-4 pt-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={cycleTheme}
          aria-label={`Switch theme (current: ${choice})`}
          className="inline-flex items-center justify-center rounded-full border border-border/60 bg-card/60 p-2 text-muted-foreground shadow-sm hover:bg-muted/50"
        >
          {choice === "light" ? (
            <Sun className="h-4 w-4" />
          ) : choice === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <SunMoon className="h-4 w-4" />
          )}
        </button>
      </div>
      <ReadOnlyDisplay />
    </div>
  );
}
