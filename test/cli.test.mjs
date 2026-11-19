import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

/** Through the real binary. The exit code is the only thing CI reads. */
const run = (...a) => spawnSync("node", ["bin/game-qa.mjs", ...a], { encoding: "utf8" });

test("static: exits 0 on a clean game", () => {
  const r = run("static", "--config", "test/fixtures/configs/static-pass.json");
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("static: exits 1 when a blocker is found", () => {
  const r = run("static", "--config", "test/fixtures/configs/static-fail.json");
  assert.equal(r.status, 1, `expected 1, got ${r.status}\n${r.stdout}`);
});

test("a blocker explains itself, naming the file and a remedy", () => {
  const out = run("static", "--config", "test/fixtures/configs/static-fail.json");
  const all = out.stdout + out.stderr;
  assert.match(all, /BLOCKER/);
  assert.match(all, /index\.html/);
  assert.match(all, /canvas|http/i);
});

test("warnings alone do not fail the run", () => {
  // chibi-bounce warns about a missing win condition and must still exit 0.
  const r = run("static", "--config", "game-qa.config.json");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /warning/);
});

test("a missing config exits 2, distinct from a blocker", () => {
  const r = run("static", "--config", "does-not-exist.json");
  assert.equal(r.status, 2);
});

test("an unknown mode exits 2 rather than silently doing nothing", () => {
  assert.equal(run("sideways").status, 2);
});

test("a config with no games exits 2", () => {
  const r = spawnSync("node", ["-e", `
    const {writeFileSync}=require('fs');writeFileSync('/tmp/empty-games.json','{"games":[]}')
  `]);
  assert.equal(r.status, 0);
  assert.equal(run("static", "--config", "/tmp/empty-games.json").status, 2);
});
