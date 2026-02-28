"use client";

import * as React from "react";
import { Sun } from "@/components/animate-ui/icons/sun";
import { Moon } from "@/components/animate-ui/icons/moon";
import { SunMoon } from "@/components/animate-ui/icons/sun-moon";
import { EyeIcon } from "@/components/lucide-animated/eye";
import { useTheme } from "next-themes";

import {
  ThemeToggler,
  type ResolvedThemeSelection,
  type ThemeSelection,
} from "@/components/animate-ui/primitives/effects/theme-toggler";
import { useContrastMode } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuCheckboxItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function normalizeThemeSelection(theme: string | undefined): ThemeSelection {
  if (theme === "light" || theme === "dark" || theme === "system") {
    return theme;
  }
  return "system";
}

function normalizeResolvedTheme(
  theme: ThemeSelection,
  resolvedTheme: string | undefined,
): ResolvedThemeSelection {
  if (resolvedTheme === "light" || resolvedTheme === "dark") {
    return resolvedTheme;
  }
  if (theme === "light" || theme === "dark") {
    return theme;
  }
  return "light";
}

export const THEME_SWITCHER_TRIGGER_ID = "theme-switcher-trigger";

export function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { contrastMode, setContrastMode } = useContrastMode();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const selectedTheme = normalizeThemeSelection(theme);
  const activeResolvedTheme = normalizeResolvedTheme(selectedTheme, resolvedTheme);
  const hiVizEnabled = contrastMode === "hi-viz";

  return (
    <ThemeToggler
      theme={selectedTheme}
      resolvedTheme={activeResolvedTheme}
      setTheme={(nextTheme) => setTheme(nextTheme)}
      direction="ltr"
    >
      {({ effective, toggleTheme }) => {
        const activeMode = mounted ? (hiVizEnabled ? "hi-viz" : effective) : "system";

        const setBaseTheme = (nextTheme: ThemeSelection) => {
          setContrastMode("default");
          void toggleTheme(nextTheme);
        };

        const setHiVizTheme = () => {
          void toggleTheme("system");
          setContrastMode("hi-viz");
        };

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                id={THEME_SWITCHER_TRIGGER_ID}
                variant="outline"
                size="icon"
                className="!h-[3.375rem] !w-[3.375rem] [&_svg]:!size-[1.8rem]"
              >
                {activeMode === "light" ? (
                  <Sun
                    key="trigger-light"
                    size={29}
                    animation="default"
                    animateOnView="default"
                    animateOnHover="default"
                    animateOnTap="default"
                    className="inline-flex text-current"
                  />
                ) : activeMode === "dark" ? (
                  <Moon
                    key="trigger-dark"
                    size={29}
                    animation="default"
                    animateOnView="default"
                    animateOnHover="default"
                    animateOnTap="default"
                    className="inline-flex text-current"
                  />
                ) : activeMode === "system" ? (
                  <SunMoon
                    key="trigger-system"
                    size={29}
                    animation="default"
                    animateOnView="default"
                    animateOnHover="default"
                    animateOnTap="default"
                    className="inline-flex text-current"
                  />
                ) : (
                  <EyeIcon
                    key="trigger-hi-viz"
                    size={29}
                    className="inline-flex text-current"
                    animateOnView
                    animateOnHover
                    animateOnTap
                  />
                )}
                <span className="sr-only">Theme options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem checked={!hiVizEnabled && effective === "light"} onSelect={() => setBaseTheme("light")}>
                <Sun size={16} animation="default" animateOnView="default" animateOnHover="default" animateOnTap="default" />
                Light
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={!hiVizEnabled && effective === "dark"} onSelect={() => setBaseTheme("dark")}>
                <Moon size={16} animation="default" animateOnView="default" animateOnHover="default" animateOnTap="default" />
                Dark
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={!hiVizEnabled && effective === "system"} onSelect={() => setBaseTheme("system")}>
                <SunMoon size={16} animation="default" animateOnView="default" animateOnHover="default" animateOnTap="default" />
                System
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={hiVizEnabled} onSelect={setHiVizTheme}>
                <EyeIcon
                  size={16}
                  className="inline-flex text-current"
                  animateOnView
                  animateOnHover
                  animateOnTap
                />
                Hi-viz
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }}
    </ThemeToggler>
  );
}
