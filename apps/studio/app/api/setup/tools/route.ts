import { toolsStatus } from "@coss/vaunt-engine/setup/tools-status";

export const dynamic = "force-dynamic";

/** Whether Chromium and ffmpeg are ready, for the first-run setup. See ToolsStatus. */
export async function GET(): Promise<Response> {
  return Response.json(await toolsStatus(), { headers: { "Cache-Control": "no-store" } });
}
