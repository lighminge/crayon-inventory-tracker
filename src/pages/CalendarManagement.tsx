import React, { useState, useEffect, useMemo } from 'react';
import { getHolidays, saveHoliday, deleteHoliday } from '../services/api';
import type { HolidaySetting } from '../types';
import CrayonDatePicker from '../components/CrayonDatePicker';

const CalendarManagement: React.FC = () => {
  const [holidays, setHolidays] = useState<HolidaySetting[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
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

  const handleAdd = async () => {
    if (!date) {
      alert('請選擇日期');
      return;
    }
    if (!description.trim()) {
      alert('請輸入說明');
      return;
    }

    setSaving(true);
    try {
      const newSetting: HolidaySetting = {
        id: date,
        date: date,
        type,
        description: description.trim()
      };
      await saveHoliday(newSetting);
      alert('新增成功');
      setDescription('');
      fetchHolidays();
    } catch (error: any) {
      alert('新增失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除這個設定嗎？')) return;
    try {
      await deleteHoliday(id);
      fetchHolidays();
    } catch (error: any) {
      alert('刪除失敗：' + error.message);
    }
  };

  const sortedHolidays = useMemo(() => {
    return [...holidays].sort((a, b) => b.date.localeCompare(a.date));
  }, [holidays]);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="doodle-border" style={{ backgroundColor: 'white', padding: '20px' }}>
        <h2 style={{ marginTop: 0, color: 'var(--crayon-orange)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          📅 行事曆管理
        </h2>
        <p style={{ color: '#555', marginBottom: '20px' }}>
          您可以在這裡設定特定的放假日期（例如連假、國定假日）或補班日期。
          系統在計算各項業務的「處理天數」時，會自動略過設定為「放假」的日子，並將「補班日」視為工作天。
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'end', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '10px', border: '2px dashed var(--crayon-dark)' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>選擇日期</label>
            <CrayonDatePicker value={date} onChange={setDate} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>類型</label>
            <select 
              className="doodle-input" 
              value={type} 
              onChange={e => setType(e.target.value as 'holiday' | 'workday')}
              style={{ padding: '8px', width: '100%' }}
            >
              <option value="holiday">🛑 放假 (跳過計算)</option>
              <option value="workday">💼 補班 (計入工作天)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>說明 (例如: 春節連假)</label>
            <input 
              className="doodle-input" 
              type="text" 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="請輸入說明..."
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div>
            <button 
              className="doodle-button" 
              onClick={handleAdd}
              disabled={saving}
              style={{ width: '100%', backgroundColor: 'var(--crayon-orange)', color: 'white' }}
            >
              {saving ? '儲存中...' : '➕ 新增設定'}
            </button>
          </div>
        </div>
      </div>

      <div className="doodle-border" style={{ backgroundColor: 'white', padding: '20px' }}>
        <h3 style={{ marginTop: 0, color: 'var(--crayon-dark)' }}>📋 目前設定列表</h3>
        
        {loading ? (
          <p>載入中...</p>
        ) : sortedHolidays.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '30px' }}>目前沒有任何特殊的行事曆設定。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '3px dashed var(--crayon-dark)', color: 'var(--crayon-dark)' }}>
                  <th style={{ padding: '10px' }}>日期</th>
                  <th style={{ padding: '10px' }}>類型</th>
                  <th style={{ padding: '10px' }}>說明</th>
                  <th style={{ padding: '10px', width: '100px', textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedHolidays.map(h => (
                  <tr key={h.id} style={{ borderBottom: '1px dashed #ccc' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{h.date}</td>
                    <td style={{ padding: '10px' }}>
                      {h.type === 'holiday' ? (
                        <span style={{ backgroundColor: '#ffcdd2', color: '#c62828', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>🛑 放假</span>
                      ) : (
                        <span style={{ backgroundColor: '#c8e6c9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>💼 補班</span>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>{h.description}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button 
                        className="doodle-button danger" 
                        onClick={() => handleDelete(h.id)}
                        style={{ padding: '5px 10px', fontSize: '0.9rem' }}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarManagement;
