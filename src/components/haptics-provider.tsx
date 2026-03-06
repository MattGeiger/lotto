"use client";

import * as React from "react";
import { useWebHaptics } from "web-haptics/react";

import { APP_HAPTIC_INPUT_BY_INTENT, type AppHapticIntent } from "@/lib/haptics";

type HapticsContextValue = {
  trigger: (intent: AppHapticIntent) => void;
};

const noop = () => undefined;

const DEFAULT_CONTEXT_VALUE: HapticsContextValue = {
  trigger: noop,
};

const HapticsContext = React.createContext<HapticsContextValue>(DEFAULT_CONTEXT_VALUE);

export function HapticsProvider({ children }: { children: React.ReactNode }) {
  const { trigger: triggerRawHaptic } = useWebHaptics();

  const trigger = React.useCallback(
    (intent: AppHapticIntent) => {
      if (intent === "none") {
        return;
      }

      const input = APP_HAPTIC_INPUT_BY_INTENT[intent];
      if (!input) {
        return;
      }

      void triggerRawHaptic(input);
    },
    [triggerRawHaptic],
  );

  const value = React.useMemo(() => ({ trigger }), [trigger]);

  return <HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>;
}

export function useAppHaptics() {
  return React.useContext(HapticsContext);
}
