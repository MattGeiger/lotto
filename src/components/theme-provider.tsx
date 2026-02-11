"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

const CONTRAST_STORAGE_KEY = "contrast-mode";
const HI_VIZ_CLASS = "hi-viz";

export type ContrastMode = "default" | "hi-viz";

type ContrastModeContextValue = {
  contrastMode: ContrastMode;
  setContrastMode: (mode: ContrastMode) => void;
};

const ContrastModeContext = React.createContext<ContrastModeContextValue | undefined>(undefined);

function applyContrastMode(mode: ContrastMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(HI_VIZ_CLASS, mode === "hi-viz");
}

function ContrastModeProvider({ children }: { children: React.ReactNode }) {
  const [contrastMode, setContrastModeState] = React.useState<ContrastMode>("default");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CONTRAST_STORAGE_KEY);
    setContrastModeState(stored === "hi-viz" ? "hi-viz" : "default");
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    applyContrastMode(contrastMode);
    if (contrastMode === "default") {
      window.localStorage.removeItem(CONTRAST_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CONTRAST_STORAGE_KEY, contrastMode);
  }, [contrastMode]);

  const setContrastMode = React.useCallback((mode: ContrastMode) => {
    setContrastModeState(mode);
  }, []);

  const value = React.useMemo(
    () => ({ contrastMode, setContrastMode }),
    [contrastMode, setContrastMode],
  );

  return <ContrastModeContext.Provider value={value}>{children}</ContrastModeContext.Provider>;
}

export function useContrastMode() {
  const context = React.useContext(ContrastModeContext);
  if (!context) {
    throw new Error("useContrastMode must be used within ThemeProvider");
  }
  return context;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      <ContrastModeProvider>{children}</ContrastModeProvider>
    </NextThemesProvider>
  );
}
