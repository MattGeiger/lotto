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

export const APP_HAPTIC_PRESET_BY_INTENT: Record<
  Exclude<AppHapticIntent, "none">,
  WebHapticPreset
> = {
  uiSelect: "selection",
  uiToggle: "soft",
  uiConfirm: "medium",
  uiDestructive: "heavy",
  uiError: "error",
  gameContact: "light",
  gameImpact: "rigid",
  gameReward: "success",
  gameFailure: "error",
  queueAlert: "buzz",
};

// Reserved for future semantic intents; intentionally not wired this pass.
export const RESERVED_HAPTIC_PRESETS = {
  warning: "warning",
  nudge: "nudge",
} as const;
