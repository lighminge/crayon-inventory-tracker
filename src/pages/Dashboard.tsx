import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel, InventoryTask, Workflow } from '../types';
import { getTickets, getPersonnel, getTasks, getWorkflows } from '../services/api';
import { calculateBusinessDays } from '../utils/dateUtils';
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [tasks, setTasks] = useState<InventoryTask[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [personnelTicketType, setPersonnelTicketType] = useState('');
  
  // Personnel Cards State
  const [activeTab, setActiveTab] = useState<Record<string, 'stats' | 'incomplete'>>({});
  const [incompletePage, setIncompletePage] = useState<Record<string, number>>({});
  const [cardTicketType, setCardTicketType] = useState<Record<string, string>>({});
  
  // Dashboard Chart State
  const [chartType, setChartType] = useState<'bar' | 'line' | 'composed'>('bar');
  const [chartMetric, setChartMetric] = useState<'ticketCount' | 'itemCount' | 'all'>('ticketCount');
  
  // Dashboard Unclosed State
  const [unclosedAssigneeFilter, setUnclosedAssigneeFilter] = useState<string>('all');
  const [unclosedChartType, setUnclosedChartType] = useState<'bar' | 'pie'>('bar');
  const [unclosedViewMode, setUnclosedViewMode] = useState<'list' | 'chart'>('list');
  
  // Dashboard Personnel Status State
  const d = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(d.getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(d.getMonth() + 1);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, pData, tasksData, wData] = await Promise.all([getTickets(), getPersonnel(), getTasks(), getWorkflows()]);
      setTickets(tData);
      setPersonnel(pData);
      setWorkflows(wData.sort((a, b) => a.order - b.order));
      
      const now = new Date().getTime();
      setTasks(tasksData.filter(t => t.endDate >= now - (24 * 60 * 60 * 1000)));
    } catch (e) {
      console.error(e);
      alert('讀取資料失敗');
    }
  };

  const filteredTickets = useMemo(() => {
    let res = tickets;
    if (selectedTaskId) {
      res = res.filter(t => t.taskId === selectedTaskId);
    }
    if (personnelTicketType) {
      res = res.filter(t => t.ticketType === personnelTicketType);
    }
    return res;
  }, [tickets, selectedTaskId, personnelTicketType]);

  const getFirstStageDate = (t: InventoryTicket) => {
    if (t.stageDates && Object.keys(t.stageDates).length > 0) {
      return Math.min(...Object.values(t.stageDates));
    }
    return t.dispatchDate;
  };

  const getNextStage = (ticket: InventoryTicket): Workflow | null => {
    if (!ticket.dispatchDate) return null;
    for (const w of workflows) {
      if (!ticket.stageDates || !ticket.stageDates[w.id]) {
        return w;
      }
    }
    return null;
  };

  const getAssigneeName = (id: string) => {
    const p = personnel.find(p => p.id === id);
    return p ? p.name : '未知人員';
  };

  const stats = useMemo(() => {
    const total = filteredTickets.length;
    const closed = filteredTickets.filter(t => t.closeDate).length;
    const inProgressTickets = filteredTickets.filter(t => !t.closeDate);
    const inProgress = inProgressTickets.length;
    const inProgressItems = inProgressTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
    const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);

    const closedWithDays = filteredTickets.filter(t => t.closeDate && getFirstStageDate(t));
    const avgDays = closedWithDays.length === 0 ? 0 : 
      Number((closedWithDays.reduce((sum, t) => sum + calculateBusinessDays(getFirstStageDate(t)!, t.closeDate!), 0) / closedWithDays.length).toFixed(2));

    // Chart data for last 6 months
    const chartData = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getMonth() + 1}月`;
      const monthTickets = filteredTickets.filter(t => {
        if (!t.dispatchDate) return false;
        const td = new Date(t.dispatchDate);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
      });
      const count = monthTickets.length;
      const itemCount = monthTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      chartData.push({ month: monthStr, count, itemCount });
    }

    return { total, inProgress, inProgressItems, completionRate, avgDays, chartData };
  }, [filteredTickets]);

  // Personnel specific stats for selected month
  const personnelStats = useMemo(() => {
    const tYear = selectedYear;
    const tMonth = selectedMonthNum - 1; // 0-indexed for Date comparison

    const inventoryStaff = personnel.filter(p => (p.roles || []).includes('盤點'));
    
    return inventoryStaff.map(p => {
      const pTickets = filteredTickets.filter(t => t.assigneeId === p.id);
      
      // 未完成件數 (All time incomplete)
      const incompleteTickets = pTickets.filter(t => !t.closeDate);
      const incompleteCount = incompleteTickets.length;
      
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
        if (!t.closeDate || !getFirstStageDate(t)) return false;
        const d = new Date(t.closeDate);
        return d.getFullYear() === tYear && d.getMonth() === tMonth;
      });
      const avgDays = monthCompletedTickets.length === 0 ? 0 :
        Number((monthCompletedTickets.reduce((sum, t) => sum + calculateBusinessDays(getFirstStageDate(t)!, t.closeDate!), 0) / monthCompletedTickets.length).toFixed(2));

      // Completed Items calculation
      const completedTickets = pTickets.filter(t => t.closeDate);
      const totalCompletedItems = completedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);

      return {
        ...p,
        incompleteTickets,
        incompleteCount,
        monthDispatch,
        monthCompleted,
        monthCompletionRate,
        avgDays,
        totalCompletedItems
      };
    }).sort((a, b) => b.incompleteCount - a.incompleteCount);
  }, [filteredTickets]);

  const personnelTotals = useMemo(() => {
    return personnelStats.reduce((acc, curr) => ({
      incompleteCount: acc.incompleteCount + curr.incompleteCount,
      monthDispatch: acc.monthDispatch + curr.monthDispatch,
      monthCompleted: acc.monthCompleted + curr.monthCompleted,
      totalCompletedItems: acc.totalCompletedItems + curr.totalCompletedItems
    }), { incompleteCount: 0, monthDispatch: 0, monthCompleted: 0, totalCompletedItems: 0 });
  }, [personnelStats]);

  const globalUnclosedTickets = useMemo(() => {
    return filteredTickets.filter(t => !t.closeDate).sort((a, b) => {
      return (b.dispatchDate || 0) - (a.dispatchDate || 0);
    });
  }, [filteredTickets]);


  const unclosedTicketsGrouped = useMemo(() => {
    const groups: Record<string, InventoryTicket[]> = {};
    globalUnclosedTickets.forEach(t => {
      const nextStage = getNextStage(t);
      const assigneeName = nextStage ? getAssigneeName(nextStage.assigneeId === 'DYNAMIC_ASSIGNEE' ? t.assigneeId : (nextStage.assigneeId || '')) : '主管 (等候結案)';
      if (!groups[assigneeName]) {
        groups[assigneeName] = [];
      }
      groups[assigneeName].push(t);
    });
    return groups;
  }, [globalUnclosedTickets]);

  const unclosedChartData = useMemo(() => {
    return Object.keys(unclosedTicketsGrouped)
      .filter(name => unclosedAssigneeFilter === 'all' || name === unclosedAssigneeFilter)
      .map(name => ({
        name,
        ticketCount: unclosedTicketsGrouped[name].length,
        itemCount: unclosedTicketsGrouped[name].reduce((sum, t) => sum + (t.itemCount || 0), 0)
      })).sort((a, b) => b.ticketCount - a.ticketCount);
  }, [unclosedTicketsGrouped, unclosedAssigneeFilter]);

  const UNCLOSED_COLORS = [
    '#FF5252', '#448AFF', '#69F0AE', '#E040FB', 
    '#FFAB40', '#18FFFF', '#FF4081', '#BCAAA4', 
    '#C6FF00', '#536DFE', '#00E676', '#FF6E40'
  ];

  const renderChart = () => {
    const commonProps = {
      data: stats.chartData,
      margin: { top: 20, right: 30, left: 0, bottom: 5 }
    };
    
    const showTicket = chartMetric === 'ticketCount' || chartMetric === 'all';
    const showItem = chartMetric === 'itemCount' || chartMetric === 'all';
    
    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="5 5" stroke="#ccc" />
          <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
          <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} allowDecimals={false} />
          <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#fff9c4', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}} />
          <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
          {showTicket && <Line type="monotone" dataKey="count" name="盤點數量" stroke="var(--crayon-blue)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} />}
          {showItem && <Line type="monotone" dataKey="itemCount" name="盤點項目數量" stroke="var(--crayon-red)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} />}
        </LineChart>
      );
    }
    if (chartType === 'composed') {
      return (
        <ComposedChart {...commonProps}>
          <CartesianGrid strokeDasharray="5 5" stroke="#ccc" />
          <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
          <YAxis yAxisId="left" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} allowDecimals={false} />
          {showTicket && showItem && <YAxis yAxisId="right" orientation="right" stroke="var(--crayon-red)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} allowDecimals={false} />}
          <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#fff9c4', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}} />
          <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
          {showTicket && <Bar yAxisId="left" dataKey="count" name="長條圖(盤點數量)" fill="var(--crayon-green)" radius={[5, 5, 0, 0]} barSize={40} />}
          {showItem && <Line yAxisId={showTicket ? "right" : "left"} type="monotone" dataKey="itemCount" name="折線圖(盤點項目數)" stroke="var(--crayon-red)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} />}
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
        {showTicket && <Bar dataKey="count" name="盤點數量" fill="var(--crayon-purple)" radius={[5, 5, 0, 0]} barSize={40} />}
        {showItem && <Bar dataKey="itemCount" name="盤點項目數量" fill="var(--crayon-blue)" radius={[5, 5, 0, 0]} barSize={40} />}
      </BarChart>
    );
  };

  // Generate Year options (e.g. from 2024 to current year + 1)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({length: 5}, (_, i) => currentYear - 2 + i);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>📊 儀表板</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>切換盤點任務：</label>
          <select className="doodle-input" style={{ width: 'auto', backgroundColor: '#e3f2fd' }} value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value)}>
            <option value="">-- 全域資料 (不指定任務) --</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      
      {/* 任務進度摘要區塊 (僅在選擇任務時顯示) */}
      {selectedTaskId && (
        <div className="doodle-border" style={{ 
          backgroundColor: '#fff9c4', padding: '20px', marginBottom: '20px', 
          border: '3px dashed var(--crayon-orange)', boxShadow: '5px 5px 0px rgba(0,0,0,0.1)' 
        }}>
          {(() => {
            const task = tasks.find(t => t.id === selectedTaskId);
            if (!task) return null;
            const completedItems = filteredTickets.filter(t => t.closeDate).reduce((sum, t) => sum + (t.itemCount || 0), 0);
            const rate = task.totalItemCount > 0 ? Math.min(100, Math.round((completedItems / task.totalItemCount) * 100)) : 0;
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'center', gap: '20px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>🎯 {task.name}</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', color: '#555' }}>需盤點總項目數</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{task.totalItemCount}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', color: '#555' }}>已完成項目數</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--crayon-green)' }}>{completedItems}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', color: '#555' }}>任務完成率</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-blue)', fontFamily: 'Caveat, cursive' }}>{rate}%</div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 核心指標區塊 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="doodle-border" style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff3e0' }}>
          <h3>處理中單據</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--crayon-orange)' }}>{stats.inProgress}</div>
        </div>
        
        <div className="doodle-border" style={{ padding: '20px', textAlign: 'center', backgroundColor: '#e8f5e9' }}>
          <h3>處理中項目數</h3>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--crayon-green)' }}>{stats.inProgressItems}</div>
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
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ fontWeight: 'bold' }}>盤點類型：</label>
                <select className="doodle-input" style={{ width: 'auto', backgroundColor: 'white' }} value={personnelTicketType} onChange={e => setPersonnelTicketType(e.target.value)}>
                  <option value="">全部</option>
                  <option value="夾鉗">夾鉗</option>
                  <option value="TKW">TKW</option>
                </select>
              </div>
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
                  <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>已完成總項目數</div>
                  <div style={{ fontSize: '2rem', color: 'var(--crayon-orange)', fontWeight: 'bold' }}>{personnelTotals.totalCompletedItems} 項</div>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {personnelStats.map(p => {
                const currentTab = activeTab[p.id] || 'stats';
                const currentPage = incompletePage[p.id] || 1;
                const itemsPerPage = 5;
                const typeFilter = cardTicketType[p.id];
                const filteredIncomplete = typeFilter ? p.incompleteTickets.filter(t => t.ticketType === typeFilter) : p.incompleteTickets;
                const totalPages = Math.ceil(filteredIncomplete.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const paginatedTickets = filteredIncomplete.slice(startIndex, startIndex + itemsPerPage);

                return (
                  <div key={p.id} className="doodle-border" style={{ padding: '15px', backgroundColor: 'white', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '1.3rem', borderBottom: '2px solid #ccc', paddingBottom: '5px' }}>
                      {p.name} <span style={{ fontSize: '0.9rem', color: '#888' }}>({p.title})</span>
                    </h4>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                      <button 
                        className={`doodle-button ${currentTab === 'stats' ? 'success' : ''}`} 
                        style={{ flex: 1, padding: '5px', minHeight: 'auto' }}
                        onClick={() => setActiveTab(prev => ({...prev, [p.id]: 'stats'}))}
                      >
                        📊 統計數據
                      </button>
                      <button 
                        className={`doodle-button ${currentTab === 'incomplete' ? 'success' : ''}`} 
                        style={{ flex: 1, padding: '5px', minHeight: 'auto', position: 'relative' }}
                        onClick={() => setActiveTab(prev => ({...prev, [p.id]: 'incomplete'}))}
                      >
                        📋 未完成
                        {p.incompleteCount > 0 && (
                          <span style={{
                            position: 'absolute', top: '-15px', right: '-15px',
                            backgroundColor: 'var(--crayon-red)', color: 'white',
                            border: '3px solid var(--crayon-dark)',
                            borderRadius: '50%', width: '32px', height: '32px',
                            fontSize: '1.2rem', fontWeight: '900', display: 'flex', 
                            alignItems: 'center', justifyContent: 'center', zIndex: 1,
                            boxShadow: '2px 2px 0px rgba(0,0,0,0.3)',
                            transform: 'rotate(5deg)'
                          }}>
                            {p.incompleteCount}
                          </span>
                        )}
                      </button>
                    </div>

                    <div style={{ flex: 1 }}>
                      {currentTab === 'stats' ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.85rem', color: '#666' }}>本月派送</div>
                              <div style={{ fontSize: '2rem', fontWeight: '900' }}>{p.monthDispatch}</div>
                            </div>
                            <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.85rem', color: '#666' }}>本月完成</div>
                              <div style={{ fontSize: '2rem', fontWeight: '900' }}>{p.monthCompleted}</div>
                            </div>
                          </div>
                          
                          <div style={{ 
                            marginTop: '15px', backgroundColor: '#e8eaf6', padding: '10px', 
                            borderRadius: '10px', textAlign: 'center', border: '1px dashed var(--crayon-blue)' 
                          }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>
                              {selectedTaskId ? '此任務已盤點項目數' : '已完成總項目數'}
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>{p.totalCompletedItems}</div>
                          </div>

                          <div style={{ marginTop: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', marginBottom: '5px' }}>
                              <strong>完成率</strong>
                              <span style={{ fontSize: '1.5rem', fontWeight: '900' }}>{p.monthCompletionRate}%</span>
                            </div>
                            <div style={{ width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '5px', overflow: 'hidden', border: '1px solid #ccc' }}>
                              <div style={{ width: `${p.monthCompletionRate}%`, height: '100%', backgroundColor: p.monthCompletionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-blue)' }}></div>
                            </div>
                          </div>
                          
                          <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '0.9rem' }}>
                            <strong>平均耗時：</strong> <span style={{ color: p.avgDays > 0 ? 'var(--crayon-red)' : '#888', fontWeight: 'bold', fontSize: '1.1rem' }}>{p.avgDays > 0 ? `${p.avgDays} 天` : '-'}</span>
                          </div>
                        </>
                      ) : (
                        <div style={{
                          padding: '10px',
                          backgroundColor: '#fff3e0',
                          border: '2px dashed var(--crayon-orange)',
                          borderRadius: '10px',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>總計：{filteredIncomplete.length} 件 / {filteredIncomplete.reduce((sum: number, t: InventoryTicket) => sum + (t.itemCount || 0), 0)} 項</span>
                            <select 
                              className="doodle-input" 
                              style={{ width: 'auto', padding: '2px 5px', fontSize: '0.8rem', backgroundColor: 'white' }}
                              value={cardTicketType[p.id] || ''}
                              onChange={e => {
                                setCardTicketType(prev => ({...prev, [p.id]: e.target.value}));
                                setIncompletePage(prev => ({...prev, [p.id]: 1}));
                              }}
                            >
                              <option value="">全部類型</option>
                              <option value="夾鉗">夾鉗</option>
                              <option value="TKW">TKW</option>
                            </select>
                          </div>
                          
                          {p.incompleteCount === 0 ? (
                            <div style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>太棒了！目前沒有未完成的單據 🎉</div>
                          ) : (
                            <>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                {paginatedTickets.map((t: InventoryTicket, idx: number) => {
                                  const nextStage = getNextStage(t);
                                  let currentStageName = '未開始';
                                  let currentAssigneeName = '未知';
                                  
                                  if (!nextStage) {
                                    currentStageName = '等候結案';
                                    currentAssigneeName = '主管';
                                  } else {
                                    if (t.stageDates && Object.keys(t.stageDates).length > 0) {
                                      currentStageName = nextStage.name;
                                    }
                                    currentAssigneeName = getAssigneeName(nextStage.assigneeId === 'DYNAMIC_ASSIGNEE' ? t.assigneeId : (nextStage.assigneeId || ''));
                                  }
                                  
                                  return (
                                    <li key={t.id} style={{ 
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      backgroundColor: 'white', padding: '6px 10px', 
                                      border: '2px solid var(--crayon-dark)', borderRadius: '8px',
                                      boxShadow: '2px 2px 0px rgba(0,0,0,0.1)'
                                    }}>
                                      <span style={{ fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                                        <span style={{ color: 'var(--crayon-blue)', marginRight: '5px' }}>{startIndex + idx + 1}.</span>
                                        {t.id}
                                        {t.ticketType && (
                                          <span style={{ fontSize: '0.8rem', color: t.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)', border: `1px solid ${t.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)'}`, borderRadius: '4px', padding: '1px 6px' }}>
                                            {t.ticketType}
                                          </span>
                                        )}
                                        <span style={{ fontSize: '0.9rem', color: 'var(--crayon-paper)', backgroundColor: 'var(--crayon-dark)', padding: '2px 8px', borderRadius: '4px', border: '2px solid var(--crayon-dark)', fontWeight: 'bold' }}>
                                          {currentStageName} ({currentAssigneeName})
                                        </span>
                                      </span>
                                      <span style={{ 
                                        backgroundColor: '#e1bee7', padding: '2px 8px', 
                                        borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold',
                                        border: '1px dashed var(--crayon-dark)', color: 'var(--crayon-purple)'
                                      }}>
                                        📦 {t.itemCount || 0}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                              
                              {totalPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
                                  <button 
                                    className="doodle-button" style={{ padding: '2px 8px', minHeight: 'auto', fontSize: '0.8rem' }}
                                    disabled={currentPage === 1}
                                    onClick={() => setIncompletePage(prev => ({...prev, [p.id]: currentPage - 1}))}
                                  >◀</button>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{currentPage} / {totalPages}</span>
                                  <button 
                                    className="doodle-button" style={{ padding: '2px 8px', minHeight: 'auto', fontSize: '0.8rem' }}
                                    disabled={currentPage === totalPages}
                                    onClick={() => setIncompletePage(prev => ({...prev, [p.id]: currentPage + 1}))}
                                  >▶</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {personnelStats.length === 0 && (
                <div style={{ padding: '20px', color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>沒有具備盤點權限的人員。</div>
              )}
            </div>
          </div>
        </div>

        {/* 所有未結案盤點單狀態 */}
        <div className="doodle-border" style={{ 
          padding: '20px', backgroundColor: '#e3f2fd', marginBottom: '30px',
          transform: 'rotate(0.5deg)', boxShadow: '5px 5px 0px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>
                ⏳ 未結案盤點單狀態
              </h3>
              <div style={{ display: 'flex', backgroundColor: '#fff', padding: '3px', borderRadius: '8px', border: '2px solid var(--crayon-dark)' }}>
                <button 
                  style={{ border: 'none', backgroundColor: unclosedViewMode === 'list' ? 'var(--crayon-yellow)' : 'transparent', fontWeight: 'bold', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}
                  onClick={() => setUnclosedViewMode('list')}
                >清單視圖</button>
                <button 
                  style={{ border: 'none', backgroundColor: unclosedViewMode === 'chart' ? 'var(--crayon-yellow)' : 'transparent', fontWeight: 'bold', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}
                  onClick={() => setUnclosedViewMode('chart')}
                >圖表視圖</button>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-dark)' }}>
                全部總計：{globalUnclosedTickets.length} 件 / {globalUnclosedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0)} 項
              </div>
              
              {unclosedViewMode === 'list' && (
                <div>
                  <label style={{ fontWeight: 'bold', marginRight: '5px' }}>篩選人員：</label>
                  <select className="doodle-input" style={{ width: 'auto' }} value={unclosedAssigneeFilter} onChange={e => setUnclosedAssigneeFilter(e.target.value)}>
                    <option value="all">全部人員</option>
                    {Object.keys(unclosedTicketsGrouped).map(name => (
                      <option key={name} value={name}>{name} ({unclosedTicketsGrouped[name].length}件)</option>
                    ))}
                  </select>
                </div>
              )}
              
              {unclosedViewMode === 'chart' && (
                <div>
                  <label style={{ fontWeight: 'bold', marginRight: '5px' }}>圖表類型：</label>
                  <div style={{ display: 'inline-flex', gap: '5px', backgroundColor: '#fff', padding: '3px', borderRadius: '8px', border: '2px solid var(--crayon-dark)', verticalAlign: 'middle' }}>
                    <button 
                      style={{ border: 'none', backgroundColor: unclosedChartType === 'bar' ? 'var(--crayon-yellow)' : 'transparent', fontWeight: 'bold', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit' }}
                      onClick={() => setUnclosedChartType('bar')}
                    >長條圖</button>
                    <button 
                      style={{ border: 'none', backgroundColor: unclosedChartType === 'pie' ? 'var(--crayon-yellow)' : 'transparent', fontWeight: 'bold', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit' }}
                      onClick={() => setUnclosedChartType('pie')}
                    >圓餅圖</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {unclosedViewMode === 'chart' && globalUnclosedTickets.length > 0 && (
            <div style={{ height: '350px', backgroundColor: 'white', borderRadius: '10px', border: '2px solid var(--crayon-dark)', padding: '10px', marginBottom: '20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                {unclosedChartType === 'bar' ? (
                  <BarChart data={unclosedChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '10px', border: '2px solid var(--crayon-dark)' }} />
                    <Legend />
                    <Bar dataKey="ticketCount" name="單據數量 (件)" fill="var(--crayon-blue)" radius={[10, 10, 0, 0]} barSize={40} />
                  </BarChart>
                ) : (
                  <PieChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                    <Pie data={unclosedChartData} dataKey="ticketCount" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {unclosedChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={UNCLOSED_COLORS[index % UNCLOSED_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '2px solid var(--crayon-dark)' }} />
                    <Legend />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {unclosedViewMode === 'list' && (
            globalUnclosedTickets.length === 0 ? (
              <div style={{ padding: '20px', color: '#888', textAlign: 'center' }}>目前沒有未結案的盤點單 🎉</div>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
              {Object.keys(unclosedTicketsGrouped)
                .filter(name => unclosedAssigneeFilter === 'all' || name === unclosedAssigneeFilter)
                .map(assigneeName => {
                  const assigneeTickets = unclosedTicketsGrouped[assigneeName];
                  const assigneeTotalItems = assigneeTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
                  
                  return (
                    <div key={assigneeName} className="doodle-border" style={{ 
                      backgroundColor: 'white', padding: '15px', 
                      display: 'flex', flexDirection: 'column', gap: '15px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--crayon-dark)', paddingBottom: '10px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--crayon-dark)' }}>
                          👤 {assigneeName}
                        </span>
                        <span style={{ 
                          backgroundColor: 'var(--crayon-yellow)', padding: '5px 12px', borderRadius: '15px', 
                          fontSize: '1.1rem', fontWeight: 'bold', border: '2px dashed var(--crayon-dark)',
                          color: 'var(--crayon-dark)'
                        }}>
                          {assigneeTickets.length} 件 / {assigneeTotalItems} 項
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {assigneeTickets.map((t, index) => {
                          const startMs = getFirstStageDate(t);
                          let daysSpent = 0;
                          if (startMs) {
                            daysSpent = calculateBusinessDays(startMs, new Date().getTime());
                          }
                          const nextStage = getNextStage(t);
                          const stageName = nextStage ? nextStage.name : '等候結案';

                          return (
                            <div key={t.id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              backgroundColor: '#f9f9f9', padding: '8px 12px', borderRadius: '8px',
                              border: '1px solid #ddd'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ backgroundColor: 'var(--crayon-dark)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                  {index + 1}
                                </span>
                                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.id}</span>
                                {t.ticketType && (
                                  <span style={{ 
                                    fontSize: '0.85rem', fontWeight: 'bold', color: 'white',
                                    backgroundColor: t.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)',
                                    border: '2px dashed var(--crayon-dark)',
                                    borderRadius: '8px', padding: '2px 8px'
                                  }}>
                                    {t.ticketType}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '0.9rem', backgroundColor: '#e1bee7', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', border: '2px dashed var(--crayon-dark)' }}>
                                  關卡：{stageName}
                                </span>
                                <span style={{ fontSize: '0.9rem', backgroundColor: daysSpent > 3 ? '#ffcdd2' : '#c8e6c9', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', border: '2px dashed var(--crayon-dark)' }}>
                                  耗時：{daysSpent}天
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
              })}
            </div>
            )
          )}
        </div>

        {/* 近半年盤點數量趨勢 (Recharts) */}
        <div className="doodle-border" style={{ 
          padding: '20px', backgroundColor: 'var(--crayon-paper)',
          transform: 'rotate(-0.5deg)', boxShadow: '5px 5px 0px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>📈 近六個月盤點數量</h3>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontWeight: 'bold', marginRight: '5px' }}>統計數據：</label>
                <select className="doodle-input" style={{ width: 'auto' }} value={chartMetric} onChange={e => setChartMetric(e.target.value as any)}>
                  <option value="ticketCount">盤點數量 (件)</option>
                  <option value="itemCount">盤點項目數量 (項)</option>
                  <option value="all">全部顯示</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', marginRight: '5px' }}>圖表類型：</label>
                <select className="doodle-input" style={{ width: 'auto' }} value={chartType} onChange={e => setChartType(e.target.value as any)}>
                  <option value="bar">長條圖</option>
                  <option value="line">折線圖</option>
                  <option value="composed">二者並存</option>
                </select>
              </div>
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
