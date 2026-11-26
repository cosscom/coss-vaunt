import { STUDIO_COPY } from "../studio-copy";

const copy = STUDIO_COPY.settings;

export const SETTINGS_SECTIONS = ["general", "appearance", "ai", "keybindings", "about"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

type NavGroup = { label: string | null; sections: readonly SettingsSection[] };

/** The nav's groups, in order; the first has no heading. */
export const SETTINGS_NAV: readonly NavGroup[] = [
  { label: null, sections: ["general", "appearance"] },
  { label: copy.groups.studio, sections: ["ai", "keybindings"] },
  { label: copy.groups.app, sections: ["about"] },
];

/** What search matches besides a section's name: the titles of the rows in it. */
const SEARCH_TERMS: Record<SettingsSection, readonly string[]> = {
  general: [
    copy.general.projectsFolder,
    copy.general.settingsFile,
    copy.general.replay,
    copy.general.hoverSelect,
    copy.general.hoverDelay,
    "folder",
    "storage",
    "hover",
    "select",
  ],
  appearance: [
    copy.appearance.themeTitle,
    copy.appearance.glass,
    copy.appearance.tint,
    "dark",
    "light",
    "transparency",
    "vibrancy",
    "opacity",
  ],
  ai: [
    copy.ai.activeModel,
    copy.ai.connections,
    copy.ai.baseUrl,
    "key",
    "api",
    "provider",
    "ollama",
    "lm studio",
    ...Object.values(copy.ai.providers),
  ],
  keybindings: ["shortcuts", "keyboard", "keys"],
  about: [copy.about.version, "version"],
};

/** The sections whose name or rows match every word of the query, in nav order. */
export function searchSettings(query: string): SettingsSection[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...SETTINGS_SECTIONS];
  return SETTINGS_SECTIONS.filter((section) => {
    const haystack = [copy.sections[section], ...SEARCH_TERMS[section]].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
