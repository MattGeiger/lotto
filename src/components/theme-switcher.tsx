"use client";

import * as React from "react";
import { Sun } from "@/components/animate-ui/icons/sun";
import { Moon } from "@/components/animate-ui/icons/moon";
import { SunMoon } from "@/components/animate-ui/icons/sun-moon";
import { EyeIcon } from "@/components/lucide-animated/eye";
import { useTheme } from "next-themes";

import { useContrastMode } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuCheckboxItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { contrastMode, setContrastMode } = useContrastMode();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const selectedTheme = theme ?? "system";
  const hiVizEnabled = contrastMode === "hi-viz";
  const resolvedTheme =
    selectedTheme === "light" || selectedTheme === "dark" || selectedTheme === "system"
      ? selectedTheme
      : "system";
  const activeMode = mounted ? (hiVizEnabled ? "hi-viz" : resolvedTheme) : "system";

  const setBaseTheme = (nextTheme: "light" | "dark" | "system") => {
    setContrastMode("default");
    setTheme(nextTheme);
  };

  const setHiVizTheme = () => {
    setTheme("system");
    setContrastMode("hi-viz");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
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
        <DropdownMenuCheckboxItem checked={!hiVizEnabled && selectedTheme === "light"} onSelect={() => setBaseTheme("light")}>
          <Sun size={16} animation="default" animateOnView="default" animateOnHover="default" animateOnTap="default" />
          Light
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={!hiVizEnabled && selectedTheme === "dark"} onSelect={() => setBaseTheme("dark")}>
          <Moon size={16} animation="default" animateOnView="default" animateOnHover="default" animateOnTap="default" />
          Dark
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={!hiVizEnabled && selectedTheme === "system"} onSelect={() => setBaseTheme("system")}>
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
}
