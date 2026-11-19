# game-qa

[![qa](https://github.com/DavidFgamedev/game-qa/actions/workflows/ci.yml/badge.svg)](https://github.com/DavidFgamedev/game-qa/actions/workflows/ci.yml)

Automated QA for generated browser games. Two halves, on purpose:

- **static** reads source. Zero dependencies, Node built-ins only.
- **browser** drives a real Chromium page with **Playwright**, and checks the three things
  static analysis genuinely cannot decide.

```bash
npx game-qa static     # no install needed
npx game-qa browser    # needs Playwright
npx game-qa all
```

Exit `0` clean, `1` a blocker, `2` the tool could not run. The third code matters: a
checker that failed to start must never be mistaken for a clean bill of health.

## Why two halves

Grep can see that the string `gameOver` appears in a file. Only a browser can see that it
is ever shown. The split is honest about which questions each half can actually answer,
and every check says so in its own output: anything static cannot settle is reported as a
**warning**, never a blocker.

## Static checks

### `data-uri` (blocker)
Finds `data:image/...;base64,` assets, which **fail when the page is opened from disk**.
Chromium refuses them over `file://` and logs "Local data URIs are not supported".
Generated single-file games reach for data URIs constantly, and the bug is invisible over
http, so it survives development and dies on a double click. Reports the file, the line,
and the three available remedies.

This is the one check that is both fully decidable from source and a real, non-obvious
blocker, which is why it leads.

### `placeholders` (blocker)
`TODO`, `FIXME`, `XXX`, `placeholder`, `not implemented`, `coming soon`. Reports once per
term per file: a list of forty TODOs is noise, not a report.

### `required-elements` (warning, by design)
Looks for a score counter, a game-over state, and explicit win and lose conditions.

**This never blocks**, because presence of the word "score" does not prove a counter
renders and absence does not prove one is missing. The check can raise the question and
cannot settle it. The browser suite settles it.

### `touch-controls` (warning)
Only applies when the game's `platforms` include a touch target. A missing touch handler
is a real problem for an App Store build and noise for a desktop web build, so severity is
per game rather than global.

## Browser checks, via Playwright

Loaded over `file://` by default, because that is how someone opens a generated game, and
it is the protocol under which the `data:` URI blocker actually fires. Testing only over
http hides the bug the static half predicts.

### `console-errors` (blocker)
Collects `console.error` and uncaught `pageerror` during load and the first frames. The
single most informative check here, and completely undecidable from source.

### `controls-respond` (blocker)
Presses a declared key, or clicks a declared selector, and asserts something observable
changed. The game's internals are unknown to this tool, so the config declares the
contract:

```json
"controls": [{ "key": "ArrowRight", "observe": "#score" }]
```

Falls back to a screenshot comparison when the observable is not text. A check that
guessed at internals would be flaky, and a flaky check gets disabled.

### `loop-states` (blocker)
Verifies the win and lose states are actually reachable by a declared route:

```json
"states": {
  "win":  { "keys": ["w"], "text": "you win" },
  "lose": { "keys": ["l"], "text": "you lose" }
}
```

An **undeclared** state is reported rather than skipped. If a game cannot describe a route
to its own ending, that is worth knowing on its own.

## Configuration

```json
{
  "games": [{
    "name": "chibi-bounce",
    "root": "games/chibi-bounce",
    "entry": "games/chibi-bounce/index.html",
    "platforms": ["ios"],
    "checks": ["data-uri", "placeholders"],
    "severity": { "data-uri": "warning" },
    "browser": { "controls": [], "states": {} }
  }]
}
```

`checks` selects; `severity` overrides per game. One target's blocker is another's warning,
and a checker that cannot express that gets its warnings ignored wholesale.

## Tests

```bash
npm test              # everything, needs Playwright
npm run test:static   # static and CLI only, no dependencies
```

**30 tests.** Every check has a passing fixture and a failing fixture.

The passing fixtures are **three real shipped games**, not toys: `chibi-bounce`,
`bird-runner-3d` and `stellar-drift`. The failing fixtures are synthetic and minimal, one
defect each, because a fixture that fails for two reasons cannot prove which check caught
it. Browser fixtures are synthetic for the same reason: a real game cannot be driven
deterministically enough to assert on.

CI runs three jobs: the static suite on Node 18, 20 and 22 with no install at all; the
browser suite with Chromium; and a **self-check that the known-bad fixture still exits 1**.
A checker that cannot fail is not a checker.

## Two bugs this found in itself

Worth stating, because they are the argument for having tests on a QA tool at all.

**A per-game severity override did nothing.** Checks refer to themselves by closure, so an
overridden copy was never the object the closure captured, and every finding carried the
original severity. The runner is now authoritative over `id` and `severity` instead of
trusting what a check wrote about itself.

**The win-state check passed by reading the game's own source.** It matched against
`textContent` of `body`, which includes the text of inline `<script>` tags. A game whose
source contains the literal `'You win!'` matched before anything had happened. That is the
worst class of false pass: the check reported success by reading the code it was meant to
be testing. It uses `innerText` now, which is rendered text only.

## What this does not do

Head-to-body sprite ratios, blush marks, palette conformance and frame rate are all out of
scope. They need image analysis or a human, and a checker that pretends to decide them
would produce confident wrong answers. A gap is better than a lie.

## Licence

MIT
