import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { assertAllowedRecordingHost } from "../recording/host-allowlist";

const runFile = promisify(execFile);
const COMMAND_TIMEOUT_MS = 60_000;
const ACTION_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_CHARS = 8_000;

const binary = path.join(
  path.dirname(createRequire(import.meta.url).resolve("agent-browser/package.json")),
  "bin/agent-browser.js"
);

type Reply = { success: boolean; data: Record<string, unknown> | null; error: string | null };

export class AgentBrowserError extends Error {}

/**
 * One headless agent-browser session against the local app. Commands run through `execFile`, never a shell, and
 * navigation is limited to `baseUrl`'s origin, which must pass the recording host allowlist.
 */
export class AgentBrowserSession {
  private readonly origin: string;

  constructor(
    private readonly options: {
      session: string;
      baseUrl: string;
      /** Playwright storage state of the signed-in synthetic user. */
      statePath: string;
      initScriptPath: string;
      viewport: { width: number; height: number };
      /** The synthetic user's profile timezone, so the app doesn't ask to switch to the machine's. */
      timezone: string;
    }
  ) {
    assertAllowedRecordingHost(options.baseUrl);
    this.origin = new URL(options.baseUrl).origin;
  }

  private async run(args: string[]): Promise<Record<string, unknown>> {
    const flags = [
      "--session",
      this.options.session,
      "--state",
      this.options.statePath,
      "--init-script",
      this.options.initScriptPath,
      "--no-webmcp",
      "--content-boundaries",
      "--max-output",
      String(MAX_OUTPUT_CHARS),
      "--idle-timeout",
      "10m",
      "--json",
    ];
    let stdout: string;
    try {
      ({ stdout } = await runFile(process.execPath, [binary, ...flags, ...args], {
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          AGENT_BROWSER_DEFAULT_TIMEOUT: String(ACTION_TIMEOUT_MS),
          TZ: this.options.timezone,
        },
      }));
    } catch (error) {
      const output = (error as { stdout?: string }).stdout;
      if (!output)
        throw new AgentBrowserError(`agent-browser ${args[0]} failed: ${(error as Error).message}`);
      stdout = output;
    }
    const reply = JSON.parse(stdout.trim().split("\n").at(-1) ?? "{}") as Reply;
    if (!reply.success) throw new AgentBrowserError(reply.error ?? `agent-browser ${args[0]} failed`);
    return reply.data ?? {};
  }

  /** The URL for an app path, refusing anything that would leave the local app. */
  urlFor(pathname: string): string {
    const url = new URL(pathname, this.origin);
    if (url.origin !== this.origin) throw new AgentBrowserError(`${pathname} is outside ${this.origin}`);
    assertAllowedRecordingHost(url.toString());
    return url.toString();
  }

  async open(pathname: string): Promise<{ url: string; title: string }> {
    const data = await this.run(["open", this.urlFor(pathname)]);
    await this.run([
      "set",
      "viewport",
      String(this.options.viewport.width),
      String(this.options.viewport.height),
    ]);
    await this.run(["wait", "--load", "networkidle"]).catch(() => undefined);
    return { url: String(data.url ?? ""), title: String(data.title ?? "") };
  }

  async snapshot(selector?: string): Promise<string> {
    const data = await this.run(["snapshot", "-i", "-c", ...(selector ? ["-s", selector] : [])]);
    return String(data.snapshot ?? "");
  }

  async click(target: string): Promise<void> {
    await this.run(["click", target]);
  }

  async hover(target: string): Promise<void> {
    await this.run(["hover", target]);
  }

  async fill(target: string, text: string): Promise<void> {
    await this.run(["fill", target, text]);
  }

  /** Types with real key events into `target`, like the recorder. */
  async type(target: string, text: string): Promise<void> {
    await this.run(["type", target, text]);
  }

  async press(key: string): Promise<void> {
    await this.run(["press", key]);
  }

  async wait(ms: number): Promise<void> {
    await this.run(["wait", String(Math.round(ms))]);
  }

  async text(target: string): Promise<string> {
    return String((await this.run(["get", "text", target])).text ?? "");
  }

  async attribute(target: string, name: string): Promise<string | null> {
    const value = (await this.run(["get", "attr", target, name]).catch(() => ({ value: null }))).value;
    return typeof value === "string" ? value : null;
  }

  async count(selector: string): Promise<number> {
    return Number((await this.run(["get", "count", selector])).count ?? 0);
  }

  async visible(selector: string): Promise<boolean> {
    const data = await this.run(["is", "visible", selector]).catch(() => ({ visible: false }));
    return data.visible === true;
  }

  async close(): Promise<void> {
    await this.run(["close"]).catch(() => undefined);
  }
}
