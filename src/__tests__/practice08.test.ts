import { describe, it, expect } from 'vitest';
import { checkAvailability } from '@/bookingLogic';
import type { Room, Booking } from '@/types';
const room: Room = { id: 'A101', name: 'A101', building: 'Test', capacity: 30, blocked: false };
function fixture(): Booking[] {
  return [
    { id: 'later', roomId: 'A101', title: 'Later', start: 800, end: 860 },
    { id: 'existing', roomId: 'A101', title: 'Existing', start: 600, end: 660 },
  ];
}
describe('Practice 08 controlled challenge', () => {
  it('P08-A1 allows request after an existing endpoint', () => {
    expect(checkAvailability(room, 660, 720, 540, fixture())).toEqual({ available: true, reasons: [] });
  });
  it('P08-A2 allows request before an existing endpoint', () => {
    expect(checkAvailability(room, 570, 600, 540, fixture())).toEqual({ available: true, reasons: [] });
  });
  it('P08-A3 rejects a genuine one-minute overlap', () => {
    const result = checkAvailability(room, 659, 720, 540, fixture());
    expect(result).toEqual({ available: false, reasons: ['Overlaps with "Existing" (10:00 – 11:00).'] });
  });
  it('P08-B1 preserves unsorted input order, values, and identities', () => {
    const bookings = fixture();
    const snapshot = structuredClone(bookings);
    const identities = [...bookings];
    expect(checkAvailability(room, 660, 720, 540, bookings)).toEqual({ available: true, reasons: [] });
    expect(bookings).toEqual(snapshot);
    bookings.forEach((b, i) => expect(b).toBe(identities[i]));
  });
  it('P08-B2 can check a frozen input array and frozen bookings', () => {
    const bookings = fixture();
    bookings.forEach(Object.freeze);
    Object.freeze(bookings);
    expect(checkAvailability(room, 660, 720, 540, bookings)).toEqual({ available: true, reasons: [] });
  });
});
