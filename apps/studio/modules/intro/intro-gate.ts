const SEEN_KEY = "coss-vaunt:intro-seen";
/** If the page's JavaScript hasn't started the intro by then (a slow dev compile, a script error), uncover the page. */
const START_DEADLINE_MS = 4000;

/**
 * Runs in `<head>` before the page paints: on the projects page, plays the intro once per browser session and never
 * with reduced motion. It marks `<html data-intro>` so CSS covers the page from the first frame, or hides the intro.
 */
export const INTRO_GATE_SCRIPT = `(function(){var d=document.documentElement;try{var play=location.pathname==="/"&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!sessionStorage.getItem(${JSON.stringify(SEEN_KEY)});d.dataset.intro=play?"play":"skip";if(play)setTimeout(function(){if(d.dataset.intro==="play"&&d.dataset.introStarted===undefined)d.dataset.intro="skip";},${START_DEADLINE_MS});}catch(e){d.dataset.intro="skip";}})();`;

/**
 * Inline beside the gate script rather than in the app's CSS, so the cover's visibility never depends on a build:
 * a stale or missing rule here leaves a black screen.
 */
export const INTRO_GATE_STYLE = `html:not([data-intro="play"]) .studio-intro{display:none}html[data-intro="play"] body{overflow:hidden}html[data-intro="play"] [data-studio-wordmark]{opacity:0}@keyframes studio-intro-hint{from{opacity:0}}`;

/** Tells the gate's deadline that the intro is running, so it leaves the cover up. */
export function markIntroStarted(): void {
  document.documentElement.dataset.introStarted = "";
}

export function markIntroSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked: the intro may play again next load, which is harmless.
  }
  document.documentElement.dataset.intro = "done";
}
