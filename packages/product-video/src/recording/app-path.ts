/** A path inside the app, like `/settings/profile`: no scheme, host or `//`, no whitespace. */
export function isAppPath(route: string): boolean {
  if (!/^\/(?!\/)[^\s\\]*$/.test(route)) return false;
  try {
    return new URL(route, "http://app.invalid").origin === "http://app.invalid";
  } catch {
    return false;
  }
}
