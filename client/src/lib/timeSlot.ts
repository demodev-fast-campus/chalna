/**
 * 오전 4시 기준 날짜/시간 슬롯 유틸리티 (UTC+9 한국 시간대)
 * - 새벽 0~3시는 전날 날짜로 분류
 * - 시간 슬롯은 HH:00 단위
 */

export type TimeSlotInfo = {
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
};

/**
 * 주어진 Date에서 오전 4시 기준 날짜와 시간 슬롯을 반환 (UTC+9 한국 시간대)
 */
export function getTimeSlotInfo(date: Date = new Date()): TimeSlotInfo {
  // UTC+9 한국 시간대로 변환
  const utcTime = date.getTime();
  const koreaTime = new Date(utcTime + 9 * 60 * 60 * 1000);
  
  const hour = koreaTime.getUTCHours();
  const year = koreaTime.getUTCFullYear();
  const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
  let day = koreaTime.getUTCDate();
  
  // 0~3시는 전날로 분류
  if (hour < 4) {
    day = day - 1;
    if (day < 1) {
      // 월 변경 처리
      const prevMonth = new Date(utcTime + 9 * 60 * 60 * 1000);
      prevMonth.setUTCDate(0);
      return getTimeSlotInfo(new Date(utcTime - 24 * 60 * 60 * 1000));
    }
  }
  
  return {
    date: `${year}-${month}-${String(day).padStart(2, '0')}`,
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
  const today = new Date();
  const todaySlot = getTimeSlotInfo(today);
  
  if (dateStr === todaySlot.date) return '오늘';
  
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdaySlot = getTimeSlotInfo(yesterday);
  if (dateStr === yesterdaySlot.date) return '어제';
  
  return `${month}월 ${day}일`;
}

/**
 * 오전 4시 기준으로 오늘의 날짜 문자열 반환 (UTC+9 한국 시간대)
 */
export function getTodayDate(): string {
  return getTimeSlotInfo(new Date()).date;
}
