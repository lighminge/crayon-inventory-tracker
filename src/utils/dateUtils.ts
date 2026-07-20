export const calculateBusinessDays = (startMs: number, endMs: number): number => {
  if (!startMs || !endMs) return 0;
  
  const start = new Date(startMs);
  start.setHours(0,0,0,0);
  const end = new Date(endMs);
  end.setHours(0,0,0,0);

  if (start.getTime() > end.getTime()) return 0;

  let days = 0;
  let curMs = start.getTime();
  const endTime = end.getTime();
  
  while (curMs < endTime) {
    const d = new Date(curMs);
    const dayOfWeek = d.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days++;
    }
    curMs += 24 * 60 * 60 * 1000;
  }
  
  return days;
};
