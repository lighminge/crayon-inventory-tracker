import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel } from '../types';
import { getTickets, getPersonnel } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);

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

  const stats = useMemo(() => {
    const total = tickets.length;
    const closed = tickets.filter(t => t.closeDate).length;
    const inProgress = tickets.filter(t => !t.closeDate).length;
    const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);

    const closedWithDays = tickets.filter(t => t.closeDate && t.totalProcessingDays);
    const avgDays = closedWithDays.length === 0 ? 0 : 
      Math.round(closedWithDays.reduce((sum, t) => sum + (t.totalProcessingDays || 0), 0) / closedWithDays.length);

    // Chart data for last 6 months
    const chartData = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getMonth() + 1}月`;
      const monthTickets = tickets.filter(t => {
        if (!t.dispatchDate) return false;
        const td = new Date(t.dispatchDate);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
      }).length;
      chartData.push({ month: monthStr, count: monthTickets });
    }

    return { total, inProgress, completionRate, avgDays, chartData };
  }, [tickets]);

  // Unfinished tickets per person
  const unfinishedPerPerson = useMemo(() => {
    const inProgressTickets = tickets.filter(t => !t.closeDate);
    return personnel.map(p => ({
      ...p,
      count: inProgressTickets.filter(t => t.assigneeId === p.id).length
    })).filter(p => p.count > 0).sort((a, b) => b.count - a.count);
  }, [tickets, personnel]);

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>📊 儀表板</h2>
      
      {/* 核心指標區塊 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="doodle-border" style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff3e0' }}>
          <h3>處理中單據</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--crayon-orange)' }}>{stats.inProgress}</div>
        </div>
        
        <div className="doodle-border" style={{ padding: '20px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>
          <h3>整體完成率</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--crayon-blue)' }}>{stats.completionRate}%</div>
        </div>
        
        <div className="doodle-border" style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f3e5f5' }}>
          <h3>平均處理天數</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--crayon-purple)' }}>{stats.avgDays} <span style={{fontSize:'1rem'}}>天</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {/* 近半年盤點數量趨勢 (Recharts) */}
        <div className="doodle-border" style={{ padding: '20px', backgroundColor: 'var(--crayon-paper)' }}>
          <h3 style={{ marginTop: 0, borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>📈 近六個月盤點數量</h3>
          <div style={{ height: '300px', marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18}} />
                <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18}} allowDecimals={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.05)'}}
                  contentStyle={{
                    fontFamily: 'Caveat, cursive', 
                    fontSize: '1.2rem',
                    borderRadius: '10px',
                    border: '2px solid var(--crayon-dark)',
                    boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'
                  }}
                />
                <Bar dataKey="count" name="盤點數量" fill="var(--crayon-purple)" radius={[5, 5, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 人員未完成清單 */}
        <div className="doodle-border" style={{ padding: '20px', backgroundColor: '#f5f5f5' }}>
          <h3 style={{ marginTop: 0, borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>👥 備料人員未完成件數</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
            {unfinishedPerPerson.map(p => (
              <div key={p.id} className="doodle-border" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: 'white' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>{p.title}</div>
                </div>
                <div style={{ 
                  backgroundColor: 'var(--crayon-red)', 
                  color: 'white', 
                  padding: '5px 15px', 
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  border: '2px solid var(--crayon-dark)'
                }}>
                  {p.count} 件
                </div>
              </div>
            ))}
            {unfinishedPerPerson.length === 0 && (
              <div style={{ textAlign: 'center', color: '#888', marginTop: '30px' }}>目前所有人員皆無待辦盤點單。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
