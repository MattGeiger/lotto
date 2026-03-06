"use client";

import * as React from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { useWebHaptics } from "web-haptics/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const HAPTIC_PRESETS = [
  { name: "Success", pattern: "success", description: "Positive completion notification." },
  { name: "Warning", pattern: "warning", description: "Cautionary notification." },
  { name: "Error", pattern: "error", description: "Failure notification." },
  { name: "Light", pattern: "light", description: "Small impact tap." },
  { name: "Medium", pattern: "medium", description: "Medium impact tap." },
  { name: "Heavy", pattern: "heavy", description: "Strong impact tap." },
  { name: "Soft", pattern: "soft", description: "Soft impact tap." },
  { name: "Rigid", pattern: "rigid", description: "Sharp rigid impact tap." },
  { name: "Selection", pattern: "selection", description: "Selection change tick." },
  { name: "Nudge", pattern: "nudge", description: "Strong tap followed by a softer tap." },
  { name: "Buzz", pattern: "buzz", description: "Long continuous vibration." },
] as const;

type HapticPresetDefinition = (typeof HAPTIC_PRESETS)[number];

const NATIVE_HAPTIC_TESTS = [
  {
    name: "Impact Light",
    description: "Capacitor impact feedback with light mass.",
    trigger: () => Haptics.impact({ style: ImpactStyle.Light }),
  },
  {
    name: "Impact Medium",
    description: "Capacitor impact feedback with medium mass.",
    trigger: () => Haptics.impact({ style: ImpactStyle.Medium }),
  },
  {
    name: "Impact Heavy",
    description: "Capacitor impact feedback with heavy mass.",
    trigger: () => Haptics.impact({ style: ImpactStyle.Heavy }),
  },
  {
    name: "Notification Success",
    description: "Capacitor success notification feedback.",
    trigger: () => Haptics.notification({ type: NotificationType.Success }),
  },
  {
    name: "Notification Warning",
    description: "Capacitor warning notification feedback.",
    trigger: () => Haptics.notification({ type: NotificationType.Warning }),
  },
  {
    name: "Notification Error",
    description: "Capacitor error notification feedback.",
    trigger: () => Haptics.notification({ type: NotificationType.Error }),
  },
  {
    name: "Selection Tick",
    description: "Capacitor selection feedback sequence.",
    trigger: async () => {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    },
  },
  {
    name: "Vibrate 500ms",
    description: "Capacitor vibrate API with a 500ms duration.",
    trigger: () => Haptics.vibrate({ duration: 500 }),
  },
] as const;

export default function HapticsPage() {
  const { trigger, cancel, isSupported } = useWebHaptics();
  const isNative = React.useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics"),
    [],
  );
  const [lastTriggered, setLastTriggered] = React.useState<string | null>(null);

  const handleTrigger = React.useCallback(
    async (preset: HapticPresetDefinition) => {
      setLastTriggered(preset.name);
      await trigger(preset.pattern);
    },
    [trigger],
  );

  const handleNativeTrigger = React.useCallback(
    async (name: string, run: () => Promise<void>) => {
      setLastTriggered(name);
      await run();
    },
    [],
  );

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card>
          <CardHeader className="gap-3">
            <CardTitle className="text-3xl">Haptics Test Page</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              This page bypasses the app&apos;s semantic haptics layer and triggers the raw
              `web-haptics` library presets directly. Tap each button and note which ones
              produce a vibration on your device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Platform:</span>{" "}
              {isNative ? "Capacitor native shell with native haptics available." : "Browser web path."}
            </p>
            <p>
              <span className="font-medium text-foreground">Library support:</span>{" "}
              {isSupported ? "navigator.vibrate is available on this device/browser." : "navigator.vibrate is not available on this device/browser."}
            </p>
            <p>
              <span className="font-medium text-foreground">Last triggered:</span>{" "}
              {lastTriggered ?? "None yet"}
            </p>
            <p>These are all built-in preset names currently exposed by `web-haptics`.</p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => cancel()}>
                Stop Current Vibration
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HAPTIC_PRESETS.map((preset) => (
            <Card key={preset.pattern} className="h-full">
              <CardHeader className="gap-2">
                <CardTitle className="text-xl">{preset.name}</CardTitle>
                <CardDescription>{preset.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex h-full flex-col justify-between gap-4">
                <code className="rounded-md bg-muted px-3 py-2 text-sm">{preset.pattern}</code>
                <Button type="button" className="w-full" onClick={() => void handleTrigger(preset)}>
                  Trigger {preset.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        {isNative ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Capacitor Native Haptics</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                These buttons bypass `web-haptics` and hit the Capacitor Haptics plugin
                directly inside the native shell.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {NATIVE_HAPTIC_TESTS.map((test) => (
                <Card key={test.name} className="h-full">
                  <CardHeader className="gap-2">
                    <CardTitle className="text-xl">{test.name}</CardTitle>
                    <CardDescription>{test.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col justify-end gap-4">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => void handleNativeTrigger(test.name, test.trigger)}
                    >
                      Trigger {test.name}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
