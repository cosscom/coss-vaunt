import {
  appearanceOf,
  appearanceSchema,
  readStudioSettings,
  updateStudioSettings,
} from "@coss/vaunt-engine/settings/studio-settings";

export const dynamic = "force-dynamic";

/** How the desktop window looks: `{ glass, tint }`. Saved with the AI settings, so it holds across ports. */
export async function GET(): Promise<Response> {
  return Response.json(appearanceOf(await readStudioSettings()));
}

/** Body: `{ glass?, tint? }`, merged into what's saved. */
export async function PUT(request: Request): Promise<Response> {
  const parsed = appearanceSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const settings = await updateStudioSettings((current) => ({
    ...current,
    appearance: { ...appearanceOf(current), ...parsed.data },
  }));
  return Response.json(appearanceOf(settings));
}
