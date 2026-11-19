import { BLOCKER, finding } from "../check.mjs";

/**
 * Browser checks. These drive a real page in Chromium via Playwright.
 *
 * They exist because the three things a reader finds most credible are exactly the three
 * static analysis cannot do: whether the game throws on load, whether pressing a key does
 * anything, and whether the end states are reachable. Grep can see that the string
 * "gameOver" appears. Only a browser can see that it is ever shown.
 *
 * Playwright is imported lazily, so the static suite runs with zero dependencies and this
 * half is additive rather than a tax on every run.
 */

async function launch() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright is not installed. Run `npm install` then `npx playwright install chromium`, " +
        "or run only the static suite with `game-qa static`.",
    );
  }
  return chromium.launch();
}

/** Opens a page, collects everything the console and the runtime complain about. */
export async function openGame(entryUrl, { timeout = 15000 } = {}) {
  const browser = await launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(entryUrl, { waitUntil: "load", timeout });
  await page.waitForTimeout(1500);   // let the first frames run; errors often fire there
  return { browser, page, consoleErrors, pageErrors };
}

/**
 * Nothing thrown on load.
 *
 * Deliberately loaded over file:// by default, because that is how someone opens a
 * generated single-file game, and it is the protocol under which the data: URI blocker
 * actually fires. Testing only over http hides the bug the static check predicts.
 */
export const consoleErrors = {
  id: "console-errors",
  kind: "browser",
  severity: BLOCKER,
  title: "no console or runtime errors on load",
  async run({ session }) {
    const { consoleErrors: ce, pageErrors: pe } = session;
    const findings = [];
    for (const m of [...new Set(pe)]) {
      findings.push(finding(consoleErrors, `uncaught error on load: ${m}`.slice(0, 200)));
    }
    for (const m of [...new Set(ce)]) {
      findings.push(finding(consoleErrors, `console error on load: ${m}`.slice(0, 200)));
    }
    return { findings };
  },
};

/**
 * A declared input produces an observable change.
 *
 * The game's internals are unknown to this tool, so the config declares the contract: a
 * key or pointer action, and something observable that must change. That keeps the check
 * generic without pretending to understand the game. A check that guessed at internals
 * would be flaky, and a flaky check gets disabled.
 */
export const controlsRespond = {
  id: "controls-respond",
  kind: "browser",
  severity: BLOCKER,
  title: "declared controls produce a visible change",
  async run({ session, game }) {
    const controls = game?.browser?.controls ?? [];
    if (!controls.length) return { findings: [] };
    const { page } = session;
    const findings = [];
    for (const c of controls) {
      const observe = c.observe ?? "body";
      const before = await page.innerText(observe).catch(() => null);
      const beforeShot = before === null ? await page.screenshot() : null;

      if (c.key) await page.keyboard.press(c.key);
      else if (c.click) await page.click(c.click).catch(() => {});
      await page.waitForTimeout(c.settle ?? 700);

      let changed;
      if (before === null) {
        changed = !(await page.screenshot()).equals(beforeShot);
      } else {
        changed = (await page.innerText(observe).catch(() => null)) !== before;
      }
      if (!changed) {
        findings.push(
          finding(controlsRespond, `${c.key ?? c.click} produced no change in ${observe}`, {
            detail: "Either the control is not wired up, or `observe` is pointing at the wrong thing.",
          }),
        );
      }
    }
    return { findings };
  },
};

/**
 * The win and lose states are actually reachable.
 *
 * Config declares how to get there and what proves arrival. If a game cannot describe a
 * route to its own end states, that is worth knowing on its own, which is why an absent
 * declaration is reported rather than skipped silently.
 */
export const loopStates = {
  id: "loop-states",
  kind: "browser",
  severity: BLOCKER,
  title: "win and lose states are reachable",
  async run({ session, game }) {
    const states = game?.browser?.states ?? {};
    const findings = [];
    for (const name of ["win", "lose"]) {
      const spec = states[name];
      if (!spec) {
        findings.push(
          finding(loopStates, `no ${name} state declared, so reachability was not verified`, {
            detail: `Add browser.states.${name} with a route and an expectation.`,
          }),
        );
        continue;
      }
      const { page } = session;
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(500);
      if (spec.script) await page.evaluate(spec.script).catch(() => {});
      for (const k of spec.keys ?? []) { await page.keyboard.press(k); await page.waitForTimeout(80); }
      await page.waitForTimeout(spec.settle ?? 1200);

      /**
       * innerText, never textContent.
       *
       * textContent on body returns every text node including the contents of inline
       * <script> tags, so a game whose source contains the literal string "You win!"
       * matches before anything has happened. That is a false pass, and it is the worst
       * kind: the check reports success by reading the code it is supposed to be testing.
       * innerText is rendered text only, so hidden elements and script bodies are excluded.
       */
      const reached = spec.selector
        ? await page.isVisible(spec.selector).catch(() => false)
        : new RegExp(spec.text, "i").test((await page.innerText("body").catch(() => "")) || "");
      if (!reached) {
        findings.push(
          finding(loopStates, `${name} state was not reached by the declared route`, {
            detail: spec.selector ? `expected ${spec.selector} visible` : `expected text matching /${spec.text}/i`,
          }),
        );
      }
    }
    return { findings };
  },
};

export const BROWSER_CHECKS = [consoleErrors, controlsRespond, loopStates];
