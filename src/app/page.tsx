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

  return (
    <div className={effectiveTheme === "dark" ? "dark" : ""}>
      <div className="flex justify-end px-4 pt-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-sm">
          <button
            type="button"
            onClick={() => setChoice("light")}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition ${
              choice === "light" ? "bg-primary/10 text-foreground" : "hover:bg-muted/60"
            }`}
            aria-label="Use light theme"
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
          <button
            type="button"
            onClick={() => setChoice("system")}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition ${
              choice === "system" ? "bg-primary/10 text-foreground" : "hover:bg-muted/60"
            }`}
            aria-label="Use system theme"
          >
            <SunMoon className="h-4 w-4" />
            System
          </button>
          <button
            type="button"
            onClick={() => setChoice("dark")}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition ${
              choice === "dark" ? "bg-primary/10 text-foreground" : "hover:bg-muted/60"
            }`}
            aria-label="Use dark theme"
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
        </div>
      </div>
      <ReadOnlyDisplay />
    </div>
  );
}
