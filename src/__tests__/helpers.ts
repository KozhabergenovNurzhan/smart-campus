import type { Room, Booking } from '@/types';

export function makeRooms(): Room[] {
  return [
    {
      id: 'A101',
      name: 'Test Room A101',
      building: 'Test Building',
      capacity: 30,
      blocked: false,
    },
    {
      id: 'B202',
      name: 'Test Room B202',
      building: 'Test Building',
      capacity: 20,
      blocked: true,
      blockedReason: 'Under maintenance',
    },
  ];
}

export function makeBookings(): Booking[] {
  return [
    {
      id: 'fx-1',
      roomId: 'A101',
      title: 'Existing Booking A',
      start: 600, // 10:00
      end: 660,   // 11:00
    },
    {
      id: 'fx-2',
      roomId: 'B202',
      title: 'Existing Booking B',
      start: 600,
      end: 660,
    },
  ];
}

export function setup() {
  const rooms = makeRooms();
  const bookings = makeBookings();
  const roomA101 = rooms.find((r) => r.id === 'A101')!;
  const roomB202 = rooms.find((r) => r.id === 'B202')!;
  return { rooms, bookings, roomA101, roomB202 };
}
