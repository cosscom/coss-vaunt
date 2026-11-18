import { type ScriptedReplyFixture, scriptedReplyFixtureSchema } from "../../recording/scripted-reply";
import bookSandyOneOnOne from "./fixtures/book-sandy-one-on-one.json";

export type RouteTarget = { name: string; selector: string; description: string };

export type RouteCatalogueEntry = {
  route: string;
  label: string;
  description: string;
  /** Stable selectors a storyboard may move to, click or type into. */
  targets: RouteTarget[];
  /** Elements that differ between visits (random suggestions and the like), hidden while recording. */
  hiddenSelectors: string[];
  viewport: { width: number; height: number };
  /** A seeded synthetic user; recording never signs in as anyone else. */
  login: { email: string; password: string };
  /** The user's profile timezone, so the app doesn't ask to change it. */
  timezone: string;
  /** Page clock at the start of a recording. */
  clockTime: string;
  replyFixture: ScriptedReplyFixture | null;
};

export const DEFAULT_RECORDING_VIEWPORT = { width: 1440, height: 900 };
const SYNTHETIC_LOGIN = { email: "owner1-acme@example.com", password: "owner1-acme" };
const SYNTHETIC_TIMEZONE = "Europe/Sofia";
const RECORDING_CLOCK_TIME = "2026-11-18T08:00:00.000Z";

export const ROUTE_CATALOGUE: RouteCatalogueEntry[] = [
  {
    route: "/home",
    label: "Home · Main Agent",
    description:
      "The Main Agent chat on the home page. Type a request in the composer and send it; the real agent replies, looking things up as it needs to, and a booking request stops on an approval card.",
    targets: [
      { name: "composer", selector: "[data-testid=ai-chat-input]", description: "The chat composer" },
      { name: "send", selector: "[data-testid=ai-chat-send]", description: "The send button" },
      {
        name: "booking approval",
        selector: "[data-testid=ai-approval-create_booking]",
        description: "The approval card for the booking, once the reply asks for it",
      },
      { name: "approve", selector: "[data-testid=ai-approve]", description: "Approve on the approval card" },
      { name: "reply", selector: "[data-testid=agent-message-assistant]", description: "The agent's reply" },
      {
        name: "bookings link",
        selector: 'a[href="/bookings/upcoming"]',
        description: "Bookings in the sidebar; opens the upcoming bookings list",
      },
    ],
    hiddenSelectors: ["[data-main-agent-page] .z-10 > .flex-wrap.justify-center"],
    viewport: DEFAULT_RECORDING_VIEWPORT,
    login: SYNTHETIC_LOGIN,
    timezone: SYNTHETIC_TIMEZONE,
    clockTime: RECORDING_CLOCK_TIME,
    replyFixture: scriptedReplyFixtureSchema.parse(bookSandyOneOnOne),
  },
  {
    route: "/bookings/upcoming",
    label: "Bookings · Upcoming",
    description:
      "The bookings page, listing upcoming bookings. A toggle in the header switches between the list and a calendar of the week's bookings.",
    targets: [
      {
        name: "calendar view",
        selector: '[aria-label="Calendar view"]',
        description: "Switches to the calendar view",
      },
      { name: "list view", selector: '[aria-label="List view"]', description: "Switches back to the list" },
    ],
    hiddenSelectors: [],
    viewport: DEFAULT_RECORDING_VIEWPORT,
    login: SYNTHETIC_LOGIN,
    timezone: SYNTHETIC_TIMEZONE,
    clockTime: RECORDING_CLOCK_TIME,
    replyFixture: null,
  },
];

/** The tuned entry for a clip's route; a query string or hash doesn't change which page it is. */
export function findRouteEntry(route: string): RouteCatalogueEntry | null {
  const pathname = route.split(/[?#]/)[0];
  return ROUTE_CATALOGUE.find((entry) => entry.route === pathname) ?? null;
}

/** A path inside the app, like `/settings/my-account/profile`: no scheme, host or `//`, no whitespace. */
export function isAppPath(route: string): boolean {
  if (!/^\/(?!\/)[^\s\\]*$/.test(route)) return false;
  try {
    return new URL(route, "http://app.invalid").origin === "http://app.invalid";
  } catch {
    return false;
  }
}

/**
 * The catalogue's entry for a route, or the defaults any page of the app records with: the same synthetic user,
 * timezone, clock and viewport, and no targets, hidden elements or scripted reply. Null when it isn't an app path.
 */
export function routeEntryFor(route: string): RouteCatalogueEntry | null {
  if (!isAppPath(route)) return null;
  const tuned = findRouteEntry(route);
  if (tuned) return tuned;
  const pathname = route.split(/[?#]/)[0];
  return {
    route: pathname,
    label: pathname,
    description: "",
    targets: [],
    hiddenSelectors: [],
    viewport: DEFAULT_RECORDING_VIEWPORT,
    login: SYNTHETIC_LOGIN,
    timezone: SYNTHETIC_TIMEZONE,
    clockTime: RECORDING_CLOCK_TIME,
    replyFixture: null,
  };
}
