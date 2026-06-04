/**
 * 오전 4시 기준 날짜/시간 슬롯 유틸리티
 * - 새벽 0~3시는 전날 날짜로 분류
 * - 시간 슬롯은 HH:00 단위
 */

export type TimeSlotInfo = {
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
};

/**
 * 주어진 Date에서 오전 4시 기준 날짜와 시간 슬롯을 반환
 */
export function getTimeSlotInfo(date: Date = new Date()): TimeSlotInfo {
  const d = new Date(date);
  const hour = d.getHours();
  // 0~3시는 전날로 분류
  if (hour < 4) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    hour,
  };
}

/**
 * 현재 시간의 오전 4시 기준 날짜와 시간 슬롯 반환
 */
export function getCurrentSlot(): TimeSlotInfo {
  return getTimeSlotInfo(new Date());
}

/**
 * 시간을 HH:00 형식으로 포맷
 */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * 날짜 문자열을 표시용으로 포맷 (예: 6월 4일)
 */
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const today = new Date();
  const todaySlot = getTimeSlotInfo(today);
  
  if (dateStr === todaySlot.date) return '오늘';
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySlot = getTimeSlotInfo(yesterday);
  if (dateStr === yesterdaySlot.date) return '어제';
  
  return `${month}월 ${day}일`;
}

/**
 * 오전 4시 기준으로 오늘의 날짜 문자열 반환
 */
export function getTodayDate(): string {
  return getTimeSlotInfo(new Date()).date;
}
