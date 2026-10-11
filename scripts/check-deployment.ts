/**
 * Pre-flight check for a deployed demo (see apps/server/src/deploy-check.ts).
 *
 *   npm run check:deploy -- --demo https://your-demo.vercel.app --server https://your-api.example.com [--dashboard https://your-dashboard.vercel.app]
 *
 * The addresses can also come from DEMO_URL, SERVER_URL and DASHBOARD_URL (e.g. in your .env).
 * Exit code 1 if anything must be fixed.
 */
import { runChecks, summarize } from "../apps/server/src/deploy-check.ts";

// Read ./.env if there is one (Node 20.12+). Without it, pass --demo / --server on the command line.
try {
  (process as unknown as { loadEnvFile?: () => void }).loadEnvFile?.();
} catch {
  /* no .env file: fine */
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const demoUrl = arg("demo") || process.env.DEMO_URL || "";
  const serverUrl = arg("server") || process.env.SERVER_URL || "";
  const dashboardUrl = arg("dashboard") || process.env.DASHBOARD_URL || undefined;

  if (!demoUrl || !serverUrl) {
    console.error("Usage: npm run check:deploy -- --demo <demo-site-url> --server <patchwork-server-url> [--dashboard <dashboard-url>]");
    return 2;
  }

  console.log(`Checking demo ${demoUrl}\n         server ${serverUrl}${dashboardUrl ? `\n         dashboard ${dashboardUrl}` : ""}\n`);
  const { fails, text } = summarize(await runChecks({ demoUrl, serverUrl, dashboardUrl }));
  console.log(text);
  return fails ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error("check:deploy crashed:", err);
    process.exit(3);
  },
);
