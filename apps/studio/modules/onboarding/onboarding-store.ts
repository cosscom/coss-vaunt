import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Whether this machine has been through onboarding: `$XDG_CONFIG_HOME/coss-vaunt/onboarding.json`, next to the AI
 * settings, so it's shared by every project and survives the studio moving port.
 */
function onboardingFile(env: NodeJS.ProcessEnv = process.env): string {
  const configHome = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "coss-vaunt", "onboarding.json");
}

export async function onboardingCompleted(): Promise<boolean> {
  try {
    const saved = JSON.parse(await readFile(onboardingFile(), "utf8")) as { completedAt?: unknown };
    return typeof saved.completedAt === "string";
  } catch {
    return false;
  }
}

export async function markOnboardingCompleted(): Promise<void> {
  const file = onboardingFile();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ completedAt: new Date().toISOString() }, null, 2)}\n`);
}
