// Shared types for Chalna app

export type Room = {
  id: number;
  name: string;
  inviteCode: string;
  createdBy: number;
  createdAt: Date;
  memberCount?: number;
};

export type RoomMember = {
  id: number;
  roomId: number;
  userId: number;
  joinedAt: Date;
  user?: {
    id: number;
    name: string | null;
    openId: string;
  };
};

export type Clip = {
  id: number;
  roomId: number;
  userId: number;
  date: string; // YYYY-MM-DD (4am-based)
  timeSlot: number; // 0-23 (HH:00)
  storageKey: string;
  storageUrl: string;
  createdAt: Date;
  user?: {
    id: number;
    name: string | null;
    openId: string;
  };
};

export type TimeSlot = {
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
};

/**
 * Get the 4am-based date string and time slot from a Date object.
 * Hours 0-3 belong to the previous day.
 */
export function getTimeSlot(date: Date): TimeSlot {
  const d = new Date(date);
  const hour = d.getHours();
  // If before 4am, it belongs to the previous day
  if (hour < 4) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    hour: hour,
  };
}

/**
 * Get current time slot based on 4am boundary.
 */
export function getCurrentTimeSlot(): TimeSlot {
  return getTimeSlot(new Date());
}

/**
 * Format hour as HH:00 string.
 */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
