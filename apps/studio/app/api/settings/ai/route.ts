import {
  aiSettingsUpdateSchema,
  aiSettingsView,
  applyAiSettingsUpdate,
  readAiSettings,
  writeAiSettings,
} from "@coss/vaunt-engine/ai/ai-settings";

export const dynamic = "force-dynamic";

/** Which AI provider and model the studio uses, and how each provider is connected; never the keys themselves. */
export async function GET(): Promise<Response> {
  return Response.json(aiSettingsView(await readAiSettings()));
}

/**
 * Body: `{ provider?, model?, keys?, baseUrl? }`. A provider absent from `keys` keeps its saved key and null removes
 * it; the same for `baseUrl`.
 */
export async function PUT(request: Request): Promise<Response> {
  const parsed = aiSettingsUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const settings = applyAiSettingsUpdate(await readAiSettings(), parsed.data);
  await writeAiSettings(settings);
  return Response.json(aiSettingsView(settings));
}
