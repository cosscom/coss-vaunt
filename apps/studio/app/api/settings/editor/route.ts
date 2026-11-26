import {
  editorPreferencesOf,
  editorPreferencesSchema,
  readStudioSettings,
  updateStudioSettings,
} from "@coss/vaunt-engine/settings/studio-settings";

export const dynamic = "force-dynamic";

/** How the editor behaves: `{ hoverSelect, hoverSelectDelayMs }`. Saved with the other studio settings. */
export async function GET(): Promise<Response> {
  return Response.json(editorPreferencesOf(await readStudioSettings()));
}

/** Body: `{ hoverSelect?, hoverSelectDelayMs? }`, merged into what's saved. */
export async function PUT(request: Request): Promise<Response> {
  const parsed = editorPreferencesSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const settings = await updateStudioSettings((current) => ({
    ...current,
    editor: { ...editorPreferencesOf(current), ...parsed.data },
  }));
  return Response.json(editorPreferencesOf(settings));
}
