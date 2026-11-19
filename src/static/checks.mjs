import { readFileSync } from "node:fs";
import { BLOCKER, WARNING, finding } from "../check.mjs";

/**
 * Static checks. Source only, no browser, no dependencies.
 *
 * Each one states honestly what it can and cannot conclude. A static checker that claims
 * more than it knows produces confident wrong answers, which is worse than a gap.
 */

/**
 * Data URIs break when a page is opened from disk.
 *
 * The specific failure: a browser opening index.html over file:// refuses to load
 * `data:image/...;base64,` as an image source and logs "Local data URIs are not
 * supported". Generated single-file games reach for data URIs constantly, and the bug is
 * invisible over http, which is how it survives development and dies on a double click.
 *
 * This is the one check here that is both fully decidable from source and a real,
 * non-obvious blocker, which is why it leads.
 */
export const dataUri = {
  id: "data-uri",
  kind: "static",
  severity: BLOCKER,
  title: "data: URIs that fail under the file:// protocol",
  run({ files }) {
    const findings = [];
    const pattern = /data:(image|audio|video)\/[a-zA-Z0-9.+-]+;base64,/g;
    for (const f of files) {
      const text = readFileSync(f.path, "utf8");
      const seen = new Set();
      for (const m of text.matchAll(pattern)) {
        if (seen.has(m[0])) continue;
        seen.add(m[0]);
        const line = text.slice(0, m.index).split("\n").length;
        findings.push(
          finding(dataUri, `${m[0]} will not load over file://`, {
            file: f.rel,
            detail: `line ${line}. Generate the texture on a canvas, ship the asset as a file, or serve the game over http.`,
          }),
        );
      }
    }
    return { findings };
  },
};

/** Unfinished work that shipped. Decidable, and the cheapest real defect to catch. */
export const placeholders = {
  id: "placeholders",
  kind: "static",
  severity: BLOCKER,
  title: "placeholder text and stub implementations",
  run({ files, config }) {
    const terms = config?.placeholderTerms ?? [
      "\\bTODO\\b", "\\bFIXME\\b", "\\bXXX\\b", "\\bHACK\\b",
      "placeholder", "lorem ipsum", "not implemented", "coming soon",
    ];
    const findings = [];
    for (const f of files) {
      const text = readFileSync(f.path, "utf8");
      for (const t of terms) {
        for (const m of text.matchAll(new RegExp(t, "gi"))) {
          const line = text.slice(0, m.index).split("\n").length;
          findings.push(
            finding(placeholders, `"${m[0]}" left in shipped source`, {
              file: f.rel,
              detail: `line ${line}`,
            }),
          );
          break; // one per term per file; a list of 40 TODOs is noise
        }
      }
    }
    return { findings };
  },
};

/**
 * Required elements, reported as warnings on purpose.
 *
 * Presence of the string "score" does not prove a score counter renders, and absence does
 * not prove it is missing: the game may build the label dynamically or name it something
 * else. This check can raise suspicion and cannot settle it, so it never blocks. The
 * browser suite is what actually decides these.
 */
export const requiredElements = {
  id: "required-elements",
  kind: "static",
  severity: WARNING,
  title: "expected game elements referenced in source",
  run({ files, config }) {
    const required = config?.requiredElements ?? {
      "score counter": ["score"],
      "game over state": ["gameover", "game over", "game_over"],
      "win condition": ["\\bwin\\b", "victory", "youwin", "you win"],
      "lose condition": ["\\blose\\b", "\\blost\\b", "defeat", "gameover"],
    };
    const all = files.map((f) => readFileSync(f.path, "utf8").toLowerCase()).join("\n");
    const findings = [];
    for (const [label, patterns] of Object.entries(required)) {
      if (!patterns.some((p) => new RegExp(p, "i").test(all))) {
        findings.push(
          finding(requiredElements, `no source reference to a ${label}`, {
            detail: "Static analysis cannot confirm this. Verify in the browser suite.",
          }),
        );
      }
    }
    return { findings };
  },
};

/** Touch handlers, only when the target platform needs them. */
export const touchControls = {
  id: "touch-controls",
  kind: "static",
  severity: WARNING,
  title: "touch handlers for touch platform targets",
  run({ files, game }) {
    const platforms = game?.platforms ?? [];
    const needsTouch = platforms.some((p) => /ios|android|mobile|app ?store/i.test(p));
    if (!needsTouch) return { findings: [] };
    const all = files.map((f) => readFileSync(f.path, "utf8")).join("\n");
    const has = /touchstart|touchend|pointerdown|pointerup|onTouch/i.test(all);
    return {
      findings: has
        ? []
        : [finding(touchControls, `platform target is ${platforms.join(", ")} but no touch or pointer handler was found`)],
    };
  },
};

export const STATIC_CHECKS = [dataUri, placeholders, requiredElements, touchControls];
