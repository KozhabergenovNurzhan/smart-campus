# AGENTS.md — Smart Campus Room Availability Checker

## Project structure

- `src/bookingLogic.ts` — Booking rules and time helpers. Contains `checkAvailability`, `timeToMinutes`, `minutesToTime`, `formatTimeRange`, and the overlap/endpoint logic. This is the single source of truth for availability decisions.
- `src/App.tsx` — Main UI: room selection, current/start/end time inputs, quick-duration buttons, result banner, and existing-bookings list.
- `src/components/Timeline.tsx` — Visual daily schedule bar showing existing bookings, the proposed slot, and the current-time marker.
- `src/sampleData.ts` — Booking fixtures: the room list and existing bookings shown in the UI. Contains 1 room and 3 bookings. Keep the fixture count and structure stable; do not add extra rooms or bookings without updating tests.
- `src/types.ts` — Shared types: `Room`, `Booking`, `AvailabilityResult`.
- `src/__tests__/bookingLogic.test.ts` — Core test suite (acceptance criteria, edge cases, mutation/non-mutation, parsing/formatting).
- `src/__tests__/practice08.test.ts` — Practice #08 evidence suite (endpoint-touching, overlap, unsorted/frozen input preservation).

## Test command

Run `npm test` before and after any code change. Report the pass/fail counts.
Baseline before Assignment 05: 109 passing, 0 failing (42 bookingLogic, 5
practice08, 13 App, 49 explanation).
Final expected after Assignment 05: 112 passing, 0 failing (adds
`src/__tests__/assignment05.test.tsx` with 3 regression tests).

## Safe commands

Only these commands may be run without review:

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm install` (only when `package.json`/lockfile changed intentionally)

## Prohibited without explicit human approval

- Committing or exposing secrets, API keys, or `.env` values.
- Destructive commands (`rm -rf`, force pushes, dropping data, deleting
  tests, fixtures, or checkpoints).
- Deployment, publishing, or merging of any kind.
- Adding, removing, or upgrading dependencies without a reviewed justification.

## UI tests

- `src/__tests__/App.test.tsx` — Component-level tests for the main UI (room selection, time inputs, result banner). Uses jsdom environment via vitest config.
- Every `<label>` in the UI must use `htmlFor` paired with the corresponding input `id` for accessibility.
- When changing the UI, run `npm test` to verify both logic and UI tests pass.

## Acceptance criteria (AC1–AC6) — must be preserved

- **AC1**: Reject past requests (`start` must be strictly after the current time) and intervals where `start >= end`. Valid range is `0 <= start < end <= 1440`.
- **AC2**: Reject durations over 120 minutes (`end - start > 120` is invalid; exactly 120 is valid).
- **AC3**: Reject blocked rooms.
- **AC4**: Reject overlaps with existing bookings for the same room.
- **AC5 (endpoint-touching)**: Allow bookings that only touch at an endpoint — `[a,b)` and `[b,c)` do NOT overlap. Do not regress this.
- **AC6 (no mutation / clear feedback)**: `checkAvailability` must not mutate rooms or bookings, and the UI must provide clear feedback on both desktop and mobile.

## Scope and constraints

- Availability-checking only. Do not add login, authentication, a backend, a database, or any saved/persisted booking creation.
- Keep the current UI layout and fixture structure in `src/sampleData.ts` (1 room, 3 bookings) stable.
- Keep existing test assertions and Practice #08 evidence intact.

## Refactoring guidance

- Prefer the smallest justified refactor. Do not reorganize or rewrite working code beyond what the task requires.
- When changing `src/bookingLogic.ts`, keep `checkAvailability` pure (no side effects, no mutation) and keep the endpoint-touching overlap rule (`s1 < e2 && s2 < e1`).
- Run `npm test` before and after changes; report pass/fail counts both times.

## Human review requirement

Every change must pass a human diff review before it is merged, deployed, or
presented as final. Agents must not claim approval, deployment, or merge on a
human's behalf.
