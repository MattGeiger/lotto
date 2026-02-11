"use client";

import { Eye, Moon, Sun, SunMoon } from "lucide-react";
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
        <Button variant="outline" size="icon" className="relative !h-[3.375rem] !w-[3.375rem]">
          {hiVizEnabled ? (
            <Eye className="size-[1.8rem]" />
          ) : (
            <>
              <Sun className="size-[1.8rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-[1.8rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </>
          )}
          <span className="sr-only">Theme options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem checked={!hiVizEnabled && selectedTheme === "light"} onSelect={() => setBaseTheme("light")}>
          <Sun className="size-4" />
          Light
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={!hiVizEnabled && selectedTheme === "dark"} onSelect={() => setBaseTheme("dark")}>
          <Moon className="size-4" />
          Dark
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={!hiVizEnabled && selectedTheme === "system"} onSelect={() => setBaseTheme("system")}>
          <SunMoon className="size-4" />
          System
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={hiVizEnabled} onSelect={setHiVizTheme}>
          <Eye className="size-4" />
          Hi-viz
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
