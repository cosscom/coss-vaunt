import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SignInError, signIn } from "./app-sign-in";

const LOGIN = { username: "demo@example.com", password: "demo-password" };

const page = (body: string) => `<!doctype html><html><body>${body}</body></html>`;
const ONE_STEP = page(`<form method="post" action="/session">
  <input name="email" type="email"><input name="password" type="password"><button>Sign in</button></form>`);
const TWO_STEP = page(`<form method="post" action="/two-step/password">
  <label>Email <input name="email" type="email"></label><button>Continue</button></form>`);
const PASSWORD_STEP = page(`<form method="post" action="/session">
  <input type="hidden" name="email" value="${LOGIN.username}"><input name="password" type="password"><button>Sign in</button></form>`);

/** A tiny app: `/dashboard` needs the session cookie; `variant` picks where its sign-in form lives. */
function startApp(variant: { current: "redirect" | "link" | "path" | "two-step" }): Promise<Server> {
  const server = createServer((request, response) => {
    const send = (html: string, status = 200) =>
      response.writeHead(status, { "content-type": "text/html" }).end(html);
    const url = new URL(request.url ?? "/", "http://app.local");
    if (request.method === "POST" && url.pathname === "/session") {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        const form = new URLSearchParams(body);
        if (form.get("email") !== LOGIN.username || form.get("password") !== LOGIN.password)
          return send(ONE_STEP, 401);
        response.writeHead(303, { location: "/dashboard", "set-cookie": "session=ok; Path=/" }).end();
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/two-step/password") return send(PASSWORD_STEP);
    if (url.pathname === "/dashboard") {
      if (request.headers.cookie?.includes("session=ok")) return send(page("<h1>Dashboard</h1>"));
      if (variant.current === "redirect") return send(ONE_STEP);
      if (variant.current === "link") return send(page(`<a href="/welcome/enter">Log in</a>`));
      if (variant.current === "two-step") return send(TWO_STEP);
      return send(page("<p>Nothing here</p>"));
    }
    if (url.pathname === "/welcome/enter" || (url.pathname === "/login" && variant.current === "path"))
      return send(ONE_STEP);
    send(page("Not found"), 404);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

describe("signIn", { timeout: 60_000 }, () => {
  const variant: { current: "redirect" | "link" | "path" | "two-step" } = { current: "redirect" };
  let server: Server;
  let browser: Browser;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startApp(variant);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser.close();
    server.close();
  });

  const sessionCookie = async (login = LOGIN) => {
    const state = await signIn({ browser, baseUrl, startPath: "/dashboard", login });
    return state?.cookies.find((cookie) => cookie.name === "session")?.value;
  };

  it.each(["redirect", "link", "path", "two-step"] as const)(
    "signs in when the form is found by %s",
    async (kind) => {
      variant.current = kind;
      expect(await sessionCookie()).toBe("ok");
    }
  );

  it("says the login is wrong when the form stays up", async () => {
    variant.current = "redirect";
    await expect(sessionCookie({ ...LOGIN, password: "wrong" })).rejects.toThrow(/check the test login/);
  });

  it("does nothing for a project without a login", async () => {
    expect(await signIn({ browser, baseUrl, startPath: "/dashboard", login: null })).toBeUndefined();
  });

  it("fails clearly when the app has no sign-in form", async () => {
    variant.current = "link";
    await expect(signIn({ browser, baseUrl, startPath: "/missing", login: LOGIN })).rejects.toBeInstanceOf(
      SignInError
    );
  });
});
