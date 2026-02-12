"use client";

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
  const selectedTheme = theme ?? "system";
  const hiVizEnabled = contrastMode === "hi-viz";

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
          className="group relative !h-[3.375rem] !w-[3.375rem] [&_svg]:!size-[1.8rem]"
        >
          {hiVizEnabled ? (
            <EyeIcon
              size={29}
              className="inline-flex text-current transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95"
            />
          ) : (
            <>
              <Sun
                animateOnHover
                animateOnTap
                className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
              />
              <Moon
                animateOnHover
                animateOnTap
                className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
              />
            </>
          )}
          <span className="sr-only">Theme options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem checked={!hiVizEnabled && selectedTheme === "light"} onSelect={() => setBaseTheme("light")}>
          <Sun size={16} animateOnHover />
          Light
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={!hiVizEnabled && selectedTheme === "dark"} onSelect={() => setBaseTheme("dark")}>
          <Moon size={16} animateOnHover />
          Dark
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={!hiVizEnabled && selectedTheme === "system"} onSelect={() => setBaseTheme("system")}>
          <SunMoon size={16} animateOnHover />
          System
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={hiVizEnabled} onSelect={setHiVizTheme}>
          <EyeIcon size={16} className="inline-flex text-current" />
          Hi-viz
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
