import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel } from '../types';
import { getTickets, getPersonnel } from '../services/api';
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function Dashboard() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  
  // Dashboard Chart State
  const [chartType, setChartType] = useState<'bar' | 'line' | 'composed'>('bar');
  
  // Dashboard Personnel Status State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

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
      });
      const count = monthTickets.length;
      const closedCount = monthTickets.filter(t => t.closeDate).length;
      chartData.push({ month: monthStr, count, closedCount });
    }

    return { total, inProgress, completionRate, avgDays, chartData };
  }, [tickets]);

  // Personnel specific stats for selected month
  const personnelStats = useMemo(() => {
    const targetDate = new Date(selectedMonth + '-01');
    const tYear = targetDate.getFullYear();
    const tMonth = targetDate.getMonth();

    const inventoryStaff = personnel.filter(p => (p.roles || []).includes('盤點'));
    
    return inventoryStaff.map(p => {
      const pTickets = tickets.filter(t => t.assigneeId === p.id);
      
      // 未完成件數 (All time incomplete)
      const incompleteCount = pTickets.filter(t => !t.closeDate).length;
      
      // 本月派送
      const monthTickets = pTickets.filter(t => {
        if (!t.dispatchDate) return false;
        const d = new Date(t.dispatchDate);
        return d.getFullYear() === tYear && d.getMonth() === tMonth;
      });
      const monthDispatch = monthTickets.length;
      
      // 本月完成 (不管何時派送，只要是本月結案都算本月完成，或者也可以只算本月派送且完成。依據語意，通常是看 closeDate)
      const monthCompleted = pTickets.filter(t => {
        if (!t.closeDate) return false;
        const d = new Date(t.closeDate);
        return d.getFullYear() === tYear && d.getMonth() === tMonth;
      }).length;
      
      const monthCompletionRate = monthDispatch === 0 ? 0 : Math.round((monthCompleted / monthDispatch) * 100);
      
      // 本月完成的平均日數
      const monthCompletedTickets = pTickets.filter(t => {
        if (!t.closeDate) return false;
        const d = new Date(t.closeDate);
        return d.getFullYear() === tYear && d.getMonth() === tMonth;
      });
      const avgDays = monthCompletedTickets.length === 0 ? 0 :
        Math.round(monthCompletedTickets.reduce((sum, t) => sum + (t.totalProcessingDays || 0), 0) / monthCompletedTickets.length);

      return {
        ...p,
        incompleteCount,
        monthDispatch,
        monthCompleted,
        monthCompletionRate,
        avgDays
      };
    }).sort((a, b) => b.incompleteCount - a.incompleteCount);
  }, [tickets, personnel, selectedMonth]);

  const personnelTotals = useMemo(() => {
    return personnelStats.reduce((acc, curr) => ({
      incompleteCount: acc.incompleteCount + curr.incompleteCount,
      monthDispatch: acc.monthDispatch + curr.monthDispatch,
      monthCompleted: acc.monthCompleted + curr.monthCompleted,
    }), { incompleteCount: 0, monthDispatch: 0, monthCompleted: 0 });
  }, [personnelStats]);

  const renderChart = () => {
    const commonProps = {
      data: stats.chartData,
      margin: { top: 20, right: 30, left: 0, bottom: 5 }
    };
    
    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18}} />
          <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18}} allowDecimals={false} />
          <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '2px solid var(--crayon-dark)'}} />
          <Legend />
          <Line type="monotone" dataKey="count" name="派送數量" stroke="var(--crayon-blue)" strokeWidth={4} activeDot={{r: 8}} />
        </LineChart>
      );
    }
    if (chartType === 'composed') {
      return (
        <ComposedChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18}} />
          <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18}} allowDecimals={false} />
          <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '2px solid var(--crayon-dark)'}} />
          <Legend />
          <Bar dataKey="count" name="派送數量" fill="var(--crayon-blue)" radius={[5, 5, 0, 0]} barSize={30} />
          <Line type="monotone" dataKey="closedCount" name="完成數量" stroke="var(--crayon-red)" strokeWidth={4} />
        </ComposedChart>
      );
    }
    // Default bar
    return (
      <BarChart {...commonProps}>
        <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18}} />
        <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18}} allowDecimals={false} />
        <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '2px solid var(--crayon-dark)'}} />
        <Legend />
        <Bar dataKey="count" name="盤點數量" fill="var(--crayon-purple)" radius={[5, 5, 0, 0]} barSize={40} />
      </BarChart>
    );
  };

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {/* 近半年盤點數量趨勢 (Recharts) */}
        <div className="doodle-border" style={{ padding: '20px', backgroundColor: 'var(--crayon-paper)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>📈 近六個月盤點數量</h3>
            <div>
              <label style={{ fontWeight: 'bold', marginRight: '10px' }}>圖表類型：</label>
              <select className="doodle-input" style={{ width: 'auto' }} value={chartType} onChange={e => setChartType(e.target.value as any)}>
                <option value="bar">長條圖</option>
                <option value="line">折線圖</option>
                <option value="composed">二者並存 (派送與完成)</option>
              </select>
            </div>
          </div>
          <div style={{ height: '300px', marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>

        {/* 備料員盤點情況 */}
        <div className="doodle-border" style={{ padding: '20px', backgroundColor: '#f5f5f5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>👥 備料員盤點情況</h3>
            <div>
              <label style={{ fontWeight: 'bold', marginRight: '10px' }}>查詢月份：</label>
              <input type="month" className="doodle-input" style={{ width: 'auto' }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
            </div>
          </div>
          
          <div style={{ overflowX: 'auto', marginTop: '15px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', backgroundColor: 'white' }} className="doodle-border">
              <thead>
                <tr style={{ backgroundColor: 'var(--crayon-yellow)' }}>
                  <th style={{ padding: '10px', borderBottom: '2px solid var(--crayon-dark)' }}>人員姓名</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid var(--crayon-dark)' }}>總計未完成</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid var(--crayon-dark)' }}>本月派送</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid var(--crayon-dark)' }}>本月完成</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid var(--crayon-dark)' }}>本月完成率</th>
                  <th style={{ padding: '10px', borderBottom: '2px solid var(--crayon-dark)' }}>完成平均日數</th>
                </tr>
              </thead>
              <tbody>
                {personnelStats.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px dashed #ccc' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.name} <span style={{ fontSize: '0.8rem', color: '#666' }}>({p.title})</span></td>
                    <td style={{ padding: '10px', color: p.incompleteCount > 0 ? 'var(--crayon-red)' : 'var(--crayon-green)', fontWeight: 'bold' }}>
                      {p.incompleteCount} 件
                    </td>
                    <td style={{ padding: '10px' }}>{p.monthDispatch}</td>
                    <td style={{ padding: '10px' }}>{p.monthCompleted}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: '5px', height: '10px', marginTop: '5px', overflow: 'hidden' }}>
                        <div style={{ width: `${p.monthCompletionRate}%`, backgroundColor: 'var(--crayon-blue)', height: '100%' }}></div>
                      </div>
                      <span style={{ fontSize: '0.85rem' }}>{p.monthCompletionRate}%</span>
                    </td>
                    <td style={{ padding: '10px' }}>{p.avgDays > 0 ? `${p.avgDays} 天` : '-'}</td>
                  </tr>
                ))}
                {personnelStats.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px', color: '#888' }}>沒有具備盤點權限的人員。</td>
                  </tr>
                )}
              </tbody>
              {personnelStats.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: '#e3f2fd', fontWeight: 'bold' }}>
                    <td style={{ padding: '10px', borderTop: '2px solid var(--crayon-dark)' }}>總計 (Total)</td>
                    <td style={{ padding: '10px', borderTop: '2px solid var(--crayon-dark)' }}>{personnelTotals.incompleteCount} 件</td>
                    <td style={{ padding: '10px', borderTop: '2px solid var(--crayon-dark)' }}>{personnelTotals.monthDispatch}</td>
                    <td style={{ padding: '10px', borderTop: '2px solid var(--crayon-dark)' }}>{personnelTotals.monthCompleted}</td>
                    <td style={{ padding: '10px', borderTop: '2px solid var(--crayon-dark)' }}>-</td>
                    <td style={{ padding: '10px', borderTop: '2px solid var(--crayon-dark)' }}>-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
