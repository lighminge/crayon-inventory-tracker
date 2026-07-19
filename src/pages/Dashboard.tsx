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
  const d = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(d.getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(d.getMonth() + 1);

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
      chartData.push({ month: monthStr, count });
    }

    return { total, inProgress, completionRate, avgDays, chartData };
  }, [tickets]);

  // Personnel specific stats for selected month
  const personnelStats = useMemo(() => {
    const tYear = selectedYear;
    const tMonth = selectedMonthNum - 1; // 0-indexed for Date comparison

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
  }, [tickets, personnel, selectedYear, selectedMonthNum]);

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
          <CartesianGrid strokeDasharray="5 5" stroke="#ccc" />
          <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
          <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} allowDecimals={false} />
          <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#fff9c4', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}} />
          <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
          <Line type="monotone" dataKey="count" name="盤點數量" stroke="var(--crayon-blue)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} />
        </LineChart>
      );
    }
    if (chartType === 'composed') {
      return (
        <ComposedChart {...commonProps}>
          <CartesianGrid strokeDasharray="5 5" stroke="#ccc" />
          <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
          <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} allowDecimals={false} />
          <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#fff9c4', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}} />
          <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
          <Bar dataKey="count" name="長條圖(盤點數量)" fill="var(--crayon-yellow)" radius={[5, 5, 0, 0]} barSize={40} />
          <Line type="monotone" dataKey="count" name="折線圖(盤點數量)" stroke="var(--crayon-red)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} />
        </ComposedChart>
      );
    }
    // Default bar
    return (
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="5 5" stroke="#ccc" />
        <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
        <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} allowDecimals={false} />
        <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#fff9c4', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}} />
        <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
        <Bar dataKey="count" name="盤點數量" fill="var(--crayon-purple)" radius={[5, 5, 0, 0]} barSize={40} />
      </BarChart>
    );
  };

  // Generate Year options (e.g. from 2024 to current year + 1)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({length: 5}, (_, i) => currentYear - 2 + i);

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
        
        {/* 備料員盤點情況 - Moved ABOVE Chart & Restyled to Doodle Cards */}
        <div className="doodle-border" style={{ padding: '20px', backgroundColor: '#e0f7fa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px dashed var(--crayon-dark)', paddingBottom: '10px', flexWrap: 'wrap', gap: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.8rem' }}>👥 備料員盤點情況</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold' }}>查詢期間：</label>
              <select className="doodle-input" style={{ width: 'auto', backgroundColor: 'white' }} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {yearOptions.map(y => <option key={y} value={y}>{y} 年</option>)}
              </select>
              <select className="doodle-input" style={{ width: 'auto', backgroundColor: 'white' }} value={selectedMonthNum} onChange={e => setSelectedMonthNum(Number(e.target.value))}>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}
              </select>
            </div>
          </div>
          
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* 總計列設計成顯眼置頂的塗鴉風格面板 */}
            {personnelStats.length > 0 && (
              <div className="doodle-border" style={{ 
                backgroundColor: 'var(--crayon-yellow)', padding: '15px 20px', 
                display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                flexWrap: 'wrap', gap: '15px', border: '3px solid var(--crayon-dark)'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>🌟 全員總計</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>總未完成</div>
                  <div style={{ fontSize: '2rem', color: 'var(--crayon-red)', fontWeight: 'bold' }}>{personnelTotals.incompleteCount} 件</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>本月總派送</div>
                  <div style={{ fontSize: '2rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>{personnelTotals.monthDispatch} 件</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>本月總完成</div>
                  <div style={{ fontSize: '2rem', color: 'var(--crayon-green)', fontWeight: 'bold' }}>{personnelTotals.monthCompleted} 件</div>
                </div>
              </div>
            )}

            {/* 人員卡片列表 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
              {personnelStats.map(p => (
                <div key={p.id} className="doodle-border" style={{ padding: '15px', backgroundColor: 'white', position: 'relative' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '1.3rem', borderBottom: '2px solid #ccc', paddingBottom: '5px' }}>
                    {p.name} <span style={{ fontSize: '0.9rem', color: '#888' }}>({p.title})</span>
                  </h4>
                  
                  {/* 最顯眼的總計未完成 */}
                  <div style={{ 
                    position: 'absolute', top: '-10px', right: '-10px',
                    width: '70px', height: '70px',
                    backgroundColor: p.incompleteCount > 0 ? '#ffebee' : '#e8f5e9',
                    border: `3px solid ${p.incompleteCount > 0 ? 'var(--crayon-red)' : 'var(--crayon-green)'}`,
                    borderRadius: '50%', display: 'flex', flexDirection: 'column', 
                    alignItems: 'center', justifyContent: 'center',
                    transform: 'rotate(5deg)', boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>未完成</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: p.incompleteCount > 0 ? 'var(--crayon-red)' : 'var(--crayon-green)', lineHeight: 1 }}>{p.incompleteCount}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>本月派送</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{p.monthDispatch}</div>
                    </div>
                    <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>本月完成</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{p.monthCompleted}</div>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '5px' }}>
                      <strong>完成率</strong>
                      <span>{p.monthCompletionRate}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '5px', overflow: 'hidden', border: '1px solid #ccc' }}>
                      <div style={{ width: `${p.monthCompletionRate}%`, height: '100%', backgroundColor: p.monthCompletionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-blue)' }}></div>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '0.9rem' }}>
                    <strong>平均耗時：</strong> <span style={{ color: p.avgDays > 0 ? 'var(--crayon-red)' : '#888', fontWeight: 'bold', fontSize: '1.1rem' }}>{p.avgDays > 0 ? `${p.avgDays} 天` : '-'}</span>
                  </div>
                </div>
              ))}
              {personnelStats.length === 0 && (
                <div style={{ padding: '20px', color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>沒有具備盤點權限的人員。</div>
              )}
            </div>
          </div>
        </div>

        {/* 近半年盤點數量趨勢 (Recharts) */}
        <div className="doodle-border" style={{ 
          padding: '20px', backgroundColor: 'var(--crayon-paper)',
          transform: 'rotate(-0.5deg)', boxShadow: '5px 5px 0px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>📈 近六個月盤點數量</h3>
            <div>
              <label style={{ fontWeight: 'bold', marginRight: '10px' }}>圖表類型：</label>
              <select className="doodle-input" style={{ width: 'auto' }} value={chartType} onChange={e => setChartType(e.target.value as any)}>
                <option value="bar">長條圖</option>
                <option value="line">折線圖</option>
                <option value="composed">二者並存 (同時顯示長條圖與折線圖)</option>
              </select>
            </div>
          </div>
          <div style={{ 
            height: '300px', marginTop: '20px', backgroundColor: 'white', 
            borderRadius: '10px', border: '2px solid var(--crayon-dark)', padding: '10px' 
          }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
