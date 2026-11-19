import { test } from "node:test";
import assert from "node:assert/strict";
import { runStatic } from "../src/run.mjs";

const game = (name, extra = {}) => ({
  name,
  root: `test/fixtures/games/${name}`,
  entry: `test/fixtures/games/${name}/index.html`,
  platforms: ["web"],
  ...extra,
});
const ids = (r) => r.findings.map((f) => f.check);

test("passing fixture: a real shipped game has no blockers", async () => {
  const r = await runStatic(game("chibi-bounce"));
  assert.equal(r.blockers.length, 0, JSON.stringify(r.blockers));
  assert.ok(r.files > 0, "must actually read files; a checker that reads nothing always passes");
});

test("all three real games are blocker-free under static checks", async () => {
  for (const g of ["chibi-bounce", "bird-runner-3d", "stellar-drift"]) {
    const r = await runStatic(game(g));
    assert.equal(r.blockers.length, 0, `${g}: ${JSON.stringify(r.blockers)}`);
  }
});

test("failing fixture: a data: URI is a blocker, with file and line", async () => {
  const r = await runStatic(game("broken-data-uri"));
  assert.equal(r.ok, false);
  const f = r.blockers.find((x) => x.check === "data-uri");
  assert.ok(f, "data-uri must fire");
  assert.match(f.message, /file:\/\//);
  assert.equal(f.file, "index.html");
  assert.match(f.detail, /line \d+/);
});

test("the data: URI check names a remedy, not just a complaint", async () => {
  const r = await runStatic(game("broken-data-uri"));
  assert.match(r.blockers.find((x) => x.check === "data-uri").detail, /canvas|file|http/i);
});

test("failing fixture: placeholders and TODOs are blockers", async () => {
  const r = await runStatic(game("broken-placeholder"));
  assert.equal(r.ok, false);
  assert.ok(ids(r).includes("placeholders"));
});

test("placeholder check reports once per term per file, not once per occurrence", async () => {
  const r = await runStatic(game("broken-placeholder"));
  const perFile = r.blockers.filter((f) => f.check === "placeholders" && f.file === "index.html");
  assert.ok(perFile.length <= 8, "a list of forty TODOs is noise, not a report");
});

test("a clean game does not trip the data: URI or placeholder checks", async () => {
  const r = await runStatic(game("tiny-pass"));
  assert.equal(r.blockers.length, 0);
});

test("required-elements is a WARNING, never a blocker, because static cannot decide it", async () => {
  const r = await runStatic(game("chibi-bounce"));
  for (const f of r.findings.filter((x) => x.check === "required-elements")) {
    assert.equal(f.severity, "warning");
  }
});

test("required-elements flags the real games' missing win condition", async () => {
  // All three shipped games reference lose and game-over states and never a win state.
  const r = await runStatic(game("bird-runner-3d"));
  assert.ok(
    r.warnings.some((f) => f.check === "required-elements" && /win condition/.test(f.message)),
    "the warning that a human should adjudicate",
  );
});

test("touch-controls only applies when the platform target needs it", async () => {
  const web = await runStatic(game("broken-data-uri", { platforms: ["web"] }));
  assert.equal(web.findings.filter((f) => f.check === "touch-controls").length, 0);
  const ios = await runStatic(game("broken-data-uri", { platforms: ["ios"] }));
  assert.equal(ios.findings.filter((f) => f.check === "touch-controls").length, 1);
});

test("a game declaring touch handlers passes the touch check on an iOS target", async () => {
  const r = await runStatic(game("tiny-pass", { platforms: ["ios"] }));
  assert.equal(r.findings.filter((f) => f.check === "touch-controls").length, 0);
});

test("severity is overridable per game, so one target's blocker is another's warning", async () => {
  const r = await runStatic(game("broken-data-uri", { severity: { "data-uri": "warning" } }));
  assert.equal(r.ok, true, "downgraded to a warning, so the run passes");
  assert.ok(r.warnings.some((f) => f.check === "data-uri"));
});

test("checks can be selected per game", async () => {
  const r = await runStatic(game("broken-placeholder", { checks: ["data-uri"] }));
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].id, "data-uri");
});

test("a missing game root is an error, not a silent pass", async () => {
  await assert.rejects(() => runStatic({ name: "nope", root: "test/fixtures/games/does-not-exist" }), /does not exist/);
});
