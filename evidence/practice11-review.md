# Practice #11 — Task #06 Review & Task #07 Fixes Evidence

## Original review findings (Task #06, read-only)

| ID | Title | Severity | Classification |
|---|---|---|---|
| F1 | Output limit (500 chars) violated by mock and fallback for worst-case accepted input (2127 chars measured) | Medium | Confirmed (executed) |
| F2 | Injectable adapter can mutate shared request/result, corrupting validation, fallback, and React state | Medium | Confirmed (executed) |
| F3 | Status-agreement heuristic misses contradictions avoiding the word "available"; "unavailable" not caught for available=true | Low | Confirmed (executed), accepted within documented mock scope |
| F4 | Booking titles with internal periods ("Dr.") cause the mock's own output to be rejected as > 2 sentences, degrading to fallback | Low-Medium | Confirmed (executed) |
| F5 | Stale responses after input change / unmount | — | Unsupported: sequence guard at App.tsx (effect bumps seq on every input/result change; late responses discarded unless seq matches); passing regression test `ignores a stale response…`; unmount set-state is a no-op in React 18 |
| F6 | Timeout timer leak / sync throw / late rejection | — | Unsupported: withTimeout clears timer on fulfill and reject; sync adapter throws happen inside try/catch → fallback; late rejection on a settled promise is handled (no unhandled rejection) |
| F7 | Coverage gaps (endpoint-touching explanation path); request-level validation failure returns empty explanation string (unreachable from UI) | Info | Unsupported / informational |

Reproduction method: a temporary, untracked test file executed five
reproductions (F1 length, F2 mutation, F4a/F4b contradiction acceptance, F4
sentence inflation), then deleted. F1's sentence-count assertion failed as
written (naive count is 2; the violation is length-only). Full suite re-run
afterwards: 98/98 passing. bookingLogic.ts hash matched the checkpoint
(`4e907be8…`) before and after.

## F2 — Adapter mutation (fix applied)

**Before:** `requestExplanation` passed the caller's request object (holding
the live React `result` state) to the adapter by reference. Executed
reproduction: an adapter setting `req.result.available = true` and clearing
`req.result.reasons` corrupted the caller's objects; validation and fallback
would then operate on mutated facts.

**After:** after request validation, `requestExplanation` creates a private
snapshot (`cloneExplanationRequest`: copied result object + copied reasons
array) and passes the adapter a second, independent deep copy. Response
validation and `buildFallbackExplanation` use only the private snapshot. A
single shared clone was rejected as insufficient per the task instructions —
the adapter could still corrupt validation facts through it.

**Regression tests added (all passing):**
- mutating adapter (sets available=true, clears reasons) → caller request/result unchanged; response accepted (from the isolated copy)
- mutating adapter that then throws → failureReason recorded; fallback built from ORIGINAL reasons; no "is available" claim
- mutating adapter that never settles → timeout fallback uses original reasons; "invented" reason absent
- identity checks: adapter receives neither the caller's request, result, nor reasons array; mutating the received copy does not affect the caller

## F1 — Output limits (fix applied)

**Before:** mock and fallback joined ALL accepted reasons verbatim. Worst-case
accepted input (10 reasons × ~190 chars) produced a 2127-character
explanation from both paths; the fallback path bypassed `validateAdapterResponse`
entirely, so the oversized text rendered unchecked.

**After:** a shared `unavailableExplanation` helper measures the full
explanation. If it exceeds 500 characters, both the mock and the fallback
emit the deterministic summary:

> "The room is unavailable for the selected interval. See the confirmed
> reasons above for all restrictions."

This wording is used only where the UI result banner already displays every
original reason verbatim, so nothing is hidden — the short explanation may
summarize while the confirmed result retains all reasons (README updated).
Valid checker results are never rejected for long reasons; facts are never
truncated into misleading fragments; no booking rules are recomputed.

**Regression tests added (all passing):**
- worst case (10 × ~190-char reasons) accepted by request validation; mock output ≤ 500 chars, ≤ 2 sentences, passes response validation
- worst case via adapter error → fallback ≤ 500 chars, ≤ 2 sentences, contains summary wording; original reasons untouched
- worst case via timeout (fake timers) → fallback within limits
- fallback status agreement for long inputs (contains "is not available", never "is available")
- maximum accepted lengths (100-char label, 200-char reason) → fallback and mock within limits; response validation passes
- ordinary overlap explanation remains fully informative (not summarized)

## Regression results (executed)

- `npm test`: **109 passed, 0 failed** (98 previous + 11 new F1/F2 regressions; all 60 original Practice #11 baseline tests preserved)
- `npm run build`: success
- `npm run lint`: clean
- `npm run typecheck`: clean
- `bookingLogic.ts` sha256 verified identical to `.bolt/checkpoint-p11/bookingLogic.ts` after all changes.

## Remaining documented limitations (not fixed here)

- **F3:** the status-consistency heuristic cannot semantically validate
  arbitrary text. No claim is made that keyword checks can validate arbitrary
  real LLM output; a real adapter requires server-side validation.
- **F4:** booking titles containing internal periods can push the mock's own
  output past the two-sentence limit, degrading that specific request to the
  deterministic fallback (which stays correct and within limits).

F5/F6 were rejected as defects in Task #06 (evidence above) and remain
unsupported.

## Prototype readiness

The two priority confirmed findings are fixed with executed regressions; all
four verification commands pass. Manual UI demonstration has **not** been
performed in this environment, and no screenshots exist. The prototype is
ready for a human to demo manually, with F3/F4 understood as documented,
non-blocking limitations.
