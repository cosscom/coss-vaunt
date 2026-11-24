import {
  aiSettingsUpdateSchema,
  aiSettingsView,
  applyAiSettingsUpdate,
  readAiSettings,
  writeAiSettings,
} from "@calcom/product-video/ai/ai-settings";

export const dynamic = "force-dynamic";

/** Which AI provider and model the studio uses, and where each key comes from; never the keys themselves. */
export async function GET(): Promise<Response> {
  return Response.json(aiSettingsView(await readAiSettings()));
}

/** Body: `{ provider, model?, apiKey? }`; an absent key keeps the saved one and null removes it. */
export async function PUT(request: Request): Promise<Response> {
  const parsed = aiSettingsUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const settings = applyAiSettingsUpdate(await readAiSettings(), parsed.data);
  await writeAiSettings(settings);
  return Response.json(aiSettingsView(settings));
}
