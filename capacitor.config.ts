import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const allowNavigation = serverUrl ? [new URL(serverUrl).origin] : undefined;

const config: CapacitorConfig = {
  appId: "app.williamtemple.lotto",
  appName: "LOTTO",
  webDir: "capacitor-www",
  server: serverUrl
    ? {
        url: serverUrl,
        allowNavigation,
      }
    : undefined,
};

export default config;
