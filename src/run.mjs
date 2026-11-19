import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { runCheck, summarise } from "./check.mjs";
import { STATIC_CHECKS } from "./static/checks.mjs";

const SOURCE_EXT = new Set([".html", ".htm", ".js", ".mjs", ".css"]);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SOURCE_EXT.has(extname(p))) out.push(p);
  }
  return out;
}

export function gameFiles(game, cwd = process.cwd()) {
  const root = resolve(cwd, game.root);
  if (!existsSync(root)) throw new Error(`Game root does not exist: ${game.root}`);
  return walk(root).map((p) => ({ path: p, rel: relative(root, p) }));
}

/** Severity overrides are per game, so one target's blocker is another's warning. */
function applySeverity(checks, game) {
  const over = game?.severity ?? {};
  return checks.map((c) => (over[c.id] ? { ...c, severity: over[c.id] } : c));
}

function selected(checks, game) {
  const only = game?.checks;
  return only ? checks.filter((c) => only.includes(c.id)) : checks;
}

export async function runStatic(game, { cwd = process.cwd() } = {}) {
  const files = gameFiles(game, cwd);
  const checks = selected(applySeverity(STATIC_CHECKS, game), game);
  const ctx = { files, game, config: game };
  const results = [];
  for (const c of checks) results.push(await runCheck(c, ctx));
  return { game: game.name, kind: "static", files: files.length, results, ...summarise(results) };
}

/**
 * The browser suite is imported lazily and only when asked for.
 *
 * That is what keeps `game-qa static` dependency free. The two halves share the check
 * contract, the runner and the reporter, so adding browser checks required no change to
 * anything above.
 */
export async function runBrowser(game, { cwd = process.cwd() } = {}) {
  const { BROWSER_CHECKS, openGame } = await import("./browser/checks.mjs").then(async (m) => ({
    BROWSER_CHECKS: m.BROWSER_CHECKS,
    openGame: m.openGame,
  }));
  const entry = resolve(cwd, game.entry ?? join(game.root, "index.html"));
  if (!existsSync(entry)) throw new Error(`Game entry does not exist: ${entry}`);
  const url = game.serve ? game.serve : pathToFileURL(entry).href;

  const session = await openGame(url);
  try {
    const checks = selected(applySeverity(BROWSER_CHECKS, game), game);
    const ctx = { session, game, entry, url };
    const results = [];
    for (const c of checks) results.push(await runCheck(c, ctx));
    return { game: game.name, kind: "browser", url, results, ...summarise(results) };
  } finally {
    await session.browser.close();
  }
}
