import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket } from '../types';
import { getTickets } from '../services/api';

export default function Dashboard() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);

  useEffect(() => {
    getTickets().then(setTickets);
  }, []);

  const stats = useMemo(() => {
    const total = tickets.length;
    const closed = tickets.filter(t => t.closeDate).length;
    const inProgress = tickets.filter(t => !t.closeDate).length;
    const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);

    const closedWithDays = tickets.filter(t => t.closeDate && t.totalProcessingDays);
    const avgDays = closedWithDays.length === 0 ? 0 : 
      Math.round(closedWithDays.reduce((sum, t) => sum + (t.totalProcessingDays || 0), 0) / closedWithDays.length);

    // Get last 6 months counts for the bar chart
    const monthlyCounts: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getMonth() + 1}月`;
      monthlyCounts[key] = 0;
    }

    tickets.forEach(t => {
      if (t.dispatchDate) {
        const d = new Date(t.dispatchDate);
        const key = `${d.getMonth() + 1}月`;
        if (monthlyCounts[key] !== undefined) {
          monthlyCounts[key]++;
        }
      }
    });

    return { total, closed, inProgress, completionRate, avgDays, monthlyCounts };
  }, [tickets]);

  return (
    <div>
      <h2>📊 儀表板 Dashboard</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
        
        <div className="doodle-border" style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--crayon-yellow)' }}>
          <h3>總盤點單</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{stats.total}</div>
        </div>

        <div className="doodle-border" style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--crayon-green)' }}>
          <h3>已結案</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{stats.closed}</div>
        </div>

        <div className="doodle-border" style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--crayon-orange)' }}>
          <h3>平均處理天數</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{stats.avgDays} <span style={{ fontSize: '1rem' }}>天</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' }}>
        <div className="doodle-border" style={{ padding: '20px' }}>
          <h3>🎯 盤點完成率 ({stats.completionRate}%)</h3>
          <div style={{ width: '100%', height: '30px', border: '3px solid var(--crayon-dark)', borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px', marginTop: '20px', overflow: 'hidden', position: 'relative' }}>
            <div style={{ 
              width: `${stats.completionRate}%`, 
              height: '100%', 
              backgroundColor: 'var(--crayon-blue)'
            }}></div>
          </div>
          <p style={{ marginTop: '10px', textAlign: 'center', color: '#666' }}>尚有 {stats.inProgress} 張單據處理中</p>
        </div>

        <div className="doodle-border" style={{ padding: '20px' }}>
          <h3>📈 近六個月盤點數量</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '150px', marginTop: '20px', borderBottom: '2px solid var(--crayon-dark)', paddingBottom: '5px' }}>
            {Object.entries(stats.monthlyCounts).map(([month, count]) => {
              const maxCount = Math.max(...Object.values(stats.monthlyCounts), 5);
              const heightPercentage = (count / maxCount) * 100;
              return (
                <div key={month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
                  <span style={{ fontSize: '0.8rem', marginBottom: '5px' }}>{count}</span>
                  <div style={{ 
                    width: '100%', 
                    height: `${heightPercentage}%`, 
                    backgroundColor: 'var(--crayon-purple)',
                    border: '2px solid var(--crayon-dark)',
                    borderBottom: 'none',
                    borderRadius: '10px 10px 0 0'
                  }}></div>
                  <span style={{ fontSize: '0.9rem', marginTop: '5px' }}>{month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
