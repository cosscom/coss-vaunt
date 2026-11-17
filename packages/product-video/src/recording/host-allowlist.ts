const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Recording signs in and drives the app, so it only ever runs against a local dev server. */
export function isAllowedRecordingHost(baseUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase();
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

export function assertAllowedRecordingHost(baseUrl: string): void {
  if (!isAllowedRecordingHost(baseUrl)) {
    throw new Error(
      `Refusing to record against ${baseUrl}: only localhost, 127.0.0.1, [::1] and *.localhost are allowed`
    );
  }
}
