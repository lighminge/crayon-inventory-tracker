import type { HolidaySetting } from '../types';

export const calculateBusinessDays = (startMs: number, endMs: number, holidays: HolidaySetting[] = []): number => {
  if (!startMs || !endMs) return 0;
  
  const start = new Date(startMs);
  start.setHours(0,0,0,0);
  const end = new Date(endMs);
  end.setHours(0,0,0,0);

  if (start.getTime() > end.getTime()) return 0;

  let days = 0;
  let curMs = start.getTime();
  const endTime = end.getTime();
  
  const holidayMap = new Map(holidays.map(h => [h.date, h]));
  
  while (curMs <= endTime) {
    const d = new Date(curMs);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const holidaySetting = holidayMap.get(dateStr);
    
    if (holidaySetting) {
      if (holidaySetting.type === 'workday') {
        days++;
      }
      // If type === 'holiday', do nothing (skip counting)
    } else {
      // Normal logic
      if (!isWeekend) {
        days++;
      }
    }
    curMs += 24 * 60 * 60 * 1000;
  }
  
  return Math.max(0, days - 1);
};
