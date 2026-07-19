import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel, Workflow } from '../types';
import { getTickets, getPersonnel, getWorkflows } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';

export default function Statistics() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  
  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Ticket ID range state
  const [startTicketId, setStartTicketId] = useState('');
  const [endTicketId, setEndTicketId] = useState('');

  // Chart configuration state
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [chartMetric, setChartMetric] = useState<'total' | 'completionRate' | 'avgDays'>('total');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, pData, wData] = await Promise.all([getTickets(), getPersonnel(), getWorkflows()]);
      setTickets(tData);
      setPersonnel(pData);
      setWorkflows(wData.sort((a, b) => a.order - b.order));
    } catch (e) {
      console.error(e);
      alert('讀取資料失敗');
    }
  };

  // Filter tickets based on Date and ID ranges
  const filteredTickets = useMemo(() => {
    const startMs = startDate ? new Date(startDate).getTime() : 0;
    const endMs = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;

    return tickets.filter(t => {
      // Date filter
      if (!t.dispatchDate) return false;
      if (t.dispatchDate < startMs || t.dispatchDate > endMs) return false;

      // Ticket ID filter (string comparison)
      if (startTicketId && t.id.localeCompare(startTicketId) < 0) return false;
      if (endTicketId && t.id.localeCompare(endTicketId) > 0) return false;

      return true;
    });
  }, [tickets, startDate, endDate, startTicketId, endTicketId]);

  const statsByPerson = useMemo(() => {
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
    }).sort((a, b) => b.total - a.total);
  }, [filteredTickets, personnel]);

  const globalStats = useMemo(() => {
    const total = statsByPerson.reduce((sum, p) => sum + p.total, 0);
    const closed = statsByPerson.reduce((sum, p) => sum + p.closed, 0);
    const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);
    
    const globalClosedWithDays = filteredTickets.filter(t => t.closeDate && t.totalProcessingDays);
    const avgDays = globalClosedWithDays.length === 0 ? 0 : 
      Math.round(globalClosedWithDays.reduce((sum, t) => sum + (t.totalProcessingDays || 0), 0) / globalClosedWithDays.length);

    return { total, closed, completionRate, avgDays };
  }, [statsByPerson, filteredTickets]);

  // Helper function to calculate days between two timestamps (min 1 day)
  const calculateDays = (startMs: number, endMs: number) => {
    const diff = endMs - startMs;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days <= 0 ? 1 : days;
  };

  // Workflow Stage Processing Days Stats
  const statsByWorkflow = useMemo(() => {
    const stageStats: Record<string, { totalDays: number; count: number }> = {};
    workflows.forEach(w => stageStats[w.id] = { totalDays: 0, count: 0 });

    filteredTickets.forEach(t => {
      if (!t.dispatchDate) return;
      workflows.forEach((w, index) => {
        if (t.stageDates && t.stageDates[w.id]) {
          const previousDate = index === 0 ? t.dispatchDate : t.stageDates[workflows[index - 1].id];
          if (previousDate) {
            const days = calculateDays(previousDate, t.stageDates[w.id]);
            stageStats[w.id].totalDays += days;
            stageStats[w.id].count += 1;
          }
        }
      });
    });

    return workflows.map(w => {
      const avg = stageStats[w.id].count === 0 ? 0 : 
        Math.round(stageStats[w.id].totalDays / stageStats[w.id].count * 10) / 10; // 1 decimal place
      return {
        name: w.name,
        avgDays: avg,
        count: stageStats[w.id].count
      };
    });
  }, [filteredTickets, workflows]);

  // Colors for Pie Chart
  const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#F7FFF7', '#8ECAE6', '#219EBC', '#023047', '#FFB703', '#FB8500'];

  const renderChart = () => {
    const data = statsByPerson.filter(p => p[chartMetric] > 0);
    if (data.length === 0) return <div style={{ textAlign: 'center', padding: '50px' }}>該區間無數據可產生圖表</div>;

    const dataKey = chartMetric;
    const yAxisLabel = chartMetric === 'total' ? '數量' : chartMetric === 'completionRate' ? '完成率(%)' : '平均天數';

    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
            <XAxis dataKey="name" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 16}} />
            <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 16}} />
            <Tooltip 
              contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '2px solid var(--crayon-dark)'}}
            />
            <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem'}} />
            <Bar dataKey={dataKey} name={yAxisLabel} fill="var(--crayon-blue)" radius={[5, 5, 0, 0]} barSize={50}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={150}
              label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: 'var(--crayon-dark)', strokeWidth: 2 }}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--crayon-dark)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '2px solid var(--crayon-dark)'}} />
            <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem'}} />
          </PieChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <div>
      <h2>📈 統計作業</h2>

      {/* 條件篩選 */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '30px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ margin: 0, marginBottom: '15px', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>📅 設定統計條件</h3>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {/* 日期區間卡片 */}
          <div style={{ 
            flex: 1, minWidth: '250px', backgroundColor: '#fff3e0', 
            padding: '15px', borderRadius: '10px', border: '2px solid var(--crayon-orange)',
            transform: 'rotate(-1deg)' 
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--crayon-orange)' }}>📌 依日期區間</h4>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>起始日期：</label>
                <input type="date" className="doodle-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>結束日期：</label>
                <input type="date" className="doodle-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* 單號區間卡片 */}
          <div style={{ 
            flex: 1, minWidth: '250px', backgroundColor: '#e8f5e9', 
            padding: '15px', borderRadius: '10px', border: '2px solid var(--crayon-green)',
            transform: 'rotate(1deg)' 
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--crayon-green)' }}>📌 依盤點單號區間</h4>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>單號起：</label>
                <input className="doodle-input" placeholder="例如: 260101" value={startTicketId} onChange={e => setStartTicketId(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>單號迄：</label>
                <input className="doodle-input" placeholder="例如: 261299" value={endTicketId} onChange={e => setEndTicketId(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 各流程平均處理天數 */}
      {workflows.length > 0 && (
        <div className="doodle-border" style={{ 
          padding: '20px', marginBottom: '30px', backgroundColor: '#e0f7fa',
          transform: 'rotate(-0.5deg)', boxShadow: '5px 5px 0px rgba(0,0,0,0.15)'
        }}>
          <h3 style={{ marginTop: 0, borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>⏳ 各流程平均處理天數</h3>
          <div style={{ marginTop: '20px', height: '300px', backgroundColor: 'white', borderRadius: '10px', border: '2px solid var(--crayon-dark)', padding: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsByWorkflow} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="5 5" stroke="#ccc" />
                <XAxis dataKey="name" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
                <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
                <Tooltip 
                  contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#fff9c4', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}}
                  formatter={(value) => [`${value} 天`, '平均天數']}
                />
                <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
                <Bar dataKey="avgDays" name="平均處理天數 (天)" fill="var(--crayon-orange)" radius={[5, 5, 0, 0]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 全局統計 (全部人員) */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '30px', backgroundColor: 'var(--crayon-yellow)', border: '3px solid var(--crayon-dark)' }}>
        <h3 style={{ marginTop: 0, textAlign: 'center', fontSize: '1.8rem', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>🌟 全部人員總計</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', textAlign: 'center', marginTop: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '10px', border: '2px solid var(--crayon-dark)' }}>
            <div style={{ fontSize: '1.1rem', color: '#555', fontWeight: 'bold' }}>總盤點數</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>{globalStats.total}</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '10px', border: '2px solid var(--crayon-dark)' }}>
            <div style={{ fontSize: '1.1rem', color: '#555', fontWeight: 'bold' }}>平均完成率</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-green)' }}>{globalStats.completionRate}%</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '10px', border: '2px solid var(--crayon-dark)' }}>
            <div style={{ fontSize: '1.1rem', color: '#555', fontWeight: 'bold' }}>平均處理天數</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>{globalStats.avgDays} <span style={{fontSize:'1rem'}}>天</span></div>
          </div>
        </div>
      </div>

      {/* 動態圖表區塊 */}
      <div className="doodle-border" style={{ 
        padding: '20px', marginBottom: '30px', backgroundColor: 'white',
        transform: 'rotate(0.5deg)', boxShadow: '5px 5px 0px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h3 style={{ margin: 0 }}>📊 人員績效圖表分析</h3>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div>
              <label style={{ fontWeight: 'bold' }}>統計類別：</label>
              <select className="doodle-input" style={{ width: 'auto' }} value={chartMetric} onChange={e => setChartMetric(e.target.value as any)}>
                <option value="total">盤點數量</option>
                <option value="completionRate">完成率 (%)</option>
                <option value="avgDays">平均處理天數</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 'bold' }}>圖表類型：</label>
              <select className="doodle-input" style={{ width: 'auto' }} value={chartType} onChange={e => setChartType(e.target.value as any)}>
                <option value="bar">直條圖</option>
                <option value="pie">圓餅圖</option>
              </select>
            </div>
          </div>
        </div>
        
        <div style={{ padding: '10px', backgroundColor: '#fafafa', borderRadius: '10px', border: '2px solid #ddd' }}>
          {renderChart()}
        </div>
      </div>

      {/* 個人詳細數據列表 */}
      <h3 style={{ marginTop: '40px', marginBottom: '20px' }}>👥 個人詳細數據</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {statsByPerson.map(stat => (
          <div key={stat.id} className="doodle-border" style={{ padding: '20px', backgroundColor: 'var(--crayon-paper)' }}>
            <h3 style={{ borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px', margin: '0 0 15px 0' }}>
              {stat.name} <span style={{ fontSize: '0.9rem', color: '#666' }}>({stat.title})</span>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ textAlign: 'center', backgroundColor: '#f0f8ff', padding: '10px', borderRadius: '10px', border: '1px solid #ccc' }}>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>盤點數</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stat.total}</div>
              </div>
              
              <div style={{ textAlign: 'center', backgroundColor: '#fff0f5', padding: '10px', borderRadius: '10px', border: '1px solid #ccc' }}>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>平均天數</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>{stat.avgDays}</div>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '0.9rem' }}>完成率 ({stat.closed}/{stat.total})</span>
                <span style={{ fontWeight: 'bold' }}>{stat.completionRate}%</span>
              </div>
              <div style={{ width: '100%', height: '12px', backgroundColor: '#eee', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ccc' }}>
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
