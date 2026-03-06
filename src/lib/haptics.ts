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
  | "none";

const makeSinglePulse = (duration: number, description: string) => ({
  description,
  pattern: [{ duration, intensity: 1 }],
});

export const APP_HAPTIC_INPUT_BY_INTENT: Record<
  Exclude<AppHapticIntent, "none">,
  WebHapticInput
> = {
  // Browser haptics are intentionally scoped to direct button-like inputs, so
  // this map only covers the UI-level semantics we currently ship.
  uiSelect: makeSinglePulse(22, "Selection tick"),
  uiToggle: "soft",
  uiConfirm: "medium",
  uiDestructive: "heavy",
  uiError: "error",
};

// Reserved for future semantic intents; intentionally not wired this pass.
export const RESERVED_HAPTIC_PRESETS = {
  warning: "warning",
  nudge: "nudge",
} as const;
