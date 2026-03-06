import { spawnSync } from "node:child_process";

const [urlArg, ...extraArgs] = process.argv.slice(2);
const serverUrl = urlArg || process.env.CAPACITOR_SERVER_URL || "https://williamtemple.app";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["cap", "sync", ...extraArgs],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CAPACITOR_SERVER_URL: serverUrl,
    },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
