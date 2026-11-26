import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppIconLab } from "@/modules/lab/app-icon/app-icon-lab";

export const metadata: Metadata = { title: "App icon lab" };

/** Dev-only lab for the app icon; 404 in production. `?from=` is the page to go back to. */
export default async function AppIconLabPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<React.ReactElement> {
  if (process.env.NODE_ENV !== "development") notFound();
  const { from } = await searchParams;
  const back = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/";
  return <AppIconLab back={back} />;
}
