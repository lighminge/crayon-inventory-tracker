export const calculateBusinessDays = (startMs: number, endMs: number): number => {
  if (!startMs || !endMs || startMs >= endMs) return 1;

  let days = 0;
  let curMs = startMs;
  
  while (curMs < endMs) {
    const d = new Date(curMs);
    const dayOfWeek = d.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days++;
    }
    curMs += 24 * 60 * 60 * 1000;
  }
  
  return days <= 0 ? 1 : days;
};
