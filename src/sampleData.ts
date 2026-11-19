import type { Room, Booking } from '@/types';

export const rooms: Room[] = [
  { id: 'A101', name: 'Engineering Lab', building: 'A-Block · Floor 1', capacity: 40, blocked: false },
];

export const bookings: Booking[] = [
  { id: 'b1', roomId: 'A101', title: 'Thermodynamics 101', start: 480, end: 540 },
  { id: 'b2', roomId: 'A101', title: 'Robotics Workshop', start: 600, end: 720 },
  { id: 'b3', roomId: 'A101', title: 'Office Hours', start: 900, end: 960 },
];
