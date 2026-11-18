import { notFound } from "next/navigation";
import { studioProjectStore } from "@/modules/projects/studio-project-store";
import { RenderView } from "@/modules/render/render-view";

type RenderPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ width?: string; height?: string }>;
};

export const dynamic = "force-dynamic";

/** The composition alone at the output's pixel size, for the exporter's headless browser. */
export default async function RenderPage({
  params,
  searchParams,
}: RenderPageProps): Promise<React.ReactElement> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const project = await studioProjectStore.get(id);
  const width = Number(query.width);
  const height = Number(query.height);
  if (!project || !(width > 0) || !(height > 0)) notFound();
  return <RenderView height={height} project={project} width={width} />;
}
