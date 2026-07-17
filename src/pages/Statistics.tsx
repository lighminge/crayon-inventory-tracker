import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel } from '../types';
import { getTickets, getPersonnel } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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

  // Chart configuration state
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [chartMetric, setChartMetric] = useState<'total' | 'completionRate' | 'avgDays'>('total');

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
    const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1;

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
    }).sort((a, b) => b.total - a.total);
  }, [tickets, personnel, startDate, endDate]);

  const globalStats = useMemo(() => {
    const total = statsByPerson.reduce((sum, p) => sum + p.total, 0);
    const closed = statsByPerson.reduce((sum, p) => sum + p.closed, 0);
    const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);
    
    // Average of averages is not perfectly accurate, better to sum all closed days / total closed.
    // Let's filter tickets to recalculate for global accuracy.
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
    const globalClosedWithDays = tickets.filter(t => 
      t.dispatchDate && t.dispatchDate >= startMs && t.dispatchDate <= endMs && t.closeDate && t.totalProcessingDays
    );
    const avgDays = globalClosedWithDays.length === 0 ? 0 : 
      Math.round(globalClosedWithDays.reduce((sum, t) => sum + (t.totalProcessingDays || 0), 0) / globalClosedWithDays.length);

    return { total, closed, completionRate, avgDays };
  }, [statsByPerson, tickets, startDate, endDate]);

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
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '30px', backgroundColor: '#f9f9f9', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, width: '100%' }}>📅 設定統計條件</h3>
        <div>
          <label>起始日期：</label>
          <input type="date" className="doodle-input" style={{ width: 'auto' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label>結束日期：</label>
          <input type="date" className="doodle-input" style={{ width: 'auto' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

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
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '30px', backgroundColor: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h3 style={{ margin: 0 }}>📊 數據圖表分析</h3>
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
        
        {/* Render the selected chart */}
        {renderChart()}
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
