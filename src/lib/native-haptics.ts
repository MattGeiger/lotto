"use client";

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

import type { NativeHapticInput } from "@/lib/haptics";

export function isNativeHapticsPlatform() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics");
}

export async function triggerNativeHaptic(input: NativeHapticInput) {
  try {
    switch (input.type) {
      case "selection":
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        await Haptics.selectionEnd();
        return;
      case "impact":
        await Haptics.impact({
          style:
            input.style === "LIGHT"
              ? ImpactStyle.Light
              : input.style === "MEDIUM"
                ? ImpactStyle.Medium
                : ImpactStyle.Heavy,
        });
        return;
      case "notification":
        await Haptics.notification({
          type:
            input.notificationType === "SUCCESS"
              ? NotificationType.Success
              : input.notificationType === "WARNING"
                ? NotificationType.Warning
                : NotificationType.Error,
        });
        return;
      case "vibrate":
        await Haptics.vibrate({ duration: input.duration });
        return;
    }
  } catch (error) {
    console.warn("[haptics] Native trigger failed", error);
  }
}
