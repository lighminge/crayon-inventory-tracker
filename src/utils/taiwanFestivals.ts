// @ts-ignore
import { Lunar, Solar } from 'lunar-javascript';

// 繁體中文字對照表 (針對 24 節氣)
const jieQiMapping: Record<string, string> = {
  '立春': '立春',
  '雨水': '雨水',
  '惊蛰': '驚蟄',
  '春分': '春分',
  '清明': '清明',
  '谷雨': '穀雨',
  '立夏': '立夏',
  '小满': '小滿',
  '芒种': '芒種',
  '夏至': '夏至',
  '小暑': '小暑',
  '大暑': '大暑',
  '立秋': '立秋',
  '处暑': '處暑',
  '白露': '白露',
  '秋分': '秋分',
  '寒露': '寒露',
  '霜降': '霜降',
  '立冬': '立冬',
  '小雪': '小雪',
  '大雪': '大雪',
  '冬至': '冬至',
  '小寒': '小寒',
  '大寒': '大寒'
};

// 台灣固定公曆節日 (國定假日或其他重要節日)
// 格式: 'MM-DD': '節日名稱'
const solarFestivals: Record<string, string> = {
  '01-01': '元旦',
  '02-28': '和平紀念日',
  '04-04': '兒童節', // 註：兒童節與清明節有時會重疊或連假，此處為固定公曆
  '05-01': '勞動節',
  '10-10': '國慶日',
};

// 台灣農曆節日
// 格式: 'MM-DD': '節日名稱' (MM為農曆月, DD為農曆日)
const lunarFestivals: Record<string, string> = {
  '01-01': '春節',
  '01-02': '初二',
  '01-03': '初三',
  '01-15': '元宵節',
  '05-05': '端午節',
  '07-15': '中元節',
  '08-15': '中秋節',
  '09-09': '重陽節',
  '12-08': '臘八節',
  '12-30': '除夕' // 注意：除夕可能是12-29或12-30，程式中會另外判斷
};

export interface TaiwanDateInfo {
  dateStr: string;
  weekStr: string;
  festivals: string[];
}

export function getTaiwanDateInfo(date: Date): TaiwanDateInfo {
  const solar = Solar.fromDate(date);
  const lunar = Lunar.fromDate(date);
  
  const d = solar.toYmd();
  const w = '星期' + solar.getWeekInChinese();
  
  const festivals: string[] = [];
  
  // 1. 公曆節日
  const mm = String(solar.getMonth()).padStart(2, '0');
  const dd = String(solar.getDay()).padStart(2, '0');
  const solarKey = `${mm}-${dd}`;
  if (solarFestivals[solarKey]) {
    festivals.push(solarFestivals[solarKey]);
  }
  
  // 2. 農曆節日
  const lMm = String(lunar.getMonth()).padStart(2, '0');
  const lDd = String(lunar.getDay()).padStart(2, '0');
  const lunarKey = `${lMm}-${lDd}`;
  
  if (lunarFestivals[lunarKey]) {
    festivals.push(lunarFestivals[lunarKey]);
  } else if (lMm === '12') {
    // Simplest approach: if tomorrow is month 1, day 1, today is 除夕
    const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowLunar = Lunar.fromDate(tomorrow);
    if (tomorrowLunar.getMonth() === 1 && tomorrowLunar.getDay() === 1) {
      if (!festivals.includes('除夕')) {
        festivals.push('除夕');
      }
    }
  }

  // 特殊節日：清明節 (依據節氣)
  const jieQi = lunar.getJieQi();
  if (jieQi) {
    const tJieQi = jieQiMapping[jieQi] || jieQi;
    if (!festivals.includes(tJieQi)) {
      festivals.push(tJieQi);
    }
  }
  
  // 特殊節日：母親節 (五月第二個星期日)
  if (solar.getMonth() === 5 && solar.getWeek() === 0) {
    const day = solar.getDay();
    if (day > 7 && day <= 14) {
      festivals.push('母親節');
    }
  }

  // 特殊節日：父親節 (八月八日)
  if (solar.getMonth() === 8 && solar.getDay() === 8) {
    festivals.push('父親節');
  }

  return {
    dateStr: d,
    weekStr: w,
    festivals
  };
}
