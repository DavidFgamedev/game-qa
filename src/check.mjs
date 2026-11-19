/**
 * The check contract. Every check, static or browser, is the same shape.
 *
 * This is the whole reason the browser suite could be added without touching the static
 * one: the runner, the reporter and the exit codes know about `kind` and nothing else.
 * Adding a check means adding a file and registering it.
 *
 *   id        stable identifier, used in config to enable/disable
 *   kind      "static" reads source; "browser" drives a real page
 *   severity  "blocker" fails the run; "warning" is reported and does not fail
 *   run(ctx)  returns { findings: [...] }
 *
 * Severity is per check and overridable per game, because a missing touch handler is a
 * blocker for an App Store target and noise for a desktop web build. A checker that
 * cannot express that gets its warnings ignored wholesale, which is the failure mode
 * that makes linters decorative.
 */

export const BLOCKER = "blocker";
export const WARNING = "warning";

export function finding(check, message, { file = null, detail = null } = {}) {
  return { check: check.id, severity: check.severity, message, file, detail };
}

/**
 * A check that threw is a failed run, never a silent pass.
 *
 * The runner stamps id and severity onto every finding rather than trusting what the
 * check wrote. Checks refer to themselves by closure, so a per-game severity override
 * produces a modified copy the original closure never sees. Making the runner
 * authoritative is what lets severity be configurable at all.
 */
export async function runCheck(check, ctx) {
  try {
    const out = await check.run(ctx);
    const findings = (out?.findings ?? []).map((f) => ({
      ...f,
      check: check.id,
      severity: check.severity,
    }));
    return { id: check.id, kind: check.kind, findings, error: null };
  } catch (err) {
    return {
      id: check.id,
      kind: check.kind,
      findings: [],
      error: `${check.id} could not run: ${err.message}`,
    };
  }
}

export function summarise(results) {
  const findings = results.flatMap((r) => r.findings);
  const errors = results.filter((r) => r.error).map((r) => r.error);
  const blockers = findings.filter((f) => f.severity === BLOCKER);
  const warnings = findings.filter((f) => f.severity === WARNING);
  return {
    ok: blockers.length === 0 && errors.length === 0,
    blockers,
    warnings,
    errors,
    findings,
  };
}
