/**
 * Which of the page's requests may reach the app while exploring, rehearsing and recording. Reads go through;
 * everything that could write is answered in the page instead, so runs are repeatable and the local database
 * is never touched. Both functions are serialised into the page with `toString()`: no imports, no closures.
 */
export type RequestKind =
  /** GET, HEAD and OPTIONS, and tRPC queries the app POSTs: sent as normal. */
  | "read"
  | "trpc-query"
  /** Faked: answered with the input echoed back as the procedure's result. */
  | "trpc-mutation"
  /** Faked: any other non-GET under `/api/`, answered `{}`. */
  | "api-write"
  /** Faked: a Next.js server action, answered with an empty body; the page may not update. */
  | "server-action"
  /** Faked: a non-GET to another origin (analytics, error reporting), answered `{}`. */
  | "external-write"
  /** Blocked and logged: a same-origin non-GET outside `/api/` that isn't a server action. */
  | "unclassified";

export function classifyRequest({
  method,
  url,
  pageOrigin,
  serverAction,
}: {
  method: string;
  url: string;
  pageOrigin: string;
  serverAction: boolean;
}): RequestKind {
  const verb = method.toUpperCase();
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return "read";
  const parsed = new URL(url, pageOrigin);
  if (parsed.origin !== pageOrigin) return "external-write";
  if (serverAction) return "server-action";
  const trpc = parsed.pathname.match(/^\/api\/trpc\/([^/]+)\/([^/]+)$/);
  if (trpc) {
    // Queries carrying filters or typed searches are POSTed too; their procedures read, by name or by router.
    const readName = /^(get|list|search|find|fetch|count|check|has|is)([A-Z]|$)|Summaries$/;
    const procedures = decodeURIComponent(trpc[2]).split(",");
    const reads =
      trpc[1] === "insights" || procedures.every((name) => readName.test(name.split(".").pop() ?? ""));
    return reads ? "trpc-query" : "trpc-mutation";
  }
  if (parsed.pathname.startsWith("/api/")) return "api-write";
  return "unclassified";
}

/** A tRPC success response that returns each call's own superjson input as its result. */
export function fakeTrpcResponse({
  body,
  batch,
  calls,
}: {
  body: string;
  batch: boolean;
  /** Procedures in the batch: a call with no input has no entry in the body but still needs a result. */
  calls: number;
}): string {
  let input: unknown = null;
  try {
    input = JSON.parse(body || "null");
  } catch {
    input = null;
  }
  const result = (value: unknown) => ({
    result: { data: value && typeof value === "object" && "json" in value ? value : { json: null } },
  });
  if (!batch) return JSON.stringify(result(input));
  const inputs = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return JSON.stringify(Array.from({ length: calls }, (_, index) => result(inputs[String(index)])));
}
