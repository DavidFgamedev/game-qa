import { test } from "node:test";
import assert from "node:assert/strict";
import { runBrowser } from "../src/run.mjs";

/**
 * These need Playwright and a Chromium download, so they are a separate file and a
 * separate CI job. The static suite must stay runnable with no dependencies at all.
 *
 * Everything asserted here is something static analysis cannot decide, which is the
 * entire reason this half exists.
 */
const game = (name, browser = {}) => ({
  name,
  root: `test/fixtures/games/${name}`,
  entry: `test/fixtures/games/${name}/index.html`,
  platforms: ["web"],
  browser,
});

const PASS = {
  controls: [{ key: "ArrowRight", observe: "#score" }],
  states: { win: { keys: ["w"], text: "you win" }, lose: { keys: ["l"], text: "you lose" } },
};

test("passing fixture: a working game is clean in a real browser", async () => {
  const r = await runBrowser(game("tiny-pass", PASS));
  assert.equal(r.ok, true, JSON.stringify(r.findings));
});

test("failing fixture: an uncaught error on load is a blocker", async () => {
  const r = await runBrowser(game("broken-runtime", { controls: [], states: {} }));
  assert.equal(r.ok, false);
  assert.ok(
    r.blockers.some((f) => f.check === "console-errors" && /undefinedFunctionCall/.test(f.message)),
    "the uncaught ReferenceError must surface",
  );
});

test("failing fixture: a console.error on load is a blocker", async () => {
  const r = await runBrowser(game("broken-runtime", { controls: [], states: {} }));
  assert.ok(r.blockers.some((f) => /renderer missing/.test(f.message)));
});

test("a control that does nothing is caught, which grep cannot do", async () => {
  const r = await runBrowser(game("tiny-pass", {
    controls: [{ key: "ArrowUp", observe: "#score" }],   // not wired to anything
    states: PASS.states,
  }));
  assert.equal(r.ok, false);
  assert.ok(r.blockers.some((f) => f.check === "controls-respond" && /ArrowUp/.test(f.message)));
});

test("a wired control is recognised as producing a change", async () => {
  const r = await runBrowser(game("tiny-pass", { controls: PASS.controls, states: PASS.states }));
  assert.equal(r.findings.filter((f) => f.check === "controls-respond").length, 0);
});

test("an unreachable win state is caught", async () => {
  const r = await runBrowser(game("tiny-pass", {
    controls: [],
    states: { win: { keys: ["z"], text: "you win" }, lose: PASS.states.lose },   // z does nothing
  }));
  assert.equal(r.ok, false);
  assert.ok(r.blockers.some((f) => f.check === "loop-states" && /win/.test(f.message)));
});

test("both end states reachable by their declared routes is clean", async () => {
  const r = await runBrowser(game("tiny-pass", { controls: [], states: PASS.states }));
  assert.equal(r.findings.filter((f) => f.check === "loop-states").length, 0);
});

test("an undeclared end state is reported, not skipped silently", async () => {
  const r = await runBrowser(game("tiny-pass", { controls: [], states: { win: PASS.states.win } }));
  assert.ok(r.blockers.some((f) => /no lose state declared/.test(f.message)));
});

test("the real shipped games load without console errors over file://", async () => {
  for (const g of ["chibi-bounce", "bird-runner-3d", "stellar-drift"]) {
    const r = await runBrowser({ ...game(g), checks: ["console-errors"] });
    assert.equal(r.ok, true, `${g}: ${JSON.stringify(r.findings)}`);
  }
});
