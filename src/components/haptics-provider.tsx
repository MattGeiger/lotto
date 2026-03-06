"use client";

import * as React from "react";
import { useWebHaptics } from "web-haptics/react";

import {
  APP_HAPTIC_INPUT_BY_INTENT,
  APP_NATIVE_HAPTIC_INPUT_BY_INTENT,
  HAPTICS_ENABLED_STORAGE_KEY,
  type AppHapticIntent,
} from "@/lib/haptics";
import { isNativeHapticsPlatform, triggerNativeHaptic } from "@/lib/native-haptics";

type HapticsContextValue = {
  enabled: boolean;
  isNative: boolean;
  setEnabled: (next: boolean) => void;
  trigger: (intent: AppHapticIntent) => void;
};

const noop = () => undefined;

const DEFAULT_CONTEXT_VALUE: HapticsContextValue = {
  enabled: true,
  isNative: false,
  setEnabled: noop,
  trigger: noop,
};

const HapticsContext = React.createContext<HapticsContextValue>(DEFAULT_CONTEXT_VALUE);

export function HapticsProvider({ children }: { children: React.ReactNode }) {
  const { trigger: triggerRawHaptic } = useWebHaptics();
  const [enabled, setEnabled] = React.useState(true);
  const isNative = React.useMemo(() => isNativeHapticsPlatform(), []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(HAPTICS_ENABLED_STORAGE_KEY);
    if (stored === "false") {
      setEnabled(false);
      return;
    }
    if (stored === "true") {
      setEnabled(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HAPTICS_ENABLED_STORAGE_KEY, String(enabled));
  }, [enabled]);

  const handleSetEnabled = React.useCallback((next: boolean) => {
    setEnabled(next);
  }, []);

  const trigger = React.useCallback(
    (intent: AppHapticIntent) => {
      if (!enabled || intent === "none") {
        return;
      }

      if (isNative) {
        const input = APP_NATIVE_HAPTIC_INPUT_BY_INTENT[intent];
        if (!input) {
          return;
        }
        void triggerNativeHaptic(input);
        return;
      }

      const input = APP_HAPTIC_INPUT_BY_INTENT[intent];
      if (!input) {
        return;
      }
      void triggerRawHaptic(input);
    },
    [enabled, isNative, triggerRawHaptic],
  );

  const value = React.useMemo(
    () => ({
      enabled,
      isNative,
      setEnabled: handleSetEnabled,
      trigger,
    }),
    [enabled, handleSetEnabled, isNative, trigger],
  );

  return <HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>;
}

export function useAppHaptics() {
  return React.useContext(HapticsContext);
}
