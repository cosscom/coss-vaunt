/** A main page of the app, how to reach it, and its subpages; checked against the app's navigation in tests. */
export type AppPage = {
  name: string;
  path: string;
  /** Where it is in the sidebar. */
  reach: string;
  about: string;
  subpages: Array<{ path: string; about: string }>;
};

export const APP_MAP: AppPage[] = [
  {
    name: "Home",
    path: "/home",
    reach: "sidebar, first item",
    about: "the Main Agent chat: a composer to ask the agent to schedule things",
    subpages: [],
  },
  {
    name: "Links",
    path: "/links",
    reach: "sidebar",
    about: "event types (booking links); clicking one opens its editor at /event-types/<id>",
    subpages: [],
  },
  {
    name: "Bookings",
    path: "/bookings/upcoming",
    reach: "sidebar",
    about: "the bookings list, with a list/calendar view toggle in the header",
    subpages: [
      { path: "/bookings/unconfirmed", about: "awaiting confirmation" },
      { path: "/bookings/recurring", about: "recurring series" },
      { path: "/bookings/past", about: "past bookings" },
      { path: "/bookings/cancelled", about: "cancelled bookings" },
    ],
  },
  {
    name: "Availability",
    path: "/availability",
    reach: "sidebar",
    about: "working-hours schedules; clicking one opens it at /availability/<id> to edit days and hours",
    subpages: [{ path: "/availability/troubleshoot", about: "the availability troubleshooter" }],
  },
  {
    name: "Organization",
    path: "/members",
    reach: "sidebar, expands",
    about: "organization members",
    subpages: [{ path: "/teams", about: "teams" }],
  },
  { name: "Contacts", path: "/contacts", reach: "sidebar", about: "people you've met with", subpages: [] },
  {
    name: "Apps",
    path: "/apps",
    reach: "sidebar, expands",
    about: "the app store",
    subpages: [{ path: "/apps/installed/calendar", about: "installed calendar apps" }],
  },
  { name: "Routing", path: "/routing", reach: "sidebar, under More", about: "routing forms", subpages: [] },
  {
    name: "Workflows",
    path: "/workflows",
    reach: "sidebar, under More",
    about: "automated reminders",
    subpages: [],
  },
  {
    name: "Insights",
    path: "/insights",
    reach: "sidebar, under More, expands",
    about: "booking analytics charts",
    subpages: [
      { path: "/insights/routing", about: "routing analytics" },
      { path: "/insights/out-of-office", about: "out-of-office analytics" },
    ],
  },
  {
    name: "Settings",
    path: "/settings",
    reach: "sidebar, bottom; also the avatar menu",
    about: "account settings, opening on the profile",
    subpages: [
      {
        path: "/settings/my-account/profile",
        about: "name, username, bio and avatar, with an Update button",
      },
      { path: "/settings/my-account/general", about: "language, timezone, time format, week start" },
      { path: "/settings/my-account/calendars", about: "connected calendars" },
      { path: "/settings/my-account/conferencing", about: "video conferencing apps" },
      { path: "/settings/my-account/appearance", about: "booking page theme and brand colours" },
      { path: "/settings/my-account/out-of-office", about: "out-of-office entries" },
      { path: "/settings/security/password", about: "change password" },
      { path: "/settings/security/two-factor-auth", about: "two-factor authentication" },
    ],
  },
];

/** The map as compact lines for a planning prompt. */
export function appMapLines(map: readonly AppPage[] = APP_MAP): string {
  return map
    .map((page) => {
      const subpages = page.subpages.map((sub) => `\n    - ${sub.path}: ${sub.about}`).join("");
      return `- ${page.name} ${page.path} (${page.reach}): ${page.about}${subpages}`;
    })
    .join("\n");
}
