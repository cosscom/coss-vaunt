import type { Browser, BrowserContext, Locator, Page } from "playwright";
import type { AppLogin } from "../project-store/project-store";

export type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

/** Where apps usually keep their sign-in page, tried when the scene's own page doesn't show one. */
const SIGN_IN_PATHS = ["/login", "/signin", "/sign-in", "/auth/login", "/auth/signin", "/account/login"];
const PASSWORD_FIELD = 'input[type="password"]';
/** Fields that can only be a username, so a page's search box isn't mistaken for a sign-in form. */
const USERNAME_FIELD = [
  'input[autocomplete~="username"]',
  'input[autocomplete~="email"]',
  'input[type="email"]',
  'input[name*="email" i]',
  'input[name*="user" i]',
  'input[name*="login" i]',
  'input[id*="email" i]',
  'input[id*="user" i]',
].join(", ");
/** Beside a password field, any text input is the username. */
const FORM_USERNAME_FIELD = `${USERNAME_FIELD}, input[type="text"], input:not([type])`;
const SIGN_IN_TEXT = /^\s*(sign|log)\s*in\s*$/i;
const SUBMIT_TEXT = /^\s*(sign\s*in|log\s*in|continue|next|submit)\s*$/i;
const FIELD_WAIT_MS = 5_000;
const PASSWORD_STEP_MS = 15_000;
const SIGNED_IN_MS = 30_000;

export class SignInError extends Error {
  override name = "SignInError";
}

const visible = (locator: Locator) => locator.filter({ visible: true }).first();

async function showsSignInForm(page: Page): Promise<boolean> {
  return visible(page.locator(`${PASSWORD_FIELD}, ${USERNAME_FIELD}`))
    .waitFor({ state: "visible", timeout: FIELD_WAIT_MS })
    .then(
      () => true,
      () => false
    );
}

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
}

/** The scene's page when it asks to sign in, else its sign-in link, else the usual sign-in paths. */
async function findSignInForm(page: Page, baseUrl: string, startPath: string): Promise<boolean> {
  await open(page, new URL(startPath, baseUrl).toString());
  if (await showsSignInForm(page)) return true;
  const link = visible(
    page.getByRole("link", { name: SIGN_IN_TEXT }).or(page.getByRole("button", { name: SIGN_IN_TEXT }))
  );
  if ((await link.count()) > 0) {
    await link.click();
    if (await showsSignInForm(page)) return true;
  }
  for (const pathname of SIGN_IN_PATHS) {
    const response = await page
      .goto(new URL(pathname, baseUrl).toString(), { waitUntil: "load" })
      .catch(() => null);
    if (response && response.status() < 400 && (await showsSignInForm(page))) return true;
  }
  return false;
}

async function submit(page: Page, field: Locator): Promise<void> {
  await field.press("Enter");
  // Forms submit on Enter; an app that handles the button's click alone needs the click.
  const stillThere = await field.waitFor({ state: "hidden", timeout: 2_000 }).then(
    () => false,
    () => true
  );
  if (!stillThere) return;
  const button = visible(
    page
      .locator('button[type="submit"], input[type="submit"]')
      .or(page.getByRole("button", { name: SUBMIT_TEXT }))
  );
  if ((await button.count()) > 0) await button.click().catch(() => undefined);
}

async function fillLogin(page: Page, login: AppLogin): Promise<void> {
  let password = visible(page.locator(PASSWORD_FIELD));
  if ((await password.count()) === 0) {
    // Username first, then a page asking for the password.
    const username = visible(page.locator(USERNAME_FIELD));
    await username.fill(login.username);
    await submit(page, username);
    password = visible(page.locator(PASSWORD_FIELD));
    await password.waitFor({ state: "visible", timeout: PASSWORD_STEP_MS }).catch(() => {
      throw new SignInError(
        "The app asked for the username but never for a password; sign-in by email link or SSO isn't supported"
      );
    });
  } else {
    const form = password.locator("xpath=ancestor::form[1]");
    const scope = (await form.count()) > 0 ? form : page;
    const username = visible(scope.locator(FORM_USERNAME_FIELD));
    if ((await username.count()) > 0) await username.fill(login.username);
  }
  await password.fill(login.password);
  const reloaded = page.waitForEvent("load", { timeout: SIGNED_IN_MS }).catch(() => undefined);
  await submit(page, password);
  const gone = password.waitFor({ state: "hidden", timeout: SIGNED_IN_MS }).then(
    () => true,
    () => false
  );
  // A form that posts and comes back with the password field again was turned down; no need to wait it out.
  const turnedDown = reloaded.then(async () => (await password.count()) === 0);
  const signedIn = await Promise.race([gone, turnedDown]);
  if (!signedIn) {
    throw new SignInError(
      `Signing in as ${login.username} didn't get past the sign-in form; check the test login`
    );
  }
  await page.waitForLoadState("load").catch(() => undefined);
}

/**
 * Signs in to the app with the project's test login and returns the session, or undefined when the project has
 * no login. Finds the form itself: on the scene's page, behind its sign-in link, or at a usual sign-in path.
 */
export async function signIn({
  browser,
  baseUrl,
  startPath,
  login,
}: {
  browser: Browser;
  baseUrl: string;
  startPath: string;
  login: AppLogin | null;
}): Promise<StorageState | undefined> {
  if (!login) return undefined;
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    if (!(await findSignInForm(page, baseUrl, startPath))) {
      throw new SignInError(`Couldn't find a sign-in form at ${baseUrl}`);
    }
    await fillLogin(page, login);
    return await context.storageState();
  } catch (error) {
    if (error instanceof SignInError) throw error;
    throw new SignInError(
      `Couldn't sign in at ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    await context.close();
  }
}
