import React, { useState, useEffect, useMemo } from 'react';
import { getHolidays, saveHoliday, deleteHoliday } from '../services/api';
import type { HolidaySetting } from '../types';
import { getTaiwanDateInfo } from '../utils/taiwanFestivals';

const CalendarManagement: React.FC = () => {
  const [holidays, setHolidays] = useState<HolidaySetting[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Calendar View State
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [type, setType] = useState<'holiday' | 'workday'>('holiday');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const data = await getHolidays();
      setHolidays(data);
    } catch (error: any) {
      alert('無法取得行事曆設定：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const openModal = (dateStr: string) => {
    const existing = holidays.find(h => h.date === dateStr);
    setSelectedDateStr(dateStr);
    if (existing) {
      setType(existing.type);
      setDescription(existing.description);
    } else {
      setType('holiday');
      setDescription('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      alert('請輸入說明');
      return;
    }
    setSaving(true);
    try {
      const newSetting: HolidaySetting = {
        id: selectedDateStr,
        date: selectedDateStr,
        type,
        description: description.trim()
      };
      await saveHoliday(newSetting);
      setIsModalOpen(false);
      fetchHolidays();
    } catch (error: any) {
      alert('儲存失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('確定要刪除此設定嗎？')) return;
    setSaving(true);
    try {
      await deleteHoliday(selectedDateStr);
      setIsModalOpen(false);
      fetchHolidays();
    } catch (error: any) {
      alert('刪除失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Calendar rendering logic
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: any[] = [];
    
    // Empty prefix cells
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    const holidayMap = new Map(holidays.map(h => [h.date, h]));

    // Fill actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      
      const taiwanInfo = getTaiwanDateInfo(dateObj);
      const customSetting = holidayMap.get(dateStr);
      
      days.push({
        date: i,
        dateStr,
        isToday,
        festivals: taiwanInfo.festivals,
        customSetting
      });
    }
    return days;
  }, [currentDate, holidays]);

  const existingSettingForModal = holidays.find(h => h.date === selectedDateStr);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="doodle-border" style={{ backgroundColor: 'white', padding: '20px', position: 'relative' }}>
        <h2 style={{ marginTop: 0, color: 'var(--crayon-orange)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          📅 行事曆管理
        </h2>
        <p style={{ color: '#555', marginBottom: '20px' }}>
          點擊任一日期，即可設定「放假」或「補班」。系統將自動計算並調整盤點單處理天數。
        </p>

        {/* Calendar Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button className="doodle-button" onClick={handlePrevMonth}>◀ 上個月</button>
          <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--crayon-dark)' }}>
            {currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月
          </h3>
          <button className="doodle-button" onClick={handleNextMonth}>下個月 ▶</button>
        </div>

        {/* Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', minHeight: '600px' }}>
          {['日', '一', '二', '三', '四', '五', '六'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', padding: '10px', backgroundColor: 'var(--crayon-blue)', color: 'white', borderRadius: '5px' }}>
              星期{d}
            </div>
          ))}
          
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px' }}>載入中...</div>
          ) : (
            calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} style={{ backgroundColor: '#f0f0f0', borderRadius: '5px', border: '1px dashed #ccc' }} />;
              
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;
              const hasCustom = !!day.customSetting;
              
              return (
                <div 
                  key={day.dateStr}
                  onClick={() => openModal(day.dateStr)}
                  style={{ 
                    border: day.isToday ? '3px solid var(--crayon-red)' : '2px solid var(--crayon-dark)',
                    borderRadius: '8px',
                    padding: '5px',
                    minHeight: '100px',
                    backgroundColor: day.isToday ? '#fff0f0' : isWeekend ? '#fefefe' : 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'transform 0.1s',
                    boxShadow: day.isToday ? '0 0 10px rgba(229, 57, 53, 0.4)' : '2px 2px 0px rgba(0,0,0,0.1)'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ 
                      fontSize: '1.2rem', 
                      fontWeight: 'bold',
                      color: day.isToday ? 'var(--crayon-red)' : isWeekend ? '#d32f2f' : 'var(--crayon-dark)',
                      backgroundColor: day.isToday ? '#ffcdd2' : 'transparent',
                      padding: day.isToday ? '2px 8px' : '0',
                      borderRadius: '50%'
                    }}>
                      {day.date}
                    </span>
                    {day.isToday && <span style={{ fontSize: '0.8rem', color: 'var(--crayon-red)', fontWeight: 'bold' }}>今天</span>}
                  </div>
                  
                  {/* 台灣節日 / 節氣 */}
                  <div style={{ marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {day.festivals.map((f: string, i: number) => (
                      <span key={i} style={{ fontSize: '0.8rem', color: '#1565c0', backgroundColor: '#e3f2fd', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                        {f}
                      </span>
                    ))}
                  </div>

                  {/* 自訂設定 (放假/補班) */}
                  {hasCustom && (
                    <div style={{ 
                      marginTop: 'auto',
                      padding: '4px',
                      backgroundColor: day.customSetting.type === 'holiday' ? '#ffcdd2' : '#c8e6c9',
                      color: day.customSetting.type === 'holiday' ? '#c62828' : '#2e7d32',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: `1px dashed ${day.customSetting.type === 'holiday' ? '#c62828' : '#2e7d32'}`
                    }}>
                      {day.customSetting.type === 'holiday' ? '🛑 放假' : '💼 補班'}
                      <div style={{ fontSize: '0.75rem', fontWeight: 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {day.customSetting.description}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal for adding/editing holidays */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="doodle-border" style={{ backgroundColor: 'white', padding: '30px', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0, color: 'var(--crayon-dark)' }}>
              設定日期：{selectedDateStr}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>類型</label>
                <select 
                  className="doodle-input" 
                  value={type} 
                  onChange={e => setType(e.target.value as 'holiday' | 'workday')}
                  style={{ padding: '10px', width: '100%' }}
                >
                  <option value="holiday">🛑 放假 (跳過計算)</option>
                  <option value="workday">💼 補班 (計入工作天)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>目的/說明</label>
                <input 
                  className="doodle-input" 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="例如：春節連假、彈性補班..."
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  className="doodle-button" 
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 1, backgroundColor: 'var(--crayon-orange)', color: 'white' }}
                >
                  {saving ? '儲存中...' : '儲存設定'}
                </button>
                {existingSettingForModal && (
                  <button 
                    className="doodle-button danger" 
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    刪除設定
                  </button>
                )}
                <button 
                  className="doodle-button secondary" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarManagement;
