import { describe, it, expect } from 'vitest';
import {
  checkAvailability,
  timeToMinutes,
  minutesToTime,
} from '@/bookingLogic';
import type { Booking } from '@/types';
import { makeRooms, makeBookings, setup } from './helpers';

const CURRENT_TIME = 540; // 09:00

// ─── Test suites ─────────────────────────────────────────────────────────────

describe('checkAvailability — acceptance criteria', () => {
  // We create fresh fixtures per-test by calling the factory functions inside
  // each test, so no state leaks between tests.

  // [T01] A101, 660–720: Available (touching endpoint — end of existing == start of proposed)
  it('[T01] case 1: A101 660–720 is Available (touching endpoint at start)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 660, 720, CURRENT_TIME, bookings);
    expect(result.available).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  // [T08] A101, 570–600: Available (touching the other endpoint — end of proposed == start of existing)
  it('[T08] case 2: A101 570–600 is Available (touching endpoint at end)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 570, 600, CURRENT_TIME, bookings);
    expect(result.available).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  // [T09] A101, 630–690: Unavailable (partial overlap with 600–660)
  it('[T09] case 3: A101 630–690 is Unavailable (overlap)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 630, 690, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('Overlaps'))).toBe(true);
  });

  // [T13] B202, 660–720: Unavailable (blocked room)
  it('[T13] case 4: B202 660–720 is Unavailable (blocked)', () => {
    const { bookings, roomB202 } = setup();
    const result = checkAvailability(roomB202, 660, 720, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('blocked'))).toBe(true);
  });

  // Equivalent to T06 — exactly 120 min, uses 660–780 instead of 720–840
  it('case 5: A101 660–780 is Available (exactly 120 min)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 660, 780, CURRENT_TIME, bookings);
    expect(result.available).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  // Equivalent to T07 — 121 min, uses 660–781 instead of 720–841
  it('case 6: A101 660–781 is Unavailable (121 min exceeds max)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 660, 781, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('maximum allowed'))).toBe(true);
  });

  // [T02] A101, 540–570: Unavailable (start equals current time)
  it('[T02] case 7: A101 540–570 is Unavailable (start == current time)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 540, 570, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('strictly after'))).toBe(true);
  });

  it('case 8: A101 539–570 is Unavailable (start < current time)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 539, 570, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('strictly after'))).toBe(true);
  });

  // [T03] A101, 720–720: Unavailable (start equals end)
  it('[T03] case 9: A101 720–720 is Unavailable (start == end)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 720, 720, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('after start time'))).toBe(true);
  });

  // Equivalent to T04 — reversed interval, uses 780–720 instead of 750–720
  it('case 10: A101 780–720 is Unavailable (start > end)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 780, 720, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('after start time'))).toBe(true);
  });

  it('case 11: A101 -1–30 is Unavailable (negative start)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, -1, 30, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons.some((r) => r.includes('00:00'))).toBe(true);
  });

  // [T05] A101, 1380–1441: Unavailable (end exceeds 1440)
  it('[T05] case 12: A101 1380–1441 is Unavailable (end > 1440)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 1380, 1441, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('24:00'))).toBe(true);
  });

  it('case 13: A101 1380–1440 is Available (valid end-of-day boundary)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 1380, 1440, CURRENT_TIME, bookings);
    expect(result.available).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});

describe('checkAvailability — required cases with exact inputs', () => {

  // [T04] A101, 750–720 → Unavailable (reversed interval)
  it('[T04] A101 750–720 is Unavailable (reversed interval)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 750, 720, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('after start time'))).toBe(true);
  });

  // [T06] A101, 720–840 → Available (exactly 120 minutes)
  it('[T06] A101 720–840 is Available (exactly 120 min)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 720, 840, CURRENT_TIME, bookings);
    expect(result.available).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  // [T07] A101, 720–841 → Unavailable (121 minutes)
  it('[T07] A101 720–841 is Unavailable (121 min exceeds max)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 720, 841, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('maximum allowed'))).toBe(true);
  });

  // [T10] A101, 570–690 → Unavailable (proposed contains existing booking 600–660)
  it('[T10] A101 570–690 is Unavailable (contains existing booking)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 570, 690, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('Overlaps'))).toBe(true);
  });

  // [T11] A101, 615–645 → Unavailable (proposed is inside existing booking 600–660)
  it('[T11] A101 615–645 is Unavailable (inside existing booking)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 615, 645, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('Overlaps'))).toBe(true);
  });

  // [T12] A101, 600–660 → Unavailable (identical interval to existing booking)
  it('[T12] A101 600–660 is Unavailable (identical interval)', () => {
    const { bookings, roomA101 } = setup();
    const result = checkAvailability(roomA101, 600, 660, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('Overlaps'))).toBe(true);
  });

  // [T14] A101, 630–690 with empty bookings → Available
  // Contrast: the same interval 630–690 is Unavailable with the existing booking (T09)
  // but Available when the bookings list is empty.
  it('[T14] A101 630–690 with empty bookings is Available', () => {
    const { roomA101 } = setup();
    const result = checkAvailability(roomA101, 630, 690, CURRENT_TIME, []);
    expect(result.available).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});

describe('checkAvailability — additional justified cases', () => {
  // [E01] An overlapping booking belonging only to another room must not block A101.
  // Request A101 630–690; provide only a B202 booking 600–660; expect Available.
  it('[E01] A101 630–690 is Available when only B202 has a booking 600–660', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const bookings: Booking[] = [
      { id: 'other-1', roomId: 'B202', title: 'Other Room Booking', start: 600, end: 660 },
    ];
    const result = checkAvailability(roomA101, 630, 690, CURRENT_TIME, bookings);
    expect(result.available).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  // [E02] Check every booking including unsorted entries.
  // For A101 provide bookings in order: 900–960, then 600–660.
  // Request 630–690; expect Unavailable because it overlaps the second entry.
  it('[E02] A101 630–690 is Unavailable when bookings are unsorted (900–960 then 600–660)', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const bookings: Booking[] = [
      { id: 'unsorted-1', roomId: 'A101', title: 'Late Booking', start: 900, end: 960 },
      { id: 'unsorted-2', roomId: 'A101', title: 'Early Booking', start: 600, end: 660 },
    ];
    const result = checkAvailability(roomA101, 630, 690, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons.some((r) => r.includes('Overlaps'))).toBe(true);
  });
});

describe('checkAvailability — no mutation of input data (AC5)', () => {
  it('[AC5] does not mutate rooms or bookings after an Available result', () => {
    const rooms = makeRooms();
    const bookings = makeBookings();
    const roomsSnapshot = structuredClone(rooms);
    const bookingsSnapshot = structuredClone(bookings);
    const roomA101 = rooms.find((r) => r.id === 'A101')!;

    // Run an available check
    const result = checkAvailability(roomA101, 660, 720, CURRENT_TIME, bookings);
    expect(result.available).toBe(true);

    // Run again to be sure repeated checks are safe
    checkAvailability(roomA101, 660, 720, CURRENT_TIME, bookings);
    checkAvailability(roomA101, 660, 720, CURRENT_TIME, bookings);

    expect(rooms).toEqual(roomsSnapshot);
    expect(bookings).toEqual(bookingsSnapshot);
  });

  it('[AC5] does not mutate rooms or bookings after an Unavailable result', () => {
    const rooms = makeRooms();
    const bookings = makeBookings();
    const roomsSnapshot = structuredClone(rooms);
    const bookingsSnapshot = structuredClone(bookings);
    const roomA101 = rooms.find((r) => r.id === 'A101')!;

    // Run an unavailable check (overlap)
    const result = checkAvailability(roomA101, 630, 690, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);

    // Run again multiple times
    checkAvailability(roomA101, 630, 690, CURRENT_TIME, bookings);
    checkAvailability(roomA101, 540, 570, CURRENT_TIME, bookings);

    expect(rooms).toEqual(roomsSnapshot);
    expect(bookings).toEqual(bookingsSnapshot);
  });
});

describe('timeToMinutes — parsing layer', () => {
  it('parses a valid HH:MM string', () => {
    expect(timeToMinutes('09:00')).toBe(540);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('24:00')).toBe(1440);
    expect(timeToMinutes('10:30')).toBe(630);
  });

  it('parses an empty string as NaN', () => {
    expect(timeToMinutes('')).toBeNaN();
  });

  it('parses a malformed string (missing colon) as NaN', () => {
    expect(timeToMinutes('abc')).toBeNaN();
    expect(timeToMinutes('10')).toBeNaN();
  });

  it('parses a partially malformed string', () => {
    // "10:" → split gives ['10', ''] → Number('') === 0 → 600
    // This documents existing behavior, not necessarily desired behavior.
    expect(timeToMinutes('10:')).toBe(600);
  });
});

describe('minutesToTime — formatting layer', () => {
  it('formats valid minute values', () => {
    expect(minutesToTime(540)).toBe('09:00');
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(1440)).toBe('24:00');
    expect(minutesToTime(630)).toBe('10:30');
  });

  it('formats negative values with negative hour', () => {
    // Documents existing behavior: Math.floor(-30/60) = -1, -30%60 = -30
    expect(minutesToTime(-30)).toBe('-1:-30');
  });
});

describe('checkAvailability — edge cases with null room', () => {
  it('returns Unavailable with "Please select a room." when room is null', () => {
    const bookings = makeBookings();
    const result = checkAvailability(null, 660, 720, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons).toContain('Please select a room.');
  });

  it('returns Unavailable with room reason plus time reason when interval is also invalid', () => {
    const bookings = makeBookings();
    const result = checkAvailability(null, 540, 570, CURRENT_TIME, bookings);
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons).toContain('Please select a room.');
    expect(result.reasons.some((r) => r.includes('strictly after'))).toBe(true);
  });
});

describe('checkAvailability — empty bookings list', () => {
  it('returns Available for valid interval when no bookings exist', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const result = checkAvailability(roomA101, 660, 720, CURRENT_TIME, []);
    expect(result.available).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});

describe('checkAvailability — non-finite inputs (regression)', () => {
  it('rejects NaN start with a clear reason', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const result = checkAvailability(roomA101, NaN, 720, CURRENT_TIME, makeBookings());
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons).toContain('Start time is missing or invalid.');
  });

  it('rejects NaN end with a clear reason', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const result = checkAvailability(roomA101, 660, NaN, CURRENT_TIME, makeBookings());
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons).toContain('End time is missing or invalid.');
  });

  it('rejects NaN currentTime with a clear reason', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const result = checkAvailability(roomA101, 660, 720, NaN, makeBookings());
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons).toContain('Current time is missing or invalid.');
  });

  it('rejects Infinity start with a clear reason', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const result = checkAvailability(roomA101, Infinity, 720, CURRENT_TIME, makeBookings());
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons).toContain('Start time is missing or invalid.');
  });

  it('rejects Infinity end with a clear reason', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const result = checkAvailability(roomA101, 660, Infinity, CURRENT_TIME, makeBookings());
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons).toContain('End time is missing or invalid.');
  });

  it('rejects -Infinity currentTime with a clear reason', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const result = checkAvailability(roomA101, 660, 720, -Infinity, makeBookings());
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons).toContain('Current time is missing or invalid.');
  });

  it('rejects when all three are NaN and reports all three reasons', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    const result = checkAvailability(roomA101, NaN, NaN, NaN, makeBookings());
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(3);
    expect(result.reasons).toContain('Start time is missing or invalid.');
    expect(result.reasons).toContain('End time is missing or invalid.');
    expect(result.reasons).toContain('Current time is missing or invalid.');
  });

  it('does not fall through to overlap or duration checks when inputs are non-finite', () => {
    const rooms = makeRooms();
    const roomA101 = rooms.find((r) => r.id === 'A101')!;
    // NaN start would produce NaN duration; ensure no duration/overlap reason appears
    const result = checkAvailability(roomA101, NaN, 720, CURRENT_TIME, makeBookings());
    expect(result.available).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toBe('Start time is missing or invalid.');
  });

  it('does not mutate rooms or bookings when inputs are non-finite', () => {
    const rooms = makeRooms();
    const bookings = makeBookings();
    const roomsSnapshot = structuredClone(rooms);
    const bookingsSnapshot = structuredClone(bookings);
    const roomA101 = rooms.find((r) => r.id === 'A101')!;

    checkAvailability(roomA101, NaN, NaN, NaN, bookings);
    checkAvailability(roomA101, Infinity, Infinity, -Infinity, bookings);

    expect(rooms).toEqual(roomsSnapshot);
    expect(bookings).toEqual(bookingsSnapshot);
  });
});
