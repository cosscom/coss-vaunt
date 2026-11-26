import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/** Where the lab keeps its keeper and the saved rail: next to the other brand marks, so it can be committed. */
const CONFIG_PATH = path.resolve(process.cwd(), "modules/brand/app-icon.config.json");
const MAX_SAVED = 48;

type SavedIcon = { id: string; savedAt: string; config: Record<string, unknown> };
type IconFile = { current: Record<string, unknown> | null; saved: SavedIcon[] };

const notFound = () => new Response("Not found", { status: 404 });
const dev = () => process.env.NODE_ENV === "development";

async function load(): Promise<IconFile> {
  try {
    const parsed = JSON.parse(await readFile(CONFIG_PATH, "utf8")) as Partial<IconFile>;
    return { current: parsed.current ?? null, saved: Array.isArray(parsed.saved) ? parsed.saved : [] };
  } catch {
    return { current: null, saved: [] };
  }
}

/** Dev only: the saved keeper and the rail. */
export async function GET(): Promise<Response> {
  if (!dev()) return notFound();
  return Response.json({ ...(await load()), path: CONFIG_PATH });
}

/** Dev only: `{ config }` becomes the keeper and joins the front of the rail. */
export async function POST(request: Request): Promise<Response> {
  if (!dev()) return notFound();
  const body = (await request.json().catch(() => null)) as { config?: Record<string, unknown> } | null;
  if (!body?.config || typeof body.config !== "object") {
    return Response.json({ error: "Expected { config }" }, { status: 400 });
  }
  const file = await load();
  const entry: SavedIcon = {
    id: `${Date.now().toString(36)}-${String(body.config.seed ?? "")}`,
    savedAt: new Date().toISOString(),
    config: body.config,
  };
  const next: IconFile = { current: body.config, saved: [entry, ...file.saved].slice(0, MAX_SAVED) };
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`);
  return Response.json({ ...next, path: CONFIG_PATH });
}

/** Dev only: `?id=` drops one entry from the rail. */
export async function DELETE(request: Request): Promise<Response> {
  if (!dev()) return notFound();
  const id = new URL(request.url).searchParams.get("id");
  const file = await load();
  const next: IconFile = { ...file, saved: file.saved.filter((entry) => entry.id !== id) };
  await writeFile(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`);
  return Response.json({ ...next, path: CONFIG_PATH });
}
