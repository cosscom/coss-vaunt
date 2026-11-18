import { APP_MAP } from "@calcom/product-video/catalogues/routes/app-map";
import { ROUTE_CATALOGUE } from "@calcom/product-video/catalogues/routes/route-catalogue";

export type PageOption = { path: string; label: string };

/** Pages a recording can open: the tuned routes first, then the rest of the app map. */
export const PAGE_OPTIONS: readonly PageOption[] = (() => {
  const options = new Map<string, string>();
  for (const entry of ROUTE_CATALOGUE) options.set(entry.route, entry.label);
  for (const page of APP_MAP) {
    if (!options.has(page.path)) options.set(page.path, page.name);
    for (const subpage of page.subpages) if (!options.has(subpage.path)) options.set(subpage.path, page.name);
  }
  return [...options].map(([path, label]) => ({ path, label }));
})();

export function pageMatches(option: PageOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return option.path.toLowerCase().includes(needle) || option.label.toLowerCase().includes(needle);
}
