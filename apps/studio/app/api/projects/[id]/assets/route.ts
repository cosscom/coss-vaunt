import path from "node:path";
import { withImportTemplates } from "@calcom/product-video/project-store/import-templates";
import { listProjectAssets } from "@calcom/product-video/project-store/project-assets";
import { scanProjectAssets } from "@calcom/product-video/project-store/scan-project-assets";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type AssetsRouteContext = { params: Promise<{ id: string }> };

/** Recordings with their takes, imported files and text clips; thumbnails come from the file route. */
export async function GET(_request: Request, { params }: AssetsRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return new Response("Not found", { status: 404 });
  const projectDir = path.join(STUDIO_ROOT, project.id);
  const scan = await scanProjectAssets(projectDir);
  const assets = await withImportTemplates(projectDir, listProjectAssets(project, scan));
  return Response.json(assets, { headers: { "Cache-Control": "no-store" } });
}
