export interface Room {
  id: string;
  name: string;
  building: string;
  capacity: number;
  blocked: boolean;
  blockedReason?: string;
}

export interface Booking {
  id: string;
  roomId: string;
  title: string;
  start: number; // minutes from midnight (0–1440)
  end: number;
}

export interface AvailabilityResult {
  available: boolean;
  reasons: string[];
}
