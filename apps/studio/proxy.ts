import { type NextRequest, NextResponse } from "next/server";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Whether a `Host` value (`name:port`) or an `Origin` URL names this machine by a loopback name. */
function isLoopback(value: string): boolean {
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(value.includes("://") ? value : `http://${value}`).hostname);
  } catch {
    return false;
  }
}

/**
 * Under `vaunt start` (which sets `VAUNT_LOCAL_ONLY`), answers only requests addressed to a loopback name and, when
 * the browser says which page sent them, sent from a loopback page. That keeps a website that rebinds its domain to
 * 127.0.0.1, or posts to the studio across sites, away from the projects, saved logins and AI key.
 */
export function proxy(request: NextRequest): NextResponse {
  if (!process.env.VAUNT_LOCAL_ONLY) return NextResponse.next();
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host || !isLoopback(host) || (origin !== null && !isLoopback(origin)))
    return new NextResponse("Forbidden", { status: 403 });
  return NextResponse.next();
}
