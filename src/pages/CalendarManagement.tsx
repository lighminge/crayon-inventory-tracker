import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getHolidays, saveHoliday, deleteHoliday, getTasks, getTickets } from '../services/api';
import type { HolidaySetting, InventoryTask } from '../types';
import { getTaiwanDateInfo } from '../utils/taiwanFestivals';

type TaskWithStatus = InventoryTask & { isCompleted?: boolean, completedDate?: number };

const TASK_COLORS = [
  'var(--crayon-blue)',
  'var(--crayon-purple)',
  'var(--crayon-orange)',
  '#00897b', // Teal
  '#e53935', // Red
  '#3949ab', // Indigo
  '#8e24aa', // Purple variant
  '#f06292'  // Pink
];

const CalendarManagement: React.FC = () => {
  const [holidays, setHolidays] = useState<HolidaySetting[]>([]);
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Calendar View State
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(() => {
    if (location.state?.targetDate) {
      return new Date(location.state.targetDate);
    }
    return new Date();
  });

  useEffect(() => {
    if (location.state?.targetDate) {
      setCurrentDate(new Date(location.state.targetDate));
    }
  }, [location.state]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [type, setType] = useState<'holiday' | 'workday'>('holiday');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Confirm Delete Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<string | null>(null);

  // List View State
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [holidayData, taskData, ticketData] = await Promise.all([
        getHolidays(),
        getTasks(),
        getTickets()
      ]);

      const tasksWithStats = taskData.map(task => {
        const linkedTickets = ticketData.filter(t => t.taskId === task.id);
        const completedTickets = linkedTickets.filter(t => t.closeDate);
        const completedItems = completedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
        const isCompleted = task.totalItemCount > 0 && completedItems >= task.totalItemCount;
        const completedDate = isCompleted && completedTickets.length > 0 ? Math.max(...completedTickets.map(t => t.closeDate || 0)) : undefined;
        return { ...task, isCompleted, completedDate };
      });

      setHolidays(holidayData);
      setTasks(tasksWithStats);
    } catch (error: any) {
      alert('無法取得資料：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value) - 1, 1));
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
      fetchData();
    } catch (error: any) {
      alert('儲存失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (dateStr: string = selectedDateStr) => {
    setDeleteConfirmTarget(dateStr);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    setSaving(true);
    try {
      await deleteHoliday(deleteConfirmTarget);
      setDeleteConfirmTarget(null);
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      alert('刪除失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const jumpToDateAndEdit = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    setCurrentDate(new Date(parseInt(y), parseInt(m) - 1, parseInt(d)));
    openModal(dateStr);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calendar rendering logic
  const { calendarDays, monthStats } = useMemo(() => {
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

    let weekendCount = 0;
    let customHolidayCount = 0;
    let customWorkdayCount = 0;
    let workdayCount = 0;

    // Fill actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      
      const taiwanInfo = getTaiwanDateInfo(dateObj);
      const customSetting = holidayMap.get(dateStr);
      
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      if (isWeekend) weekendCount++;
      if (customSetting?.type === 'holiday') customHolidayCount++;
      if (customSetting?.type === 'workday') customWorkdayCount++;

      let isWorkingDay = !isWeekend;
      if (customSetting) {
        if (customSetting.type === 'holiday') isWorkingDay = false;
        if (customSetting.type === 'workday') isWorkingDay = true;
      }
      if (isWorkingDay) workdayCount++;

      const startOfDay = dateObj.getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
      const overlappingTasks = tasks.filter(t => t.startDate <= endOfDay && t.endDate >= startOfDay);

      days.push({
        date: i,
        dateStr,
        isToday,
        isWeekend,
        festivals: taiwanInfo.festivals,
        customSetting,
        overlappingTasks
      });
    }
    return { calendarDays: days, monthStats: { weekendCount, customHolidayCount, customWorkdayCount, workdayCount } };
  }, [currentDate, holidays, tasks]);

  const existingSettingForModal = holidays.find(h => h.date === selectedDateStr);
  const selectedTaiwanInfo = selectedDateStr ? getTaiwanDateInfo(new Date(selectedDateStr)) : null;
  const hasFestivalInModal = selectedTaiwanInfo && selectedTaiwanInfo.festivals.length > 0;

  // List View logic
  const filteredList = useMemo(() => {
    let list = holidays.filter(h => {
      const [y, m] = h.date.split('-');
      if (filterYear !== 'all' && y !== filterYear) return false;
      if (filterMonth !== 'all' && m !== filterMonth) return false;
      return true;
    });

    list.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [holidays, filterYear, filterMonth, sortOrder]);

  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;

  // Unique years for filter
  const availableYears = useMemo(() => {
    const years = new Set(holidays.map(h => h.date.split('-')[0]));
    years.add(new Date().getFullYear().toString()); // always include current year
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [holidays]);

  // Pagination controls (reused above and below the table)
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
        <button 
          className="doodle-button secondary"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          上一頁
        </button>
        <span style={{ fontWeight: 'bold', color: 'var(--crayon-dark)' }}>
          第 {currentPage} / {totalPages} 頁
        </span>
        <button 
          className="doodle-button secondary"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          下一頁
        </button>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Calendar Section */}
      <div className="doodle-border" style={{ backgroundColor: 'white', padding: '20px', position: 'relative' }}>
        <h2 style={{ marginTop: 0, color: 'var(--crayon-orange)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          📅 行事曆管理
        </h2>
        
        {/* Month Stats */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '8px', border: '1px solid #ddd' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--crayon-dark)' }}>{currentDate.getMonth() + 1}月統計：</span>
          <span style={{ color: '#555' }}>一般週末：{monthStats.weekendCount} 天</span>
          <span style={{ color: 'var(--crayon-red)' }}>設定放假：{monthStats.customHolidayCount} 天</span>
          <span style={{ color: 'var(--crayon-green)' }}>設定補班：{monthStats.customWorkdayCount} 天</span>
          <span style={{ color: '#1976d2', fontWeight: 'bold' }}>工作天數：{monthStats.workdayCount} 天</span>
        </div>

        {/* Calendar Navigation & Quick Jump */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <button className="doodle-button" onClick={handlePrevMonth}>◀ 上個月</button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select className="doodle-input" value={currentDate.getFullYear()} onChange={handleYearChange} style={{ fontSize: '1.2rem', padding: '5px 10px' }}>
              {Array.from({length: 10}, (_, i) => currentDate.getFullYear() - 5 + i).map(y => (
                <option key={y} value={y}>{y} 年</option>
              ))}
            </select>
            <select className="doodle-input" value={currentDate.getMonth() + 1} onChange={handleMonthChange} style={{ fontSize: '1.2rem', padding: '5px 10px' }}>
              {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m} 月</option>
              ))}
            </select>
          </div>

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
              
              const hasCustom = !!day.customSetting;
              
              return (
                <div 
                  key={day.dateStr}
                  onClick={() => openModal(day.dateStr)}
                  className="doodle-border"
                  style={{ 
                    border: day.isToday ? '4px solid var(--crayon-orange)' : day.overlappingTasks.length > 0 ? '3px solid #9fa8da' : '3px solid var(--crayon-dark)',
                    padding: '5px',
                    minHeight: '100px',
                    backgroundColor: day.isToday ? '#fff8e1' : day.overlappingTasks.length > 0 ? '#e8eaf6' : day.isWeekend ? '#fefefe' : 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'transform 0.1s',
                    boxShadow: day.isToday ? '4px 4px 0px var(--crayon-orange)' : '4px 4px 0px rgba(0,0,0,1)',
                    transform: day.isToday ? 'scale(1.02)' : 'none'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
                  onMouseOut={e => e.currentTarget.style.transform = day.isToday ? 'scale(1.02)' : 'scale(1)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ 
                      fontSize: '1.2rem', 
                      fontWeight: 'bold',
                      color: day.isToday ? 'var(--crayon-red)' : day.isWeekend ? '#d32f2f' : 'var(--crayon-dark)',
                      backgroundColor: day.isToday ? '#ffcdd2' : 'transparent',
                      padding: day.isToday ? '2px 8px' : '0',
                      borderRadius: '50%'
                    }}>
                      {day.date}
                    </span>
                    {day.isToday && (
                      <span style={{ 
                        fontSize: '0.9rem', 
                        color: 'white', 
                        fontWeight: 'bold',
                        backgroundColor: 'var(--crayon-red)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        boxShadow: '1px 1px 0px rgba(0,0,0,0.2)'
                      }}>
                        今天
                      </span>
                    )}
                  </div>
                  
                  {/* 台灣節日 / 節氣 */}
                  <div style={{ marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {day.festivals.map((f: string, i: number) => (
                      <span key={i} style={{ fontSize: '0.8rem', color: '#1565c0', backgroundColor: '#e3f2fd', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                        {f}
                      </span>
                    ))}
                  </div>

                  {/* 盤點任務 */}
                  {day.overlappingTasks && day.overlappingTasks.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {day.overlappingTasks.map((t: TaskWithStatus) => {
                        const taskIndex = tasks.findIndex(x => x.id === t.id);
                        const colorIndex = taskIndex >= 0 ? taskIndex % TASK_COLORS.length : 0;
                        
                        let isCompletedToday = false;
                        if (t.isCompleted && t.completedDate) {
                          const completedDateObj = new Date(t.completedDate);
                          if (completedDateObj.getFullYear() === currentDate.getFullYear() && 
                              completedDateObj.getMonth() === currentDate.getMonth() && 
                              completedDateObj.getDate() === day.date) {
                            isCompletedToday = true;
                          }
                        }
                        
                        let isExpiredLastDay = false;
                        if (!t.isCompleted) {
                          const endDateObj = new Date(t.endDate);
                          const isExpired = endDateObj.getTime() < new Date().setHours(0, 0, 0, 0);
                          if (isExpired &&
                              endDateObj.getFullYear() === currentDate.getFullYear() &&
                              endDateObj.getMonth() === currentDate.getMonth() &&
                              endDateObj.getDate() === day.date) {
                            isExpiredLastDay = true;
                          }
                        }
                        
                        const taskBgColor = TASK_COLORS[colorIndex];
                        return (
                        <div key={t.id} style={{ 
                          position: 'relative',
                          fontSize: '0.8rem', 
                          backgroundColor: taskBgColor, 
                          color: 'white', 
                          padding: '6px 6px', 
                          borderRadius: '4px', 
                          fontWeight: 'bold',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          lineHeight: '1.2',
                          boxShadow: '1px 1px 0px rgba(0,0,0,0.2)'
                        }}>
                          📋 {t.name}
                          {isCompletedToday && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-5px',
                              backgroundColor: 'var(--crayon-green)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '8px',
                              transform: 'rotate(5deg)',
                              fontSize: '0.7rem',
                              fontWeight: '900',
                              border: '1px solid var(--crayon-dark)',
                              boxShadow: '1px 1px 0px rgba(0,0,0,0.2)',
                              zIndex: 2,
                              whiteSpace: 'nowrap'
                            }}>
                              ✔️ 已完成
                            </div>
                          )}
                          {isExpiredLastDay && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-5px',
                              backgroundColor: 'var(--crayon-red)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '8px',
                              transform: 'rotate(-5deg)',
                              fontSize: '0.7rem',
                              fontWeight: '900',
                              border: '1px solid var(--crayon-dark)',
                              boxShadow: '1px 1px 0px rgba(0,0,0,0.2)',
                              zIndex: 2,
                              whiteSpace: 'nowrap'
                            }}>
                              ❌ 未完成
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}

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

      {/* List Section */}
      <div className="doodle-border" style={{ backgroundColor: 'white', padding: '20px' }}>
        <h3 style={{ marginTop: 0, color: 'var(--crayon-blue)' }}>📋 已設定放假及補假清單</h3>
        
        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px', fontSize: '0.9rem', color: '#1565c0' }}>
          💡 <strong>顏色說明：</strong> 帶有 <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#cfd8dc', border: '1px solid #90a4ae', margin: '0 4px', verticalAlign: 'middle' }}></span> 藍灰色背景的項目，代表該日期<strong>已經過去</strong>。
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold' }}>查詢年度：</label>
            <select className="doodle-input" value={filterYear} onChange={e => {setFilterYear(e.target.value); setCurrentPage(1);}}>
              <option value="all">全部</option>
              {availableYears.map(y => <option key={y} value={y}>{y} 年</option>)}
            </select>
            
            <label style={{ fontWeight: 'bold', marginLeft: '10px' }}>月份：</label>
            <select className="doodle-input" value={filterMonth} onChange={e => {setFilterMonth(e.target.value); setCurrentPage(1);}}>
              <option value="all">全部</option>
              {Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{m} 月</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--crayon-dark)', backgroundColor: '#fff3e0', padding: '5px 10px', borderRadius: '5px' }}>
              共 {filteredList.length} 筆設定
            </span>
            <div>
              <label style={{ marginRight: '5px' }}>每頁顯示：</label>
              <select className="doodle-input" value={itemsPerPage} onChange={e => {setItemsPerPage(Number(e.target.value)); setCurrentPage(1);}}>
                {[10, 20, 30, 40, 50].map(v => <option key={v} value={v}>{v} 筆</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Top Pagination */}
        <div style={{ marginBottom: '15px' }}>
          {renderPagination()}
        </div>

        <table className="doodle-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'center', width: '60px' }}>序號</th>
              <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'left', cursor: 'pointer' }} onClick={() => { setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); setCurrentPage(1); }}>
                日期 {sortOrder === 'desc' ? '▼' : '▲'}
              </th>
              <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'left' }}>類型</th>
              <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'left' }}>目的 / 說明</th>
              <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>無符合條件的設定</td></tr>
            ) : (
              paginatedList.map((h, idx) => {
                const isPast = new Date(h.date).getTime() < new Date(new Date().toISOString().split('T')[0]).getTime();
                return (
                <tr key={h.id} style={{ borderBottom: '1px dashed #ccc', backgroundColor: isPast ? '#cfd8dc' : 'transparent' }}>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#777' }}>
                    {(currentPage - 1) * itemsPerPage + idx + 1}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{h.date}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem',
                      backgroundColor: h.type === 'holiday' ? '#ffcdd2' : '#c8e6c9',
                      color: h.type === 'holiday' ? '#c62828' : '#2e7d32',
                      border: `1px solid ${h.type === 'holiday' ? '#c62828' : '#2e7d32'}`
                    }}>
                      {h.type === 'holiday' ? '🛑 放假' : '💼 補班'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{h.description}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button className="doodle-button" style={{ padding: '5px 10px', fontSize: '0.9rem', marginRight: '5px' }} onClick={() => jumpToDateAndEdit(h.date)}>
                      修改
                    </button>
                    <button className="doodle-button danger" style={{ padding: '5px 10px', fontSize: '0.9rem' }} onClick={() => promptDelete(h.id)}>
                      刪除
                    </button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Bottom Pagination */}
        {renderPagination()}
      </div>

      {/* Modal for adding/editing holidays */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="doodle-border" style={{ backgroundColor: 'white', padding: '30px', width: '400px', maxWidth: '90%' }}>
            {hasFestivalInModal && (
              <div style={{ 
                backgroundColor: '#fff3e0', borderLeft: '5px solid var(--crayon-orange)', 
                padding: '10px', marginBottom: '15px', borderRadius: '4px' 
              }}>
                <div style={{ fontWeight: 'bold', color: '#e65100', marginBottom: '5px' }}>💡 特殊節日提醒</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {selectedTaiwanInfo?.festivals.map((f, i) => (
                    <span key={i} style={{ backgroundColor: 'var(--crayon-orange)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.85rem' }}>{f}</span>
                  ))}
                </div>
              </div>
            )}
            
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
                    onClick={() => promptDelete(selectedDateStr)}
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
      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
        }}>
          <div className="doodle-border" style={{ backgroundColor: 'white', padding: '30px', width: '350px', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, color: 'var(--crayon-red)' }}>⚠️ 刪除確認</h3>
            <p>確定要刪除 {deleteConfirmTarget} 的設定嗎？刪除後相關的處理天數將會重新計算。</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
              <button 
                className="doodle-button danger" 
                onClick={confirmDelete}
                disabled={saving}
              >
                {saving ? '處理中...' : '確定刪除'}
              </button>
              <button 
                className="doodle-button secondary" 
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={saving}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarManagement;
