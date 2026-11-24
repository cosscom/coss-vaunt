import type { DiscoveredPage } from "@calcom/product-video/discovery/page-discovery";

export type PageOption = { path: string; label: string };

/** Pages a recording can open, from crawling the app: its navigation first, named as the app links to them. */
export function pageOptionsFrom(pages: readonly DiscoveredPage[]): PageOption[] {
  return pages.map((page) => ({ path: page.path, label: page.label || page.title || page.path }));
}

export function pageMatches(option: PageOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return option.path.toLowerCase().includes(needle) || option.label.toLowerCase().includes(needle);
}
