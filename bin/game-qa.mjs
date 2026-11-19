#!/usr/bin/env node
/**
 * CLI. Printing and exit codes here; detection in src/.
 *
 *   game-qa static    source only, no dependencies
 *   game-qa browser   drives a real page, needs Playwright
 *   game-qa all       both
 *
 * Exit 0 clean, 1 a blocker was found, 2 the tool could not run. The third code matters:
 * a checker that could not start must not be mistaken for a clean bill of health.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runStatic, runBrowser } from "../src/run.mjs";

const args = process.argv.slice(2);
const mode = args[0] ?? "all";
const ci = args.indexOf("--config");
const configPath = ci !== -1 ? args[ci + 1] : "game-qa.config.json";

const USAGE = `game-qa <static|browser|all> [--config <path>]

  static    source checks, zero dependencies
  browser   console errors, control response, win and lose reachability (Playwright)
  all       both`;

if (["--help", "-h"].includes(mode)) { console.log(USAGE); process.exit(0); }
if (!["static", "browser", "all"].includes(mode)) {
  console.error(`Unknown mode "${mode}".\n\n${USAGE}`);
  process.exit(2);
}

let config;
try {
  config = JSON.parse(readFileSync(resolve(configPath), "utf8"));
} catch (err) {
  console.error(`Could not read config at ${configPath}: ${err.message}`);
  process.exit(2);
}

const games = config.games ?? [];
if (!games.length) { console.error("Config declares no games."); process.exit(2); }

function report(r) {
  const head = `${r.game} [${r.kind}]`;
  console.log(`\n${head}\n${"-".repeat(head.length)}`);
  if (r.kind === "static") console.log(`  ${r.files} source file(s) read`);
  if (r.url) console.log(`  ${r.url}`);
  for (const e of r.errors) console.error(`  ERROR    ${e}`);
  for (const f of r.blockers) {
    console.error(`  BLOCKER  [${f.check}] ${f.message}`);
    if (f.file) console.error(`           in ${f.file}`);
    if (f.detail) console.error(`           ${f.detail}`);
  }
  for (const f of r.warnings) {
    console.log(`  warning  [${f.check}] ${f.message}`);
    if (f.detail) console.log(`           ${f.detail}`);
  }
  if (r.ok && !r.warnings.length) console.log("  clean");
  else if (r.ok) console.log(`  pass, with ${r.warnings.length} warning(s)`);
}

let failed = false;
for (const game of games) {
  const modes = mode === "all" ? ["static", "browser"] : [mode];
  for (const m of modes) {
    try {
      const r = m === "static" ? await runStatic(game) : await runBrowser(game);
      report(r);
      if (!r.ok) failed = true;
    } catch (err) {
      console.error(`\n${game.name} [${m}]\n  could not run: ${err.message}`);
      process.exit(2);
    }
  }
}

console.log(failed ? "\nFAIL: at least one blocker." : "\nPASS: no blockers.");
process.exit(failed ? 1 : 0);
