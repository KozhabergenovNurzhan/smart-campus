# Practice #07 — Mutation Challenge Results

**Date:** 2026-10-15
**Test runner:** Vitest v2.1.9
**Test file:** `src/__tests__/bookingLogic.test.ts`
**Production file:** `src/bookingLogic.ts`

---

## Pre-challenge hashes (SHA-256)

| File | Hash |
|---|---|
| `src/bookingLogic.ts` | `4e907be801880f9e7582db0329e3586260750afc7ae802188de377a420a7a163` |
| `src/__tests__/bookingLogic.test.ts` | `95d74b65cb8012b6cfc0756df25d2faaf425fc25d6d741efdc781dccaff9d421` |
| `evidence/bookingLogic.original.ts.bak` | `4e907be801880f9e7582db0329e3586260750afc7ae802188de377a420a7a163` |

## Baseline run

```
npx vitest run

 RUN  v2.1.9 /tmp/cc-agent/71833077/project

 ✓ src/__tests__/bookingLogic.test.ts (42 tests) 19ms

 Test Files  1 passed (1)
      Tests  42 passed (42)
   Start at  09:23:19
   Duration  1.85s

Exit code: 0
```

---

## M1: Duration `>` changed to `>=`

**Diff:**
```diff
-  if (duration > MAX_BOOKING_DURATION) {
+  if (duration >= MAX_BOOKING_DURATION) {
```

**Command:** `npx vitest run`
**Exit code:** 1

**Output:**
```
 RUN  v2.1.9 /tmp/cc-agent/71833077/project

 ❯ src/__tests__/bookingLogic.test.ts (42 tests | 3 failed) 31ms
   × case 5: A101 660–780 is Available (exactly 120 min)
     → expected false to be true
   × [T06] A101 720–840 is Available (exactly 120 min)
     → expected false to be true
   × [T10] A101 570–690 is Unavailable (contains existing booking)
     → expected [ …(2) ] to have a length of 1 but got 2

 Test Files  1 failed (1)
      Tests  3 failed | 39 passed (42)
   Start at  09:23:42
   Duration  2.05s
```

**Failing tests:**

| Test ID | Test name | Expected | Received |
|---|---|---|---|
| — | case 5: A101 660–780 is Available (exactly 120 min) | `available = true` | `available = false` |
| T06 | [T06] A101 720–840 is Available (exactly 120 min) | `available = true` | `available = false` |
| T10 | [T10] A101 570–690 is Unavailable (contains existing booking) | `reasons.length = 1` | `reasons.length = 2` |

**Expected primary detector:** T06
**Actual primary detector:** T06 (and case 5 equivalent) — both assert that exactly 120 minutes is Available. T10 also fails as a side effect: the 120-minute duration (690–570=120) now triggers a duration reason in addition to the overlap reason, causing the `toHaveLength(1)` assertion to fail.

**Result: DETECTED**

---

## M2: `intervalsOverlap` `<` changed to `<=`

**Diff:**
```diff
-  return s1 < e2 && s2 < e1;
+  return s1 <= e2 && s2 <= e1;
```

**Command:** `npx vitest run`
**Exit code:** 1

**Output:**
```
 RUN  v2.1.9 /tmp/cc-agent/71833077/project

 ❯ src/__tests__/bookingLogic.test.ts (42 tests | 6 failed) 81ms
   × [T01] case 1: A101 660–720 is Available (touching endpoint at start)
     → expected false to be true
   × [T08] case 2: A101 570–600 is Available (touching endpoint at end)
     → expected false to be true
   × [T13] case 4: B202 660–720 is Unavailable (blocked)
     → expected [ …(2) ] to have a length of 1 but got 2
   × case 5: A101 660–780 is Available (exactly 120 min)
     → expected false to be true
   × case 6: A101 660–781 is Unavailable (121 min exceeds max)
     → expected [ …(2) ] to have a length of 1 but got 2
   × [AC5] does not mutate rooms or bookings after an Available result
     → expected false to be true

 Test Files  1 failed (1)
      Tests  6 failed | 36 passed (42)
   Start at  09:23:56
   Duration  1.92s
```

**Failing tests:**

| Test ID | Test name | Expected | Received |
|---|---|---|---|
| T01 | [T01] case 1: A101 660–720 is Available (touching endpoint at start) | `available = true` | `available = false` |
| T08 | [T08] case 2: A101 570–600 is Available (touching endpoint at end) | `available = true` | `available = false` |
| T13 | [T13] case 4: B202 660–720 is Unavailable (blocked) | `reasons.length = 1` | `reasons.length = 2` |
| — | case 5: A101 660–780 is Available (exactly 120 min) | `available = true` | `available = false` |
| — | case 6: A101 660–781 is Unavailable (121 min exceeds max) | `reasons.length = 1` | `reasons.length = 2` |
| AC5 | [AC5] does not mutate rooms or bookings after an Available result | `available = true` | `available = false` |

**Expected primary detectors:** T01 and/or T08
**Actual primary detectors:** T01 and T08 — both assert that touching endpoints are Available. The `<=` makes touching intervals appear to overlap, so these now return Unavailable. T13, case 5, case 6, and AC5 fail as side effects: the B202 booking 600–660 now "overlaps" with 660–720, and A101's booking 600–660 "overlaps" with 660–720/660–780/660–781, adding spurious overlap reasons.

**Result: DETECTED**

---

## M3: Remove blocked-room rejection

**Diff:**
```diff
-  // AC3: Room must not be blocked
-  if (room?.blocked) {
-    reasons.push(`This room is blocked: ${room.blockedReason ?? 'unavailable'}.`);
-  }
-
```

**Command:** `npx vitest run --reporter=verbose`
**Exit code:** 1

**Output:**
```
 RUN  v2.1.9 /tmp/cc-agent/71833077/project

 ❯ src/__tests__/bookingLogic.test.ts (42 tests | 1 failed) 28ms
   × [T13] case 4: B202 660–720 is Unavailable (blocked)
     → expected true to be false

 Test Files  1 failed (1)
      Tests  1 failed | 41 passed (42)
   Start at  09:24:19
   Duration  1.94s
```

**Failing tests:**

| Test ID | Test name | Expected | Received |
|---|---|---|---|
| T13 | [T13] case 4: B202 660–720 is Unavailable (blocked) | `available = false` | `available = true` |

**Expected primary detector:** T13
**Actual primary detector:** T13 — exactly the expected test fails. With the blocked check removed, B202 returns Available for a valid time interval. The `available` assertion fails first (`expected true to be false`).

**Result: DETECTED**

---

## Post-challenge restoration verification

**Production file hash after restore:**
```
4e907be801880f9e7582db0329e3586260750afc7ae802188de377a420a7a163  src/bookingLogic.ts
```
Matches original: YES

**Test file hash (unchanged throughout):**
```
95d74b65cb8012b6cfc0756df25d2faaf425fc25d6d741efdc781dccaff9d421  src/__tests__/bookingLogic.test.ts
```
Matches original: YES

## Final restored test run

```
npx vitest run --reporter=verbose

 RUN  v2.1.9 /tmp/cc-agent/71833077/project

 ✓ src/__tests__/bookingLogic.test.ts (42 tests) 90ms

 Test Files  1 passed (1)
      Tests  42 passed (42)
   Start at  09:24:26
   Duration  1.99s

Exit code: 0
```

## Final restored build

```
npm run build

> vite build
vite v5.4.8 building for production...
✓ 1571 modules transformed.
dist/index.html                   0.72 kB │ gzip:  0.39 kB
dist/assets/index-D0Cyj-ON.css   14.79 kB │ gzip:  3.65 kB
dist/assets/index-DLPS1oPd.js   161.16 kB │ gzip: 50.87 kB
✓ built in 6.38s

Exit code: 0
```

---

## Mutation summary table

| Mutation | Description | Expected detector | Actual failing tests | Fail count | Detected? |
|---|---|---|---|---|---|
| M1 | `duration > MAX` → `duration >= MAX` | T06 | T06, case 5, T10 | 3 | YES |
| M2 | `s1 < e2 && s2 < e1` → `s1 <= e2 && s2 <= e1` | T01 and/or T08 | T01, T08, T13, case 5, case 6, AC5 | 6 | YES |
| M3 | Remove blocked-room rejection | T13 | T13 | 1 | YES |

All three mutants were detected by the test suite. No mutants survived. No tests were modified during the challenge. Production code was restored and verified after all trials.
