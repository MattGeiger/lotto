export const HAPTICS_ENABLED_STORAGE_KEY = "haptics-enabled";

export type WebHapticPreset =
  | "success"
  | "warning"
  | "error"
  | "light"
  | "medium"
  | "heavy"
  | "soft"
  | "rigid"
  | "selection"
  | "nudge"
  | "buzz";

export type WebHapticVibration = {
  delay?: number;
  duration: number;
  intensity?: number;
};

export type WebHapticInput =
  | WebHapticPreset
  | number
  | number[]
  | WebHapticVibration[]
  | {
      description?: string;
      pattern: WebHapticVibration[];
    };

export type AppHapticIntent =
  | "uiSelect"
  | "uiToggle"
  | "uiConfirm"
  | "uiDestructive"
  | "uiError"
  | "gameContact"
  | "gameImpact"
  | "gameReward"
  | "gameFailure"
  | "queueAlert"
  | "none";

export type NativeImpactStyle = "LIGHT" | "MEDIUM" | "HEAVY";
export type NativeNotificationType = "SUCCESS" | "WARNING" | "ERROR";

export type NativeHapticInput =
  | { type: "selection" }
  | {
      type: "impact";
      style: NativeImpactStyle;
    }
  | {
      type: "notification";
      notificationType: NativeNotificationType;
    }
  | {
      type: "vibrate";
      duration: number;
    };

const makeSinglePulse = (duration: number, description: string) => ({
  description,
  pattern: [{ duration, intensity: 1 }],
});

const makeDoublePulse = (
  firstDuration: number,
  gapDuration: number,
  secondDuration: number,
  description: string,
) => ({
  description,
  pattern: [
    { duration: firstDuration, intensity: 1 },
    { delay: gapDuration, duration: secondDuration, intensity: 1 },
  ],
});

export const APP_HAPTIC_INPUT_BY_INTENT: Record<
  Exclude<AppHapticIntent, "none">,
  WebHapticInput
> = {
  // Mobile hardware often drops the library's shortest presets (for example
  // `selection`/`light`/`rigid`), so we use stronger app-owned patterns here.
  uiSelect: makeSinglePulse(22, "Selection tick"),
  uiToggle: "soft",
  uiConfirm: "medium",
  uiDestructive: "heavy",
  uiError: "error",
  gameContact: makeSinglePulse(24, "Light contact"),
  gameImpact: makeSinglePulse(34, "Arcade impact"),
  gameReward: makeSinglePulse(28, "Reward tap"),
  gameFailure: "error",
  queueAlert: makeDoublePulse(80, 50, 120, "Ticket called alert"),
};

// Capacitor exposes a smaller native haptics vocabulary than web-haptics, so
// intents map to the closest native equivalent rather than a 1:1 preset name.
export const APP_NATIVE_HAPTIC_INPUT_BY_INTENT: Record<
  Exclude<AppHapticIntent, "none">,
  NativeHapticInput
> = {
  uiSelect: { type: "selection" },
  uiToggle: { type: "impact", style: "LIGHT" },
  uiConfirm: { type: "impact", style: "MEDIUM" },
  uiDestructive: { type: "impact", style: "HEAVY" },
  uiError: { type: "notification", notificationType: "ERROR" },
  gameContact: { type: "impact", style: "LIGHT" },
  gameImpact: { type: "impact", style: "MEDIUM" },
  gameReward: { type: "notification", notificationType: "SUCCESS" },
  gameFailure: { type: "notification", notificationType: "ERROR" },
  queueAlert: { type: "vibrate", duration: 500 },
};

// Reserved for future semantic intents; intentionally not wired this pass.
export const RESERVED_HAPTIC_PRESETS = {
  warning: "warning",
  nudge: "nudge",
} as const;
