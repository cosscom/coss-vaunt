import { connectionTestRequestSchema } from "@coss/vaunt-engine/ai/ai-settings";
import { testAiConnection } from "@coss/vaunt-engine/ai/studio-model";

export const dynamic = "force-dynamic";

/** Body: `{ provider }`. Checks the provider answers with its key: `{ ok, models? }` or `{ ok: false, error }`. */
export async function POST(request: Request): Promise<Response> {
  const parsed = connectionTestRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  return Response.json(await testAiConnection(parsed.data.provider));
}
