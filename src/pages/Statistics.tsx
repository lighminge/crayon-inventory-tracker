import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel } from '../types';
import { getTickets, getPersonnel } from '../services/api';

export default function Statistics() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  
  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, pData] = await Promise.all([getTickets(), getPersonnel()]);
      setTickets(tData);
      setPersonnel(pData);
    } catch (e) {
      console.error(e);
      alert('讀取資料失敗');
    }
  };

  const statsByPerson = useMemo(() => {
    const startMs = new Date(startDate).getTime();
    // end of day for endDate
    const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1;

    // Filter tickets within date range based on dispatchDate
    const filteredTickets = tickets.filter(t => {
      if (!t.dispatchDate) return false;
      return t.dispatchDate >= startMs && t.dispatchDate <= endMs;
    });

    return personnel.map(p => {
      const pTickets = filteredTickets.filter(t => t.assigneeId === p.id);
      const total = pTickets.length;
      const closed = pTickets.filter(t => t.closeDate).length;
      const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);
      
      const closedWithDays = pTickets.filter(t => t.closeDate && t.totalProcessingDays);
      const avgDays = closedWithDays.length === 0 ? 0 : 
        Math.round(closedWithDays.reduce((sum, t) => sum + (t.totalProcessingDays || 0), 0) / closedWithDays.length);
        
      return {
        ...p,
        total,
        closed,
        completionRate,
        avgDays
      };
    }).sort((a, b) => b.total - a.total); // Sort by highest tickets
  }, [tickets, personnel, startDate, endDate]);

  return (
    <div>
      <h2>📈 統計作業</h2>

      <div className="doodle-border" style={{ padding: '20px', marginBottom: '30px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>📅 選擇日期區間：</h3>
        <div>
          <label>從：</label>
          <input type="date" className="doodle-input" style={{ width: 'auto' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label>至：</label>
          <input type="date" className="doodle-input" style={{ width: 'auto' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {statsByPerson.map(stat => (
          <div key={stat.id} className="doodle-border" style={{ padding: '20px', backgroundColor: 'var(--crayon-paper)' }}>
            <h3 style={{ borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px', margin: '0 0 15px 0' }}>
              {stat.name} <span style={{ fontSize: '0.9rem', color: '#666' }}>({stat.title})</span>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ textAlign: 'center', backgroundColor: '#f0f8ff', padding: '10px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>總盤點數</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stat.total}</div>
              </div>
              
              <div style={{ textAlign: 'center', backgroundColor: '#fff0f5', padding: '10px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>平均天數</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>{stat.avgDays}</div>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '0.9rem' }}>完成率 ({stat.closed}/{stat.total})</span>
                <span style={{ fontWeight: 'bold' }}>{stat.completionRate}%</span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${stat.completionRate}%`, 
                  height: '100%', 
                  backgroundColor: stat.completionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-blue)' 
                }}></div>
              </div>
            </div>
          </div>
        ))}
        {statsByPerson.length === 0 && <p>查無人員資料。</p>}
      </div>
    </div>
  );
}
