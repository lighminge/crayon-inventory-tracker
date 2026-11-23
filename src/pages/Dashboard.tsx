import { useState, useEffect, useMemo, useRef } from 'react';
import type { InventoryTicket, Personnel, InventoryTask, Workflow, HolidaySetting } from '../types';
import { getTickets, getPersonnel, getTasks, getWorkflows, getHolidays } from '../services/api';
import { calculateBusinessDays } from '../utils/dateUtils';
import html2canvas from 'html2canvas';
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LabelList } from 'recharts';

export default function Dashboard() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [tasks, setTasks] = useState<InventoryTask[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [holidays, setHolidays] = useState<HolidaySetting[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [personnelTicketType, setPersonnelTicketType] = useState('');
  const [globalYear, setGlobalYear] = useState<number | ''>(new Date().getFullYear());
  const [categoryFilter, setCategoryFilter] = useState<'全部' | '一般' | '追加'>('一般');
  const [calendarWeekStart, setCalendarWeekStart] = useState<Date>(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0,0,0,0);
    return monday;
  });

  const [completedWeekStart, setCompletedWeekStart] = useState<Date>(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0,0,0,0);
    return monday;
  });

  const middleOfWeek = useMemo(() => {
    const d = new Date(calendarWeekStart);
    d.setDate(d.getDate() + 3); // Thursday
    return d;
  }, [calendarWeekStart]);

  const displayYear = middleOfWeek.getFullYear();
  const displayMonth = middleOfWeek.getMonth() + 1;

  const completedMiddleOfWeek = useMemo(() => {
    const d = new Date(completedWeekStart);
    d.setDate(d.getDate() + 3); // Thursday
    return d;
  }, [completedWeekStart]);

  const completedDisplayYear = completedMiddleOfWeek.getFullYear();
  const completedDisplayMonth = completedMiddleOfWeek.getMonth() + 1;

  const handleCalYearChange = (e: any) => {
    const y = Number(e.target.value);
    const d = new Date(y, displayMonth - 1, 4);
    const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
    d.setDate(d.getDate() + offset);
    setCalendarWeekStart(d);
  };

  const handleCalMonthChange = (e: any) => {
    const m = Number(e.target.value);
    const d = new Date(displayYear, m - 1, 4);
    const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
    d.setDate(d.getDate() + offset);
    setCalendarWeekStart(d);
  };

  const handleCompletedCalYearChange = (e: any) => {
    const y = Number(e.target.value);
    const d = new Date(y, completedDisplayMonth - 1, 4);
    const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
    d.setDate(d.getDate() + offset);
    setCompletedWeekStart(d);
  };

  const handleCompletedCalMonthChange = (e: any) => {
    const m = Number(e.target.value);
    const d = new Date(completedDisplayYear, m - 1, 4);
    const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
    d.setDate(d.getDate() + offset);
    setCompletedWeekStart(d);
  };

  const handleExportMonthChartImage = async () => {
    const el = document.getElementById('month-chart-container');
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 1.5 });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayYear}年${displayMonth}月_派送統計圖表.png`;
    a.click();
  };

  const handleExportCompletedMonthChartImage = async () => {
    const el = document.getElementById('completed-month-chart-container');
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 1.5 });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${completedDisplayYear}年${completedDisplayMonth}月_完成統計圖表.png`;
    a.click();
  };

  const handlePrevWeek = () => {
    const d = new Date(calendarWeekStart);
    d.setDate(d.getDate() - 7);
    setCalendarWeekStart(d);
  };

  const handleNextWeek = () => {
    const d = new Date(calendarWeekStart);
    d.setDate(d.getDate() + 7);
    setCalendarWeekStart(d);
  };

  const handleCompletedPrevWeek = () => {
    const d = new Date(completedWeekStart);
    d.setDate(d.getDate() - 7);
    setCompletedWeekStart(d);
  };

  const handleCompletedNextWeek = () => {
    const d = new Date(completedWeekStart);
    d.setDate(d.getDate() + 7);
    setCompletedWeekStart(d);
  };
  
  // Personnel Cards State
  const [activeTab, setActiveTab] = useState<Record<string, 'stats' | 'incomplete' | 'doing'>>({});
  const [incompletePage, setIncompletePage] = useState<Record<string, number>>({});
  const [doingPage, setDoingPage] = useState<Record<string, number>>({});
  const [cardTicketType, setCardTicketType] = useState<Record<string, string>>({});
  const [cardTaskFilter, setCardTaskFilter] = useState<Record<string, string>>({});
  
  // Dashboard Chart State
  const [chartType, setChartType] = useState<'bar' | 'line' | 'composed'>('bar');
  const [chartMetric, setChartMetric] = useState<'ticketCount' | 'itemCount' | 'all'>('all');
  const [chartStatusFilter, setChartStatusFilter] = useState<'all' | 'closed' | 'unclosed'>('closed');
  
  // Dashboard Unclosed State
  const [unclosedAssigneeFilter, setUnclosedAssigneeFilter] = useState<string>('all');
  const [unclosedChartType, setUnclosedChartType] = useState<'bar' | 'pie'>('bar');
  const [unclosedViewMode, setUnclosedViewMode] = useState<'list' | 'chart'>('list');
  const [unclosedCollapsed, setUnclosedCollapsed] = useState<boolean>(false);
  const [printingUnclosed, setPrintingUnclosed] = useState<boolean>(false);
  const printUnclosedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!printingUnclosed || !printUnclosedRef.current) return;
    let cancelled = false;
    const capture = async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled || !printUnclosedRef.current) return;
      try {
        const canvas = await html2canvas(printUnclosedRef.current, { scale: 2, backgroundColor: '#e3f2fd' });
        const url = canvas.toDataURL('image/png');
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = `未結案盤點單狀態_所有人員_${dateStr}.png`;
        a.click();
      } catch (err) {
        console.error(err);
        alert('列印圖檔失敗');
      } finally {
        if (!cancelled) setPrintingUnclosed(false);
      }
    };
    capture();
    return () => { cancelled = true; };
  }, [printingUnclosed]);

  const handlePrintUnclosed = async () => {
    if (unclosedViewMode === 'chart' && !unclosedCollapsed) {
      const chartEl = document.getElementById('unclosed-chart-container');
      if (chartEl) {
        const canvas = await html2canvas(chartEl, { scale: 2, backgroundColor: '#ffffff' });
        const url = canvas.toDataURL('image/png');
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = `未結案盤點單狀態_圖表_${dateStr}.png`;
        a.click();
        return;
      }
    }
    setPrintingUnclosed(true);
  };
  
  // Dashboard Personnel Status State
  const d = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(d.getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(d.getMonth() + 1);
  const [personnelCollapsed, setPersonnelCollapsed] = useState<boolean>(false);
  const [printingCard, setPrintingCard] = useState<{
    person: any;
    tab: 'stats' | 'incomplete' | 'doing';
    ticketsList: InventoryTicket[];
    taskFilterId: string;
    ticketTypeFilter: string;
  } | null>(null);
  const printCardRef = useRef<HTMLDivElement>(null);
  const [printingAllPersonnel, setPrintingAllPersonnel] = useState<boolean>(false);
  const [personnelPrintMode, setPersonnelPrintMode] = useState<'detail' | 'summary'>('detail');
  const [excludeZeroPersonnel, setExcludeZeroPersonnel] = useState<boolean>(false);
  const printAllPersonnelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!printingCard || !printCardRef.current) return;
    let cancelled = false;
    const capture = async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled || !printCardRef.current) return;
      try {
        const canvas = await html2canvas(printCardRef.current, { scale: 2, backgroundColor: '#ffffff' });
        const url = canvas.toDataURL('image/png');
        const tabLabel = printingCard.tab === 'stats' ? '統計數據' : printingCard.tab === 'doing' ? '盤點中' : '未完成';
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = `${printingCard.person.name}_${tabLabel}_${dateStr}.png`;
        a.click();
      } catch (err) {
        console.error(err);
        alert('列印圖檔失敗');
      } finally {
        if (!cancelled) setPrintingCard(null);
      }
    };
    capture();
    return () => { cancelled = true; };
  }, [printingCard]);

  useEffect(() => {
    if (!printingAllPersonnel || !printAllPersonnelRef.current) return;
    let cancelled = false;
    const capture = async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled || !printAllPersonnelRef.current) return;
      try {
        const bgColor = personnelPrintMode === 'summary' ? '#ffffff' : '#e0f7fa';
        const canvas = await html2canvas(printAllPersonnelRef.current, { scale: 2, backgroundColor: bgColor });
        const url = canvas.toDataURL('image/png');
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = personnelPrintMode === 'summary'
          ? `本週盤點數量統計表_${dateStr}.png`
          : `備料員盤點情況_所有人員_${dateStr}.png`;
        a.click();
      } catch (err) {
        console.error(err);
        alert('列印圖檔失敗');
      } finally {
        if (!cancelled) setPrintingAllPersonnel(false);
      }
    };
    capture();
    return () => { cancelled = true; };
  }, [printingAllPersonnel, personnelPrintMode]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, pData, tasksData, wData, hData] = await Promise.all([getTickets(), getPersonnel(), getTasks(), getWorkflows(), getHolidays()]);
      setTickets(tData);
      setPersonnel(pData);
      setWorkflows(wData.sort((a, b) => a.order - b.order));
      setHolidays(hData);
      
      setTasks(tasksData);
    } catch (e) {
      console.error(e);
      alert('讀取資料失敗');
    }
  };

  const filteredTickets = useMemo(() => {
    let res = tickets.filter(t => categoryFilter === '全部' ? true : (categoryFilter === '追加' ? t.isAdditional : !t.isAdditional));
    if (globalYear !== '') {
      res = res.filter(t => {
        const d = t.dispatchDate ? new Date(t.dispatchDate) : null;
        return d && d.getFullYear() === globalYear;
      });
    }
    if (selectedTaskId) {
      res = res.filter(t => t.taskId === selectedTaskId);
    }
    if (personnelTicketType) {
      res = res.filter(t => t.ticketType === personnelTicketType);
    }
    return res;
  }, [tickets, globalYear, selectedTaskId, personnelTicketType, categoryFilter]);

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

  const getTicketStageInfo = (t: InventoryTicket) => {
    const nextStage = getNextStage(t);
    if (!nextStage) {
      return { currentStageName: '等候結案', currentAssigneeName: '主管' };
    }
    const currentStageName = (t.stageDates && Object.keys(t.stageDates).length > 0) ? nextStage.name : '未開始';
    const currentAssigneeName = getAssigneeName(nextStage.assigneeId === 'DYNAMIC_ASSIGNEE' ? t.assigneeId : (nextStage.assigneeId || ''));
    return { currentStageName, currentAssigneeName };
  };

  const stats = useMemo(() => {
    const total = filteredTickets.length;
    const totalItems = filteredTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
    const closed = filteredTickets.filter(t => t.closeDate).length;
    const inProgressTickets = filteredTickets.filter(t => !t.closeDate);
    const inProgress = inProgressTickets.length;
    const inProgressItems = inProgressTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
    const closedItems = filteredTickets.filter(t => t.closeDate).reduce((sum, t) => sum + (t.itemCount || 0), 0);
    const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);
    const itemCompletionRate = totalItems === 0 ? 0 : Math.round((closedItems / totalItems) * 100);

    const closedWithDays = filteredTickets.filter(t => t.closeDate && getFirstStageDate(t));
    const avgDays = closedWithDays.length === 0 ? 0 : 
      Number((closedWithDays.reduce((sum, t) => sum + calculateBusinessDays(getFirstStageDate(t)!, t.closeDate!, holidays), 0) / closedWithDays.length).toFixed(2));

    // Chart data for last 6 months
    const chartData = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getMonth() + 1}月`;
      const monthTickets = filteredTickets.filter(t => {
        if (!t.dispatchDate) return false;
        if (chartStatusFilter === 'closed' && !t.closeDate) return false;
        if (chartStatusFilter === 'unclosed' && t.closeDate) return false;
        const td = new Date(t.dispatchDate);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
      });
      const count = monthTickets.length;
      const itemCount = monthTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      chartData.push({ month: monthStr, count, itemCount });
    }

    return { total, totalItems, closed, closedItems, inProgress, inProgressItems, completionRate, itemCompletionRate, avgDays, chartData };
  }, [filteredTickets, holidays, calendarWeekStart, chartStatusFilter]);

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
      
      // 盤點中件數 (In progress specifically in '盤點中' stage)
      const doingTickets = incompleteTickets.filter(t => {
        const nextStage = getNextStage(t);
        let currentStageName = '未開始';
        if (!nextStage) {
          currentStageName = '等候結案';
        } else if (t.stageDates && Object.keys(t.stageDates).length > 0) {
          currentStageName = nextStage.name;
        }
        return currentStageName === '盤點中';
      });
      const doingCount = doingTickets.length;
      const doingItemCount = doingTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      
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
        Number((monthCompletedTickets.reduce((sum, t) => sum + calculateBusinessDays(getFirstStageDate(t)!, t.closeDate!, holidays), 0) / monthCompletedTickets.length).toFixed(2));

      // Completed Items calculation
      const completedTickets = pTickets.filter(t => t.closeDate);
      const totalCompletedItems = completedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      const monthCompletedItems = monthCompletedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);

      return {
        ...p,
        incompleteTickets,
        incompleteCount,
        doingTickets,
        doingCount,
        doingItemCount,
        monthDispatch,
        monthCompleted,
        monthCompletionRate,
        avgDays,
        totalCompletedItems,
        monthCompletedItems
      };
    }).sort((a, b) => b.incompleteCount - a.incompleteCount);
  }, [filteredTickets, personnel, selectedYear, selectedMonthNum, holidays]);

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
    '#E63946', '#1D3557', '#2A9D8F', '#F4A261', 
    '#E76F51', '#264653', '#2B2D42', '#8D99AE', 
    '#D90429', '#023047', '#457B9D', '#A8DADC'
  ];

  const renderUnclosedPersonnelCards = (assigneeNames: string[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
      {assigneeNames.map(assigneeName => {
        const assigneeTickets = unclosedTicketsGrouped[assigneeName] || [];
        const assigneeTotalItems = assigneeTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
        const typeStats = assigneeTickets.reduce((acc, t) => {
          if (t.ticketType) {
            acc[t.ticketType] = (acc[t.ticketType] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        return (
          <div key={assigneeName} className="doodle-border" style={{
            backgroundColor: 'white', padding: '15px',
            display: 'flex', flexDirection: 'column', gap: '15px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--crayon-dark)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.8rem', color: 'var(--crayon-dark)' }}>
                  👤 {assigneeName}
                </span>
                {Object.entries(typeStats).map(([type, count]) => (
                  <span key={type} style={{
                    backgroundColor: type === 'TKW' ? '#e1bee7' : '#b2dfdb',
                    color: type === 'TKW' ? '#4a148c' : '#004d40',
                    border: `2px solid ${type === 'TKW' ? '#7b1fa2' : '#00796b'}`,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    fontSize: '1rem'
                  }}>
                    {type} {count} 件
                  </span>
                ))}
              </div>
              <span style={{
                backgroundColor: 'var(--crayon-yellow)', padding: '5px 12px', borderRadius: '15px',
                fontSize: '1.1rem', fontWeight: 'bold', border: '2px dashed var(--crayon-dark)',
                color: 'var(--crayon-dark)'
              }}>
                {assigneeTickets.length} 件 / {assigneeTotalItems} 項
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[...assigneeTickets].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map((t, index) => {
                const startMs = getFirstStageDate(t);
                const daysSpent = startMs ? calculateBusinessDays(startMs, Date.now(), holidays) : 0;
                const nextStage = getNextStage(t);
                const stageName = nextStage ? nextStage.name : '等候結案';

                return (
                  <div key={t.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: t.taskId ? '#fff9c4' : '#f9f9f9',
                    padding: '8px 12px', borderRadius: '8px',
                    border: t.taskId ? '2px dashed #f57f17' : '1px solid #ddd'
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
  );

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
          <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#ffffff', color: 'var(--crayon-dark)', fontWeight: 'bold', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}} />
          <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
          {showTicket && <Line type="monotone" dataKey="count" name="盤點數量" stroke="var(--crayon-blue)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} >
                  <LabelList dataKey="count" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Line>}
          {showItem && <Line type="monotone" dataKey="itemCount" name="盤點項目數量" stroke="var(--crayon-red)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} >
                  <LabelList dataKey="itemCount" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Line>}
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
          <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#ffffff', color: 'var(--crayon-dark)', fontWeight: 'bold', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}} />
          <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
          
          {showTicket && !showItem && (
            <>
              <Bar yAxisId="left" dataKey="count" name="盤點數量 (長條)" fill="var(--crayon-green)" radius={[5, 5, 0, 0]} barSize={40} >
                  <LabelList dataKey="count" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Bar>
              <Line yAxisId="left" type="monotone" dataKey="count" name="盤點數量 (折線)" stroke="var(--crayon-blue)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} >
                  <LabelList dataKey="count" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Line>
            </>
          )}
          
          {!showTicket && showItem && (
            <>
              <Bar yAxisId="left" dataKey="itemCount" name="盤點項目數量 (長條)" fill="var(--crayon-green)" radius={[5, 5, 0, 0]} barSize={40} >
                  <LabelList dataKey="itemCount" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Bar>
              <Line yAxisId="left" type="monotone" dataKey="itemCount" name="盤點項目數量 (折線)" stroke="var(--crayon-red)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} >
                  <LabelList dataKey="itemCount" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Line>
            </>
          )}
          
          {showTicket && showItem && (
            <>
              <Bar yAxisId="left" dataKey="count" name="盤點數量 (長條)" fill="var(--crayon-green)" radius={[5, 5, 0, 0]} barSize={40} >
                  <LabelList dataKey="count" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Bar>
              <Line yAxisId="right" type="monotone" dataKey="itemCount" name="盤點項目數量 (折線)" stroke="var(--crayon-red)" strokeWidth={4} activeDot={{r: 8, stroke: 'var(--crayon-dark)', strokeWidth: 2}} >
                  <LabelList dataKey="itemCount" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Line>
            </>
          )}
        </ComposedChart>
      );
    }
    // Default bar
    return (
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="5 5" stroke="#ccc" />
        <XAxis dataKey="month" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
        <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} allowDecimals={false} />
        <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#ffffff', color: 'var(--crayon-dark)', fontWeight: 'bold', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}} />
        <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
        {showTicket && <Bar dataKey="count" name="盤點數量" fill="var(--crayon-purple)" radius={[5, 5, 0, 0]} barSize={40} >
                  <LabelList dataKey="count" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Bar>}
        {showItem && <Bar dataKey="itemCount" name="盤點項目數量" fill="var(--crayon-blue)" radius={[5, 5, 0, 0]} barSize={40} >
                  <LabelList dataKey="itemCount" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Bar>}
      </BarChart>
    );
  };

  // Generate Year options (e.g. from 2024 to current year + 1)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({length: 5}, (_, i) => currentYear - 2 + i);

  const personnelColors = useMemo(() => {
    const colors = ['#f44336', '#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548', '#e91e63', '#607d8b', '#cddc39', '#3f51b5', '#ffeb3b', '#009688', '#ff5722', '#673ab7', '#8bc34a'];
    const map: Record<string, string> = {};
    personnel.forEach((p, idx) => {
      map[p.name] = colors[idx % colors.length];
    });
    map['未知人員'] = '#999999';
    return map;
  }, [personnel]);

  // Weekly calendar logic
  const weeklyCalendarData = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    let totalWeeklyCount = 0;
    let totalWeeklyItems = 0;
    const weeklyStatsMap: Record<string, { count: number; itemCount: number }> = {};
    const days = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(calendarWeekStart);
      d.setDate(calendarWeekStart.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const holidayObj = holidays.find(h => h.date === dateStr);
      const isHoliday = !!holidayObj;
      const holidayDesc = holidayObj ? holidayObj.description : '';
      
      const dayTickets = filteredTickets.filter(t => {
        if (!t.dispatchDate) return false;
        const td = new Date(t.dispatchDate);
        const tdStr = `${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,'0')}-${String(td.getDate()).padStart(2,'0')}`;
        return tdStr === dateStr;
      });
      const count = dayTickets.length;
      const itemCount = dayTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      totalWeeklyCount += count;
      totalWeeklyItems += itemCount;

      const statsMap: Record<string, { count: number; itemCount: number }> = {};
      dayTickets.forEach(t => {
        const pName = personnel.find(p => p.id === t.assigneeId)?.name || '未知人員';
        const items = t.itemCount || 0;
        if (!statsMap[pName]) statsMap[pName] = { count: 0, itemCount: 0 };
        statsMap[pName].count += 1;
        statsMap[pName].itemCount += items;
        if (!weeklyStatsMap[pName]) weeklyStatsMap[pName] = { count: 0, itemCount: 0 };
        weeklyStatsMap[pName].count += 1;
        weeklyStatsMap[pName].itemCount += items;
      });
      
      const personnelStats = Object.keys(statsMap).map(name => ({
        name, count: statsMap[name].count, itemCount: statsMap[name].itemCount, color: personnelColors[name] || '#999999'
      })).sort((a, b) => b.count - a.count);
      
      return {
        personnelStats,
        date: d,
        dateStr,
        isHoliday,
        holidayDesc,
        isToday: dateStr === todayStr,
        dayName: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
        count,
        itemCount
      };
    });
    
    const weeklyPersonnelStats = Object.keys(weeklyStatsMap).map(name => ({
      name, count: weeklyStatsMap[name].count, itemCount: weeklyStatsMap[name].itemCount, color: personnelColors[name] || '#999999'
    })).sort((a, b) => b.count - a.count);

    return { days, totalWeeklyCount, totalWeeklyItems, weeklyPersonnelStats };
  }, [filteredTickets, holidays, calendarWeekStart, personnel, personnelColors]);

  const monthTicketsList = useMemo(() => {
    return filteredTickets.filter(t => {
      if (!t.dispatchDate) return false;
      const d = new Date(t.dispatchDate);
      return d.getFullYear() === displayYear && d.getMonth() === displayMonth - 1;
    });
  }, [filteredTickets, displayYear, displayMonth]);

  const monthTotalTickets = monthTicketsList.length;
  const monthTotalItems = useMemo(() => {
    return monthTicketsList.reduce((sum, t) => sum + (t.itemCount || 0), 0);
  }, [monthTicketsList]);

  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showMonthChart, setShowMonthChart] = useState(false);

  const monthlyData = useMemo(() => {
    const map: Record<string, { count: number; itemCount: number }> = {};
    monthTicketsList.forEach(t => {
      const pName = personnel.find(p => p.id === t.assigneeId)?.name || '未知人員';
      if (!map[pName]) map[pName] = { count: 0, itemCount: 0 };
      map[pName].count += 1;
      map[pName].itemCount += (t.itemCount || 0);
    });
    return Object.keys(map).map(name => ({
      name, count: map[name].count, itemCount: map[name].itemCount, color: personnelColors[name] || '#999999'
    })).sort((a, b) => b.count - a.count);
  }, [monthTicketsList, personnel, personnelColors]);

  // '盤點中' workflow stage ID for completed inventory ticket statistics
  const invStageId = useMemo(() => {
    const stage = workflows.find(w => w.name === '盤點中');
    return stage ? stage.id : null;
  }, [workflows]);

  // Weekly completed calendar logic (based on '盤點中' workflow date)
  const weeklyCompletedCalendarData = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    let totalWeeklyCount = 0;
    let totalWeeklyItems = 0;
    const weeklyStatsMap: Record<string, { count: number; itemCount: number }> = {};
    const days = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(completedWeekStart);
      d.setDate(completedWeekStart.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const holidayObj = holidays.find(h => h.date === dateStr);
      const isHoliday = !!holidayObj;
      const holidayDesc = holidayObj ? holidayObj.description : '';

      const dayTickets = filteredTickets.filter(t => {
        if (!invStageId || !t.stageDates || !t.stageDates[invStageId]) return false;
        const td = new Date(t.stageDates[invStageId]);
        const tdStr = `${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,'0')}-${String(td.getDate()).padStart(2,'0')}`;
        return tdStr === dateStr;
      });
      const count = dayTickets.length;
      const itemCount = dayTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      totalWeeklyCount += count;
      totalWeeklyItems += itemCount;

      const statsMap: Record<string, { count: number; itemCount: number }> = {};
      dayTickets.forEach(t => {
        const pName = personnel.find(p => p.id === t.assigneeId)?.name || '未知人員';
        const items = t.itemCount || 0;
        if (!statsMap[pName]) statsMap[pName] = { count: 0, itemCount: 0 };
        statsMap[pName].count += 1;
        statsMap[pName].itemCount += items;
        if (!weeklyStatsMap[pName]) weeklyStatsMap[pName] = { count: 0, itemCount: 0 };
        weeklyStatsMap[pName].count += 1;
        weeklyStatsMap[pName].itemCount += items;
      });

      const personnelStats = Object.keys(statsMap).map(name => ({
        name, count: statsMap[name].count, itemCount: statsMap[name].itemCount, color: personnelColors[name] || '#999999'
      })).sort((a, b) => b.count - a.count);

      return {
        personnelStats,
        date: d,
        dateStr,
        isHoliday,
        holidayDesc,
        isToday: dateStr === todayStr,
        dayName: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
        count,
        itemCount
      };
    });

    const weeklyPersonnelStats = Object.keys(weeklyStatsMap).map(name => ({
      name, count: weeklyStatsMap[name].count, itemCount: weeklyStatsMap[name].itemCount, color: personnelColors[name] || '#999999'
    })).sort((a, b) => b.count - a.count);

    return { days, totalWeeklyCount, totalWeeklyItems, weeklyPersonnelStats };
  }, [filteredTickets, holidays, completedWeekStart, personnel, personnelColors, invStageId]);

  const completedMonthTicketsList = useMemo(() => {
    return filteredTickets.filter(t => {
      if (!invStageId || !t.stageDates || !t.stageDates[invStageId]) return false;
      const d = new Date(t.stageDates[invStageId]);
      return d.getFullYear() === completedDisplayYear && d.getMonth() === completedDisplayMonth - 1;
    });
  }, [filteredTickets, completedDisplayYear, completedDisplayMonth, invStageId]);

  const completedMonthTotalTickets = completedMonthTicketsList.length;
  const completedMonthTotalItems = useMemo(() => {
    return completedMonthTicketsList.reduce((sum, t) => sum + (t.itemCount || 0), 0);
  }, [completedMonthTicketsList]);

  const [expandedCompletedDay, setExpandedCompletedDay] = useState<string | null>(null);
  const [showCompletedMonthChart, setShowCompletedMonthChart] = useState(false);

  const completedMonthlyData = useMemo(() => {
    const map: Record<string, { count: number; itemCount: number }> = {};
    completedMonthTicketsList.forEach(t => {
      const pName = personnel.find(p => p.id === t.assigneeId)?.name || '未知人員';
      if (!map[pName]) map[pName] = { count: 0, itemCount: 0 };
      map[pName].count += 1;
      map[pName].itemCount += (t.itemCount || 0);
    });
    return Object.keys(map).map(name => ({
      name, count: map[name].count, itemCount: map[name].itemCount, color: personnelColors[name] || '#999999'
    })).sort((a, b) => b.count - a.count);
  }, [completedMonthTicketsList, personnel, personnelColors]);

  // 每位盤點人員的當週盤點單完成數量 (依當週週一~週五的「盤點中」流程日期統計)
  const personnelWeeklyCompletedList = useMemo(() => {
    const weekDates = new Set(weeklyCompletedCalendarData.days.map(d => d.dateStr));
    return personnelStats.map(p => {
      const completedInWeek = filteredTickets.filter(t => {
        if (t.assigneeId !== p.id) return false;
        if (!invStageId || !t.stageDates || !t.stageDates[invStageId]) return false;
        const td = new Date(t.stageDates[invStageId]);
        const tdStr = `${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,'0')}-${String(td.getDate()).padStart(2,'0')}`;
        return weekDates.has(tdStr);
      });
      return {
        id: p.id,
        name: p.name,
        title: p.title,
        count: completedInWeek.length,
        itemCount: completedInWeek.reduce((sum, t) => sum + (t.itemCount || 0), 0)
      };
    });
  }, [personnelStats, filteredTickets, weeklyCompletedCalendarData.days, invStageId]);

  // 判斷下方備料員是否都已切換至「統計數據」、「盤點中」或「未完成」分頁
  const isAllStatsTab = useMemo(() => {
    if (personnelStats.length === 0) return false;
    return personnelStats.every(p => (activeTab[p.id] || 'stats') === 'stats');
  }, [personnelStats, activeTab]);

  const isAllDoingTab = useMemo(() => {
    if (personnelStats.length === 0) return false;
    return personnelStats.every(p => (activeTab[p.id] || 'stats') === 'doing');
  }, [personnelStats, activeTab]);

  const isAllIncompleteTab = useMemo(() => {
    if (personnelStats.length === 0) return false;
    return personnelStats.every(p => (activeTab[p.id] || 'stats') === 'incomplete');
  }, [personnelStats, activeTab]);

  const handleSwitchAllPersonnelTab = (targetTab: 'stats' | 'incomplete' | 'doing') => {
    const nextTabMap: Record<string, 'stats' | 'incomplete' | 'doing'> = {};
    personnel.forEach(p => {
      nextTabMap[p.id] = targetTab;
    });
    personnelStats.forEach(p => {
      nextTabMap[p.id] = targetTab;
    });
    setActiveTab(nextTabMap);
  };

  // 當所有備料員皆選取「盤點中」或「未完成」時，全員總計依所有人員在該狀態的盤點單統計
  const personnelDoingTotals = useMemo(() => {
    const tYear = selectedYear;
    const tMonth = selectedMonthNum - 1;
    let totalCount = 0;
    let totalItems = 0;
    let monthDispatchCount = 0;
    let monthDispatchItems = 0;
    let clampCount = 0;
    let clampItems = 0;
    let tkwCount = 0;
    let tkwItems = 0;

    personnelStats.forEach(p => {
      const typeFilter = cardTicketType[p.id] || '';
      const taskFilter = cardTaskFilter[p.id] || '';
      const baseList = isAllIncompleteTab ? p.incompleteTickets : p.doingTickets;
      let list = typeFilter ? baseList.filter((t: InventoryTicket) => t.ticketType === typeFilter) : baseList;
      if (taskFilter) {
        list = list.filter((t: InventoryTicket) => t.taskId === taskFilter);
      }
      list.forEach((t: InventoryTicket) => {
        const items = t.itemCount || 0;
        totalCount += 1;
        totalItems += items;
        if (t.ticketType === '夾鉗') {
          clampCount += 1;
          clampItems += items;
        } else if (t.ticketType === 'TKW') {
          tkwCount += 1;
          tkwItems += items;
        }
        if (t.dispatchDate) {
          const d = new Date(t.dispatchDate);
          if (d.getFullYear() === tYear && d.getMonth() === tMonth) {
            monthDispatchCount += 1;
            monthDispatchItems += items;
          }
        }
      });
    });

    return {
      totalCount,
      totalItems,
      monthDispatchCount,
      monthDispatchItems,
      clampCount,
      clampItems,
      tkwCount,
      tkwItems
    };
  }, [personnelStats, cardTicketType, cardTaskFilter, selectedYear, selectedMonthNum, isAllIncompleteTab]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ margin: 0, fontFamily: 'Caveat, cursive', fontSize: '2.5rem', color: 'var(--crayon-blue)' }}>📊 儀表板</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-dark)' }}>西元年度：</label>
            <select className="doodle-input" style={{ width: 'auto', backgroundColor: '#e8f5e9', fontSize: '1.1rem' }} value={globalYear} onChange={e => setGlobalYear(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">全部年度</option>
              {yearOptions.map(y => <option key={y} value={y}>{y} 年</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#e8f5e9' }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--crayon-dark)' }}>🔍 查詢條件</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>盤點種類：</label>
            <select className="doodle-input" style={{ width: 'auto', backgroundColor: '#e3f2fd' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)}>
              <option value="全部">全部</option>
              <option value="一般">一般</option>
              <option value="追加">追加</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>盤點任務狀態：</label>
            <select className="doodle-input" style={{ width: 'auto', backgroundColor: '#fff3e0' }} value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value as 'all' | 'active' | 'expired')}>
              <option value="all">全部</option>
              <option value="active">未過期</option>
              <option value="expired">已過期</option>
            </select>
            <label style={{ fontWeight: 'bold', marginLeft: '10px' }}>切換盤點任務：</label>
            <select className="doodle-input" style={{ width: 'auto', backgroundColor: '#e3f2fd' }} value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value)}>
              <option value="">-- 全域資料 (不指定任務) --</option>
            {tasks.filter(t => {
              if (taskStatusFilter === 'all') return true;
              
              let isExpired = false;
              if (t.endDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const end = new Date(t.endDate);
                if (!isNaN(end.getTime())) {
                  end.setHours(23, 59, 59, 999);
                  if (today.getTime() > end.getTime()) {
                    isExpired = true;
                  }
                }
              }

              if (taskStatusFilter === 'active') return !isExpired;
              if (taskStatusFilter === 'expired') return isExpired;
              return true;
            }).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
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
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
        <div className="doodle-border" style={{ padding: '15px', textAlign: 'center', backgroundColor: '#fff3e0', flex: 1 }}>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <span style={{ color: 'var(--crayon-orange)' }}>處理中單據 <br/><span style={{ fontSize: '2rem' }}>{stats.inProgress}</span></span>
            <span style={{ color: '#555', fontSize: '1rem' }}>/</span> 
            <span style={{ color: 'var(--crayon-purple)' }}>總開立單據 <br/><span style={{ fontSize: '1.5rem' }}>{stats.total}</span></span>
          </div>
        </div>
        
        <div className="doodle-border" style={{ padding: '15px', textAlign: 'center', backgroundColor: '#e8f5e9', flex: 1 }}>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <span style={{ color: '#009900' }}>處理中項目 <br/><span style={{ fontSize: '2rem' }}>{stats.inProgressItems}</span></span>
            <span style={{ color: '#555', fontSize: '1rem' }}>/</span> 
            <span style={{ color: 'var(--crayon-purple)' }}>總開立項目 <br/><span style={{ fontSize: '1.5rem' }}>{stats.totalItems}</span></span>
          </div>
        </div>
        
        <div className="doodle-border" style={{ padding: '15px', backgroundColor: '#e3f2fd', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', textAlign: 'center' }}>整體完成率</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--crayon-blue)', textShadow: '1px 1px 0px rgba(0,0,0,0.1)' }}>單據 ({stats.completionRate}%)</span>
            </div>
            <div style={{ position: 'relative', width: '100%', height: '22px', backgroundColor: '#bbdefb', borderRadius: '11px', overflow: 'hidden', border: '2px solid var(--crayon-blue)' }}>
              <div style={{ width: `${stats.completionRate}%`, height: '100%', backgroundColor: 'var(--crayon-blue)', transition: 'width 0.5s ease-in-out' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: stats.completionRate > 50 ? 'white' : 'var(--crayon-dark)', fontSize: '0.9rem', fontWeight: 'bold', textShadow: stats.completionRate > 50 ? '1px 1px 2px rgba(0,0,0,0.7)' : 'none', whiteSpace: 'nowrap' }}>
                {stats.closed} / {stats.total}
              </div>
            </div>
          </div>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#009900', textShadow: '1px 1px 0px rgba(0,0,0,0.1)' }}>項目 ({stats.itemCompletionRate}%)</span>
            </div>
            <div style={{ position: 'relative', width: '100%', height: '22px', backgroundColor: '#c8e6c9', borderRadius: '11px', overflow: 'hidden', border: '2px solid #009900' }}>
              <div style={{ width: `${stats.itemCompletionRate}%`, height: '100%', backgroundColor: '#009900', transition: 'width 0.5s ease-in-out' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: stats.itemCompletionRate > 50 ? 'white' : 'var(--crayon-dark)', fontSize: '0.9rem', fontWeight: 'bold', textShadow: stats.itemCompletionRate > 50 ? '1px 1px 2px rgba(0,0,0,0.7)' : 'none', whiteSpace: 'nowrap' }}>
                {stats.closedItems} / {stats.totalItems}
              </div>
            </div>
          </div>
        </div>
        
        <div className="doodle-border" style={{ padding: '15px', textAlign: 'center', backgroundColor: '#f3e5f5', flex: 1 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>平均處理天數</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-purple)' }}>{stats.avgDays.toFixed(2)} <span style={{fontSize:'1rem'}}>天</span></div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* 當週盤點單派送狀況 */}
        <div className="doodle-border" style={{ padding: '20px', backgroundColor: '#fff3e0', transform: 'rotate(0.5deg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px dashed var(--crayon-orange)', paddingBottom: '10px', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--crayon-orange)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              📅 當週盤點單派送狀況 
              <span style={{ fontSize: '1rem', color: '#666', fontWeight: 'bold', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'white' }}>
                本月共 {monthTotalTickets} 筆 / {monthTotalItems} 項
              </span>
              <button className="doodle-button" onClick={() => setShowMonthChart(!showMonthChart)} style={{ padding: '2px 10px', fontSize: '0.9rem', backgroundColor: showMonthChart ? '#ffccbc' : 'var(--crayon-purple)', color: showMonthChart ? 'var(--crayon-dark)' : 'white' }}>
                {showMonthChart ? '返回當週視圖' : '📊 當月圖表檢視'}
              </button>
            </h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {!showMonthChart && (
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '1rem', backgroundColor: '#ffe0b2' }} onClick={handlePrevWeek}>◀</button>
                  <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '1rem', backgroundColor: '#ffe0b2' }} onClick={handleNextWeek}>▶</button>
                </div>
              )}
              <select className="doodle-input" style={{ width: 'auto', backgroundColor: 'white', padding: '2px 5px', fontSize: '0.9rem' }} value={displayYear} onChange={handleCalYearChange}>
                {yearOptions.map(y => <option key={y} value={y}>{y} 年</option>)}
              </select>
              <select className="doodle-input" style={{ width: 'auto', backgroundColor: 'white', padding: '2px 5px', fontSize: '0.9rem' }} value={displayMonth} onChange={handleCalMonthChange}>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}
              </select>
            </div>
          </div>
          
          {showMonthChart ? (
            <div id="month-chart-container" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', border: '2px solid var(--crayon-dark)', animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: 'var(--crayon-dark)', fontFamily: 'Caveat, cursive', fontSize: '1.8rem' }}>📊 {displayYear}年{displayMonth}月 派送統計圖表</h2>
                <button className="doodle-button" style={{ padding: '4px 10px', fontSize: '0.9rem', backgroundColor: 'var(--crayon-blue)', color: 'white' }} onClick={handleExportMonthChartImage}>🖼️ 匯出圖檔</button>
              </div>
              {monthlyData.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: '1.2rem', color: '#999', padding: '50px 0' }}>本月份尚無派送單據</div>
              ) : (
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '300px', height: '350px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} margin={{ top: 25, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{fontFamily: 'Caveat, cursive', fontWeight: 'bold'}} angle={-45} textAnchor="end" />
                        <YAxis allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }} />
                        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px', fontWeight: 'bold' }} />
                        <Bar dataKey="count" name="派送數量" fill="var(--crayon-blue)" radius={[5, 5, 0, 0]}>
                          <LabelList dataKey="count" position="top" style={{ fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                        </Bar>
                        <Bar dataKey="itemCount" name="盤點項目數" fill="var(--crayon-orange)" radius={[5, 5, 0, 0]}>
                          <LabelList dataKey="itemCount" position="top" style={{ fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '10px', border: '2px dashed #ccc' }}>
                    <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid #ddd', paddingBottom: '5px', color: 'var(--crayon-dark)', fontSize: '1.1rem' }}>人員圖例與統計</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                      {monthlyData.map(d => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>{d.name}</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--crayon-blue)', fontSize: '0.95rem' }}>{d.count} 筆 / {d.itemCount} 項</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: '2px dashed #ddd', paddingTop: '10px', marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-dark)' }}>當月總計</span>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-orange)' }}>{monthTotalTickets} 筆 / {monthTotalItems} 項</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch', flexWrap: 'wrap' }}>
              {weeklyCalendarData.days.map((day, idx) => (
                <div key={idx} onClick={() => { if (!day.isHoliday && day.count > 0) setExpandedDay(expandedDay === day.dateStr ? null : day.dateStr) }} style={{ 
                  flex: 1, minWidth: '120px', backgroundColor: 'white',
                  border: '2px solid var(--crayon-dark)', borderRadius: '5px',
                  boxShadow: '3px 3px 0px rgba(0,0,0,0.15)', overflow: 'hidden', position: 'relative',
                  cursor: (!day.isHoliday && day.count > 0) ? 'pointer' : 'default',
                  transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
                  transform: expandedDay === day.dateStr ? 'scale(1.02)' : 'none'
                }}>
                  <div style={{ 
                    backgroundColor: day.isHoliday ? 'var(--crayon-red)' : (day.isToday ? 'var(--crayon-blue)' : '#666'), 
                    color: 'white', width: '100%', textAlign: 'center', padding: '5px 0',
                    fontWeight: 'bold', fontSize: '1rem', borderBottom: '2px dashed var(--crayon-dark)'
                  }}>
                    星期{day.dayName}
                    {day.isToday && <span style={{ marginLeft: '5px', fontSize: '0.7rem', backgroundColor: 'white', color: 'var(--crayon-blue)', padding: '1px 5px', borderRadius: '10px', verticalAlign: 'middle' }}>今日</span>}
                  </div>
                  <div style={{ position: 'absolute', top: '5px', left: '15px', width: '6px', height: '12px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '3px' }}></div>
                  <div style={{ position: 'absolute', top: '5px', right: '15px', width: '6px', height: '12px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '3px' }}></div>
                  
                  <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-dark)', margin: '0', fontFamily: 'Caveat, cursive', lineHeight: '1' }}>
                      {day.date.getDate()}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '5px' }}>
                      {day.date.getMonth() + 1}月
                    </div>
                    
                    {day.isHoliday ? (
                      <div style={{ color: 'var(--crayon-red)', fontWeight: 'bold', padding: '10px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem' }}>休假</div>
                        {day.holidayDesc && <div style={{ fontSize: '0.9rem', marginTop: '5px' }}>{day.holidayDesc}</div>}
                      </div>
                    ) : (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {day.count > 0 ? (
                          expandedDay === day.dateStr ? (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '5px', animation: 'fadeIn 0.3s' }}>
                              {day.personnelStats?.map(ps => (
                                <div key={ps.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5', padding: '4px 8px', borderRadius: '5px', borderLeft: `4px solid ${ps.color}` }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: ps.color }}>{ps.name}</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>{ps.count}筆 / {ps.itemCount}項</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--crayon-blue)' }}>{day.count}</span>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: '#666' }}>筆派送</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--crayon-purple)', marginTop: '4px', lineHeight: '1.2' }}>共 {day.itemCount} 項</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--crayon-blue)', marginTop: '4px' }}>(點擊查看)</span>
                              </div>
                            </>
                          )
                        ) : (
                          <span style={{ fontSize: '1rem', color: '#999', padding: '10px 0' }}>無派送</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div 
                onClick={() => { if (weeklyCalendarData.totalWeeklyCount > 0) setExpandedDay(expandedDay === 'week' ? null : 'week') }} 
                style={{ 
                flex: 1, minWidth: '150px', backgroundColor: 'white',
                border: '2px solid var(--crayon-dark)', borderRadius: '5px',
                boxShadow: '3px 3px 0px rgba(0,0,0,0.15)', overflow: 'hidden', position: 'relative',
                cursor: weeklyCalendarData.totalWeeklyCount > 0 ? 'pointer' : 'default',
                transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
                transform: expandedDay === 'week' ? 'scale(1.02)' : 'none'
              }}>
                <div style={{ 
                  backgroundColor: 'var(--crayon-orange)', 
                  color: 'white', width: '100%', textAlign: 'center', padding: '5px 0',
                  fontWeight: 'bold', fontSize: '1rem', borderBottom: '2px dashed var(--crayon-dark)'
                }}>
                  當週總計
                </div>
                <div style={{ position: 'absolute', top: '5px', left: '15px', width: '6px', height: '12px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '3px' }}></div>
                <div style={{ position: 'absolute', top: '5px', right: '15px', width: '6px', height: '12px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '3px' }}></div>
                
                <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  {expandedDay === 'week' ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '5px', animation: 'fadeIn 0.3s' }}>
                      {weeklyCalendarData.weeklyPersonnelStats.map(ps => (
                        <div key={ps.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5', padding: '4px 8px', borderRadius: '5px', borderLeft: `4px solid ${ps.color}` }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: ps.color }}>{ps.name}</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>{ps.count}筆 / {ps.itemCount}項</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '3.2rem', fontWeight: '900', color: 'var(--crayon-orange)', fontFamily: 'Caveat, cursive', lineHeight: '1', marginBottom: '4px', textShadow: '2px 2px 0px rgba(0,0,0,0.1)' }}>{weeklyCalendarData.totalWeeklyCount}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: '#666' }}>筆派送單據</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--crayon-purple)', marginTop: '4px', lineHeight: '1.2' }}>共 {weeklyCalendarData.totalWeeklyItems} 項</span>
                        {weeklyCalendarData.totalWeeklyCount > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--crayon-orange)', marginTop: '4px' }}>(點擊查看)</span>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 當週盤點單完成狀況 */}
        <div className="doodle-border" style={{ padding: '20px', backgroundColor: '#e8f5e9', transform: 'rotate(-0.4deg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px dashed var(--crayon-green)', paddingBottom: '10px', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#2e7d32', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              📅 當週盤點單完成狀況 
              <span style={{ fontSize: '1rem', color: '#666', fontWeight: 'bold', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'white' }}>
                本月共 {completedMonthTotalTickets} 筆 / {completedMonthTotalItems} 項
              </span>
              <button className="doodle-button" onClick={() => setShowCompletedMonthChart(!showCompletedMonthChart)} style={{ padding: '2px 10px', fontSize: '0.9rem', backgroundColor: showCompletedMonthChart ? '#c8e6c9' : 'var(--crayon-purple)', color: showCompletedMonthChart ? 'var(--crayon-dark)' : 'white' }}>
                {showCompletedMonthChart ? '返回當週視圖' : '📊 當月圖表檢視'}
              </button>
            </h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {!showCompletedMonthChart && (
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '1rem', backgroundColor: '#c8e6c9' }} onClick={handleCompletedPrevWeek}>◀</button>
                  <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '1rem', backgroundColor: '#c8e6c9' }} onClick={handleCompletedNextWeek}>▶</button>
                </div>
              )}
              <select className="doodle-input" style={{ width: 'auto', backgroundColor: 'white', padding: '2px 5px', fontSize: '0.9rem' }} value={completedDisplayYear} onChange={handleCompletedCalYearChange}>
                {yearOptions.map(y => <option key={y} value={y}>{y} 年</option>)}
              </select>
              <select className="doodle-input" style={{ width: 'auto', backgroundColor: 'white', padding: '2px 5px', fontSize: '0.9rem' }} value={completedDisplayMonth} onChange={handleCompletedCalMonthChange}>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}
              </select>
            </div>
          </div>
          
          {showCompletedMonthChart ? (
            <div id="completed-month-chart-container" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', border: '2px solid var(--crayon-dark)', animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: 'var(--crayon-dark)', fontFamily: 'Caveat, cursive', fontSize: '1.8rem' }}>📊 {completedDisplayYear}年{completedDisplayMonth}月 完成統計圖表</h2>
                <button className="doodle-button" style={{ padding: '4px 10px', fontSize: '0.9rem', backgroundColor: 'var(--crayon-blue)', color: 'white' }} onClick={handleExportCompletedMonthChartImage}>🖼️ 匯出圖檔</button>
              </div>
              {completedMonthlyData.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: '1.2rem', color: '#999', padding: '50px 0' }}>本月份尚無完成單據</div>
              ) : (
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '300px', height: '350px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={completedMonthlyData} margin={{ top: 25, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{fontFamily: 'Caveat, cursive', fontWeight: 'bold'}} angle={-45} textAnchor="end" />
                        <YAxis allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }} />
                        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px', fontWeight: 'bold' }} />
                        <Bar dataKey="count" name="完成數量" fill="var(--crayon-green)" radius={[5, 5, 0, 0]}>
                          <LabelList dataKey="count" position="top" style={{ fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                        </Bar>
                        <Bar dataKey="itemCount" name="盤點項目數" fill="var(--crayon-orange)" radius={[5, 5, 0, 0]}>
                          <LabelList dataKey="itemCount" position="top" style={{ fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '10px', border: '2px dashed #ccc' }}>
                    <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid #ddd', paddingBottom: '5px', color: 'var(--crayon-dark)', fontSize: '1.1rem' }}>人員圖例與統計</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                      {completedMonthlyData.map(d => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>{d.name}</span>
                          <span style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '0.95rem' }}>{d.count} 筆 / {d.itemCount} 項</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: '2px dashed #ddd', paddingTop: '10px', marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-dark)' }}>當月總計</span>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-orange)' }}>{completedMonthTotalTickets} 筆 / {completedMonthTotalItems} 項</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch', flexWrap: 'wrap' }}>
              {weeklyCompletedCalendarData.days.map((day, idx) => (
                <div key={idx} onClick={() => { if (!day.isHoliday && day.count > 0) setExpandedCompletedDay(expandedCompletedDay === day.dateStr ? null : day.dateStr) }} style={{ 
                  flex: 1, minWidth: '120px', backgroundColor: 'white',
                  border: '2px solid var(--crayon-dark)', borderRadius: '5px',
                  boxShadow: '3px 3px 0px rgba(0,0,0,0.15)', overflow: 'hidden', position: 'relative',
                  cursor: (!day.isHoliday && day.count > 0) ? 'pointer' : 'default',
                  transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
                  transform: expandedCompletedDay === day.dateStr ? 'scale(1.02)' : 'none'
                }}>
                  <div style={{ 
                    backgroundColor: day.isHoliday ? 'var(--crayon-red)' : (day.isToday ? 'var(--crayon-blue)' : '#666'), 
                    color: 'white', width: '100%', textAlign: 'center', padding: '5px 0',
                    fontWeight: 'bold', fontSize: '1rem', borderBottom: '2px dashed var(--crayon-dark)'
                  }}>
                    星期{day.dayName}
                    {day.isToday && <span style={{ marginLeft: '5px', fontSize: '0.7rem', backgroundColor: 'white', color: 'var(--crayon-blue)', padding: '1px 5px', borderRadius: '10px', verticalAlign: 'middle' }}>今日</span>}
                  </div>
                  <div style={{ position: 'absolute', top: '5px', left: '15px', width: '6px', height: '12px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '3px' }}></div>
                  <div style={{ position: 'absolute', top: '5px', right: '15px', width: '6px', height: '12px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '3px' }}></div>
                  
                  <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-dark)', margin: '0', fontFamily: 'Caveat, cursive', lineHeight: '1' }}>
                      {day.date.getDate()}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '5px' }}>
                      {day.date.getMonth() + 1}月
                    </div>
                    
                    {day.isHoliday ? (
                      <div style={{ color: 'var(--crayon-red)', fontWeight: 'bold', padding: '10px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem' }}>休假</div>
                        {day.holidayDesc && <div style={{ fontSize: '0.9rem', marginTop: '5px' }}>{day.holidayDesc}</div>}
                      </div>
                    ) : (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {day.count > 0 ? (
                          expandedCompletedDay === day.dateStr ? (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '5px', animation: 'fadeIn 0.3s' }}>
                              {day.personnelStats?.map(ps => (
                                <div key={ps.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5', padding: '4px 8px', borderRadius: '5px', borderLeft: `4px solid ${ps.color}` }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: ps.color }}>{ps.name}</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>{ps.count}筆 / {ps.itemCount}項</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#2e7d32' }}>{day.count}</span>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: '#666' }}>筆完成</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--crayon-purple)', marginTop: '4px', lineHeight: '1.2' }}>共 {day.itemCount} 項</span>
                                <span style={{ fontSize: '0.75rem', color: '#2e7d32', marginTop: '4px' }}>(點擊查看)</span>
                              </div>
                            </>
                          )
                        ) : (
                          <span style={{ fontSize: '1rem', color: '#999', padding: '10px 0' }}>無完成</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div 
                onClick={() => { if (weeklyCompletedCalendarData.totalWeeklyCount > 0) setExpandedCompletedDay(expandedCompletedDay === 'week' ? null : 'week') }} 
                style={{ 
                flex: 1, minWidth: '150px', backgroundColor: 'white',
                border: '2px solid var(--crayon-dark)', borderRadius: '5px',
                boxShadow: '3px 3px 0px rgba(0,0,0,0.15)', overflow: 'hidden', position: 'relative',
                cursor: weeklyCompletedCalendarData.totalWeeklyCount > 0 ? 'pointer' : 'default',
                transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
                transform: expandedCompletedDay === 'week' ? 'scale(1.02)' : 'none'
              }}>
                <div style={{ 
                  backgroundColor: '#2e7d32', 
                  color: 'white', width: '100%', textAlign: 'center', padding: '5px 0',
                  fontWeight: 'bold', fontSize: '1rem', borderBottom: '2px dashed var(--crayon-dark)'
                }}>
                  當週總計
                </div>
                <div style={{ position: 'absolute', top: '5px', left: '15px', width: '6px', height: '12px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '3px' }}></div>
                <div style={{ position: 'absolute', top: '5px', right: '15px', width: '6px', height: '12px', backgroundColor: 'white', border: '1px solid var(--crayon-dark)', borderRadius: '3px' }}></div>
                
                <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  {expandedCompletedDay === 'week' ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '5px', animation: 'fadeIn 0.3s' }}>
                      {weeklyCompletedCalendarData.weeklyPersonnelStats.map(ps => (
                        <div key={ps.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5', padding: '4px 8px', borderRadius: '5px', borderLeft: `4px solid ${ps.color}` }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: ps.color }}>{ps.name}</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>{ps.count}筆 / {ps.itemCount}項</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '3.2rem', fontWeight: '900', color: '#2e7d32', fontFamily: 'Caveat, cursive', lineHeight: '1', marginBottom: '4px', textShadow: '2px 2px 0px rgba(0,0,0,0.1)' }}>{weeklyCompletedCalendarData.totalWeeklyCount}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: '#666' }}>筆完成單據</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--crayon-purple)', marginTop: '4px', lineHeight: '1.2' }}>共 {weeklyCompletedCalendarData.totalWeeklyItems} 項</span>
                        {weeklyCompletedCalendarData.totalWeeklyCount > 0 && <span style={{ fontSize: '0.75rem', color: '#2e7d32', marginTop: '4px' }}>(點擊查看)</span>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 備料員盤點情況 - Moved ABOVE Chart & Restyled to Doodle Cards */}
        <div className="doodle-border" style={{ padding: '20px', backgroundColor: '#e0f7fa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: personnelCollapsed ? 'none' : '3px dashed var(--crayon-dark)', paddingBottom: personnelCollapsed ? '0' : '10px', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.8rem' }}>👥 備料員盤點情況</h3>
              <button
                type="button"
                className="doodle-button"
                style={{ padding: '4px 12px', fontSize: '0.95rem', backgroundColor: personnelCollapsed ? 'var(--crayon-green)' : '#ffe0b2', color: 'var(--crayon-dark)' }}
                onClick={() => setPersonnelCollapsed(prev => !prev)}
              >
                {personnelCollapsed ? '🔽 展開' : '🔼 收合'}
              </button>
              <button
                type="button"
                className="doodle-button"
                style={{ padding: '4px 12px', fontSize: '0.95rem', backgroundColor: 'var(--crayon-blue)', color: 'white' }}
                onClick={() => setPrintingAllPersonnel(true)}
                disabled={personnelStats.length === 0}
                title="列印所有備料員的盤點情況圖檔"
              >
                🖨️ 列印
              </button>
              <select
                className="doodle-input"
                style={{ width: 'auto', backgroundColor: 'white', padding: '4px 10px', fontSize: '0.95rem' }}
                value={personnelPrintMode}
                onChange={e => setPersonnelPrintMode(e.target.value as 'detail' | 'summary')}
                title="選擇列印內容模式"
              >
                <option value="detail">詳細</option>
                <option value="summary">統計數據</option>
              </select>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  padding: '4px 10px',
                  borderRadius: '10px',
                  border: '2px solid var(--crayon-dark)',
                  userSelect: 'none'
                }}
              >
                <input
                  type="checkbox"
                  checked={excludeZeroPersonnel}
                  onChange={e => setExcludeZeroPersonnel(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                排除數值為0
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 'bold' }}>全部切換：</label>
                <button
                  type="button"
                  className={`doodle-button ${isAllStatsTab ? 'success' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '0.9rem', minHeight: 'auto', backgroundColor: isAllStatsTab ? undefined : 'white', color: 'var(--crayon-dark)' }}
                  onClick={() => handleSwitchAllPersonnelTab('stats')}
                >
                  📊 統計數據
                </button>
                <button
                  type="button"
                  className={`doodle-button ${isAllIncompleteTab ? 'success' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '0.9rem', minHeight: 'auto', backgroundColor: isAllIncompleteTab ? undefined : 'white', color: 'var(--crayon-dark)' }}
                  onClick={() => handleSwitchAllPersonnelTab('incomplete')}
                >
                  📋 未完成
                </button>
                <button
                  type="button"
                  className={`doodle-button ${isAllDoingTab ? 'success' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '0.9rem', minHeight: 'auto', backgroundColor: isAllDoingTab ? undefined : 'white', color: 'var(--crayon-dark)' }}
                  onClick={() => handleSwitchAllPersonnelTab('doing')}
                >
                  🏃 盤點中
                </button>
              </div>
            </div>
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
          
          {!personnelCollapsed && (
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* 總計列設計成顯眼置頂的塗鴉風格面板 */}
            {personnelStats.length > 0 && (
              <>
                <div className="doodle-border" style={{ 
                  backgroundColor: 'var(--crayon-yellow)', padding: '15px 20px', 
                  display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                  flexWrap: 'wrap', gap: '15px', border: '3px solid var(--crayon-dark)'
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    🌟 全員總計{isAllDoingTab ? ' (盤點中)' : isAllIncompleteTab ? ' (未完成)' : ''}
                  </div>
                  {(isAllDoingTab || isAllIncompleteTab) ? (
                    <>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>{isAllIncompleteTab ? '未完成總單數' : '盤點中總單數'}</div>
                        <div style={{ fontSize: '2rem', color: 'var(--crayon-red)', fontWeight: 'bold' }}>{personnelDoingTotals.totalCount} 件</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>{isAllIncompleteTab ? '未完成總項目數' : '盤點中總項目數'}</div>
                        <div style={{ fontSize: '2rem', color: 'var(--crayon-orange)', fontWeight: 'bold' }}>{personnelDoingTotals.totalItems} 項</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>夾鉗 ({isAllIncompleteTab ? '未完成' : '盤點中'})</div>
                        <div style={{ fontSize: '1.7rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>{personnelDoingTotals.clampCount} 件 / {personnelDoingTotals.clampItems} 項</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>TKW ({isAllIncompleteTab ? '未完成' : '盤點中'})</div>
                        <div style={{ fontSize: '1.7rem', color: 'var(--crayon-purple)', fontWeight: 'bold' }}>{personnelDoingTotals.tkwCount} 件 / {personnelDoingTotals.tkwItems} 項</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>本月派送 ({isAllIncompleteTab ? '未完成' : '盤點中'})</div>
                        <div style={{ fontSize: '1.7rem', color: '#2e7d32', fontWeight: 'bold' }}>{personnelDoingTotals.monthDispatchCount} 件 / {personnelDoingTotals.monthDispatchItems} 項</div>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                {/* 每位盤點人員的當週盤點單完成數量 */}
                <div className="doodle-border" style={{
                  backgroundColor: '#e8f5e9', padding: '12px 20px',
                  border: '3px solid var(--crayon-dark)',
                  display: 'flex', flexDirection: 'column', gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '6px' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>
                      📅 每位盤點人員的當週盤點單完成數量
                      <span style={{ fontSize: '0.95rem', color: '#555', marginLeft: '8px' }}>
                        ({weeklyCompletedCalendarData.days[0]?.dateStr} ~ {weeklyCompletedCalendarData.days[4]?.dateStr})
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#2e7d32', backgroundColor: 'white', padding: '3px 12px', borderRadius: '12px', border: '2px solid var(--crayon-dark)' }}>
                      當週合計：{weeklyCompletedCalendarData.totalWeeklyCount} 件 / {weeklyCompletedCalendarData.totalWeeklyItems} 項
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-around' }}>
                    {personnelWeeklyCompletedList
                      .filter(pw => !excludeZeroPersonnel || pw.count > 0 || pw.itemCount > 0)
                      .map(pw => (
                      <div key={pw.id} style={{
                        backgroundColor: 'white', padding: '8px 16px', borderRadius: '12px',
                        border: '2px solid var(--crayon-dark)', display: 'flex', alignItems: 'center',
                        gap: '10px', boxShadow: '2px 2px 0px rgba(0,0,0,0.15)'
                      }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>👤 {pw.name}</span>
                        <span style={{
                          backgroundColor: pw.count > 0 ? 'var(--crayon-yellow)' : '#eee',
                          color: 'var(--crayon-dark)', padding: '4px 10px', borderRadius: '12px',
                          fontWeight: 'bold', fontSize: '1.05rem', border: '2px dashed var(--crayon-dark)'
                        }}>
                          {pw.count} 件 / {pw.itemCount} 項
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {personnelStats.map(p => {
                const currentTab = activeTab[p.id] || 'stats';
                const currentPage = currentTab === 'doing' ? (doingPage[p.id] || 1) : (incompletePage[p.id] || 1);
                const itemsPerPage = 5;
                const typeFilter = cardTicketType[p.id];
                const taskFilter = cardTaskFilter[p.id];
                
                const targetTickets = currentTab === 'doing' ? p.doingTickets : p.incompleteTickets;
                let filteredTicketsList = typeFilter ? targetTickets.filter((t: InventoryTicket) => t.ticketType === typeFilter) : targetTickets;
                if (taskFilter) {
                  filteredTicketsList = filteredTicketsList.filter((t: InventoryTicket) => t.taskId === taskFilter);
                }

                const cardBadgeCount = currentTab === 'stats' ? p.monthCompleted : filteredTicketsList.length;
                const cardBadgeItemCount = currentTab === 'stats'
                  ? (p.monthCompletedItems || 0)
                  : filteredTicketsList.reduce((sum: number, t: InventoryTicket) => sum + (t.itemCount || 0), 0);

                if (excludeZeroPersonnel) {
                  const isZero = currentTab === 'stats'
                    ? (p.monthDispatch === 0 && p.monthCompleted === 0 && (p.monthCompletedItems || 0) === 0)
                    : (cardBadgeCount === 0 && cardBadgeItemCount === 0);
                  if (isZero) return null;
                }
                
                const totalPages = Math.ceil(filteredTicketsList.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const paginatedTickets = filteredTicketsList.slice(startIndex, startIndex + itemsPerPage);

                return (
                  <div key={p.id} className="doodle-border" style={{ padding: '15px', backgroundColor: 'white', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 15px 0', borderBottom: '2px solid #ccc', paddingBottom: '8px', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                          <span>{p.name}</span>
                          <span style={{ fontSize: '0.95rem', color: '#888' }}>({p.title})</span>
                        </h4>
                        <span style={{ 
                          backgroundColor: 'var(--crayon-yellow)', padding: '5px 12px', borderRadius: '15px', 
                          fontSize: '1.1rem', fontWeight: 'bold', border: '2px dashed var(--crayon-dark)',
                          color: 'var(--crayon-dark)', whiteSpace: 'nowrap'
                        }}>
                          {cardBadgeCount} 件 / {cardBadgeItemCount} 項
                        </span>
                      </div>
                      <button
                        type="button"
                        className="doodle-button"
                        style={{ padding: '4px 12px', fontSize: '0.95rem', backgroundColor: 'var(--crayon-blue)', color: 'white', whiteSpace: 'nowrap' }}
                        onClick={() => setPrintingCard({
                          person: p,
                          tab: currentTab,
                          ticketsList: filteredTicketsList,
                          taskFilterId: taskFilter || '',
                          ticketTypeFilter: typeFilter || ''
                        })}
                        title="依目前所選功能內容匯出圖檔"
                      >
                        🖨️ 列印
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '22px' }}>
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
                      <button 
                        className={`doodle-button ${currentTab === 'doing' ? 'success' : ''}`} 
                        style={{ flex: 1, padding: '5px', minHeight: 'auto', position: 'relative' }}
                        onClick={() => setActiveTab(prev => ({...prev, [p.id]: 'doing'}))}
                      >
                        🏃 盤點中
                        {p.doingCount > 0 && (
                          <>
                            <span style={{
                              position: 'absolute', top: '-15px', right: '-15px',
                              backgroundColor: 'var(--crayon-purple)', color: 'white',
                              border: '3px solid var(--crayon-dark)',
                              borderRadius: '50%', width: '32px', height: '32px',
                              fontSize: '1.2rem', fontWeight: '900', display: 'flex', 
                              alignItems: 'center', justifyContent: 'center', zIndex: 1,
                              boxShadow: '2px 2px 0px rgba(0,0,0,0.3)',
                              transform: 'rotate(-5deg)'
                            }}>
                              {p.doingCount}
                            </span>
                            <span style={{
                              position: 'absolute', bottom: '-18px', right: '-14px',
                              backgroundColor: 'var(--crayon-yellow)', color: 'var(--crayon-dark)',
                              border: '3px solid var(--crayon-dark)',
                              borderRadius: '14px', padding: '2px 9px',
                              fontSize: '1.15rem', fontWeight: '900', lineHeight: '1.2',
                              whiteSpace: 'nowrap', zIndex: 1,
                              boxShadow: '2px 2px 0px rgba(0,0,0,0.3)',
                              textShadow: '0.5px 0 0 currentColor',
                              transform: 'rotate(3deg)'
                            }}>
                              {p.doingItemCount}項
                            </span>
                          </>
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
                          
                          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                            <div style={{ 
                              flex: 1, backgroundColor: '#e8eaf6', padding: '10px', 
                              borderRadius: '10px', textAlign: 'center', border: '1px dashed var(--crayon-blue)' 
                            }}>
                              <div style={{ fontSize: '0.9rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>
                                本月完成項目數
                              </div>
                              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>{p.monthCompletedItems || 0}</div>
                            </div>
                            <div style={{ 
                              flex: 1, backgroundColor: '#e8eaf6', padding: '10px', 
                              borderRadius: '10px', textAlign: 'center', border: '1px dashed var(--crayon-blue)' 
                            }}>
                              <div style={{ fontSize: '0.9rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>
                                {selectedTaskId ? '此任務已盤點項目數' : '已完成總項目數'}
                              </div>
                              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>{p.totalCompletedItems}</div>
                            </div>
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
                            <strong>平均：</strong> <span style={{ color: p.monthCompleted > 0 ? 'var(--crayon-red)' : '#888', fontWeight: 'bold', fontSize: '1.1rem' }}>{p.monthCompleted > 0 ? `${p.avgDays.toFixed(2)} 天` : '-'}</span>
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
                            <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>總計：{filteredTicketsList.length} 件 / {filteredTicketsList.reduce((sum: number, t: InventoryTicket) => sum + (t.itemCount || 0), 0)} 項</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <select 
                                className="doodle-input" 
                                style={{ width: 'auto', padding: '2px 5px', fontSize: '0.8rem', backgroundColor: 'white' }}
                                value={cardTaskFilter[p.id] || ''}
                                onChange={e => {
                                  setCardTaskFilter(prev => ({...prev, [p.id]: e.target.value}));
                                  if (currentTab === 'doing') setDoingPage(prev => ({...prev, [p.id]: 1}));
                                  else setIncompletePage(prev => ({...prev, [p.id]: 1}));
                                }}
                              >
                                <option value="">-- 所有任務 --</option>
                                {tasks.filter(tk => tk.endDate >= new Date().getTime() - (24 * 60 * 60 * 1000)).map(tk => (
                                  <option key={tk.id} value={tk.id}>{tk.name}</option>
                                ))}
                              </select>
                              <select 
                                className="doodle-input" 
                                style={{ width: 'auto', padding: '2px 5px', fontSize: '0.8rem', backgroundColor: 'white' }}
                                value={cardTicketType[p.id] || ''}
                                onChange={e => {
                                  setCardTicketType(prev => ({...prev, [p.id]: e.target.value}));
                                  if (currentTab === 'doing') setDoingPage(prev => ({...prev, [p.id]: 1}));
                                  else setIncompletePage(prev => ({...prev, [p.id]: 1}));
                                }}
                              >
                                <option value="">全部類型</option>
                                <option value="夾鉗">夾鉗</option>
                                <option value="TKW">TKW</option>
                              </select>
                            </div>
                          </div>
                          
                          {filteredTicketsList.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>太棒了！目前沒有{currentTab === 'doing' ? '盤點中' : '未完成'}的單據 🎉</div>
                          ) : (
                            <>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                {paginatedTickets.map((t: InventoryTicket, idx: number) => {
                                  const { currentStageName, currentAssigneeName } = getTicketStageInfo(t);
                                  
                                  return (
                                    <li key={t.id} style={{ 
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      backgroundColor: t.taskId ? '#e1f5fe' : 'white', padding: '6px 10px', 
                                      border: `2px solid ${t.taskId ? 'var(--crayon-blue)' : 'var(--crayon-dark)'}`, borderRadius: '8px',
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
                                    onClick={() => {
                                      if (currentTab === 'doing') setDoingPage(prev => ({...prev, [p.id]: currentPage - 1}));
                                      else setIncompletePage(prev => ({...prev, [p.id]: currentPage - 1}));
                                    }}
                                  >◀</button>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{currentPage} / {totalPages}</span>
                                  <button 
                                    className="doodle-button" style={{ padding: '2px 8px', minHeight: 'auto', fontSize: '0.8rem' }}
                                    disabled={currentPage === totalPages}
                                    onClick={() => {
                                      if (currentTab === 'doing') setDoingPage(prev => ({...prev, [p.id]: currentPage + 1}));
                                      else setIncompletePage(prev => ({...prev, [p.id]: currentPage + 1}));
                                    }}
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
          )}
        </div>

        {/* 所有未結案盤點單狀態 */}
        <div className="doodle-border" style={{ 
          padding: '20px', backgroundColor: '#e3f2fd', marginBottom: '30px',
          transform: 'rotate(0.5deg)', boxShadow: '5px 5px 0px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: unclosedCollapsed ? 'none' : '2px dashed var(--crayon-dark)', paddingBottom: unclosedCollapsed ? '0' : '10px', marginBottom: unclosedCollapsed ? '0' : '15px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.8rem' }}>
                ⏳ 未結案盤點單狀態
              </h3>
              <button
                type="button"
                className="doodle-button"
                style={{ padding: '4px 12px', fontSize: '0.95rem', backgroundColor: unclosedCollapsed ? 'var(--crayon-green)' : '#ffe0b2', color: 'var(--crayon-dark)' }}
                onClick={() => setUnclosedCollapsed(prev => !prev)}
              >
                {unclosedCollapsed ? '🔽 展開' : '🔼 收合'}
              </button>
              <button
                type="button"
                className="doodle-button"
                style={{ padding: '4px 12px', fontSize: '0.95rem', backgroundColor: 'var(--crayon-blue)', color: 'white' }}
                onClick={handlePrintUnclosed}
                disabled={globalUnclosedTickets.length === 0}
                title="列印所有人員的未結案盤點單圖檔"
              >
                🖨️ 列印
              </button>
              {!unclosedCollapsed && (
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
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-dark)' }}>
                全部總計：{globalUnclosedTickets.length} 件 / {globalUnclosedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0)} 項
              </div>
              
              {!unclosedCollapsed && unclosedViewMode === 'list' && (
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
              
              {!unclosedCollapsed && unclosedViewMode === 'chart' && (
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
          
          {!unclosedCollapsed && unclosedViewMode === 'chart' && globalUnclosedTickets.length > 0 && (
            <div id="unclosed-chart-container" style={{ height: '350px', backgroundColor: 'white', borderRadius: '10px', border: '2px solid var(--crayon-dark)', padding: '10px', marginBottom: '20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                {unclosedChartType === 'bar' ? (
                  <BarChart data={unclosedChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '10px', border: '2px solid var(--crayon-dark)' }} />
                    <Legend />
                    <Bar dataKey="ticketCount" name="單據數量 (件)" fill="var(--crayon-blue)" radius={[10, 10, 0, 0]} barSize={40}>
                      <LabelList dataKey="ticketCount" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                    </Bar>
                    <Bar dataKey="itemCount" name="盤點項目數量 (項)" fill="var(--crayon-orange)" radius={[10, 10, 0, 0]} barSize={40}>
                      <LabelList dataKey="itemCount" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                    </Bar>
                  </BarChart>
                ) : (
                  <PieChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                    <Pie 
                      data={unclosedChartData} 
                      dataKey="ticketCount" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      outerRadius={100} 
                      label={({ cx, cy, midAngle, outerRadius, value, name }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = outerRadius + 20;
                        const mAngle = midAngle || 0;
                        const x = cx + radius * Math.cos(-mAngle * RADIAN);
                        const y = cy + radius * Math.sin(-mAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="var(--crayon-dark)" fontWeight="bold" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                            {`${name} ${value}件`}
                          </text>
                        );
                      }}
                      labelLine={{ stroke: 'var(--crayon-dark)', strokeWidth: 2 }}
                    >
                      {unclosedChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={UNCLOSED_COLORS[index % UNCLOSED_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '2px solid var(--crayon-dark)', color: 'var(--crayon-dark)', fontWeight: 'bold' }} />
                    <Legend wrapperStyle={{ fontWeight: 'bold', color: 'var(--crayon-dark)' }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {!unclosedCollapsed && unclosedViewMode === 'list' && (
            globalUnclosedTickets.length === 0 ? (
              <div style={{ padding: '20px', color: '#888', textAlign: 'center' }}>目前沒有未結案的盤點單 🎉</div>
            ) : (
              renderUnclosedPersonnelCards(
                Object.keys(unclosedTicketsGrouped).filter(name => unclosedAssigneeFilter === 'all' || name === unclosedAssigneeFilter)
              )
            )
          )}
        </div>

        {/* 近半年盤點數量趨勢 (Recharts) */}
        <div className="doodle-border" style={{ 
          padding: '20px', backgroundColor: 'var(--crayon-paper)',
          transform: 'rotate(-0.5deg)', boxShadow: '5px 5px 0px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>📈 近六個月盤點數量</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'nowrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                <label style={{ fontWeight: 'bold', marginRight: '4px', fontSize: '0.95rem' }}>盤點單狀態：</label>
                <select className="doodle-input" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.95rem' }} value={chartStatusFilter} onChange={e => setChartStatusFilter(e.target.value as 'all' | 'closed' | 'unclosed')}>
                  <option value="all">全部</option>
                  <option value="closed">已結案</option>
                  <option value="unclosed">未結案</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                <label style={{ fontWeight: 'bold', marginRight: '4px', fontSize: '0.95rem' }}>統計數據：</label>
                <select className="doodle-input" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.95rem' }} value={chartMetric} onChange={e => setChartMetric(e.target.value as any)}>
                  <option value="ticketCount">盤點數量 (件)</option>
                  <option value="itemCount">盤點項目數量 (項)</option>
                  <option value="all">全部顯示</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                <label style={{ fontWeight: 'bold', marginRight: '4px', fontSize: '0.95rem' }}>圖表類型：</label>
                <select className="doodle-input" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.95rem' }} value={chartType} onChange={e => setChartType(e.target.value as any)}>
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

      {printingUnclosed && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
          <div
            ref={printUnclosedRef}
            className="doodle-border"
            style={{
              width: '1000px',
              padding: '24px',
              backgroundColor: '#e3f2fd'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.8rem' }}>⏳ 未結案盤點單狀態 (所有人員)</h3>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-dark)' }}>
                全部總計：{globalUnclosedTickets.length} 件 / {globalUnclosedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0)} 項 ｜ 列印日期：{new Date().toLocaleDateString('zh-TW')}
              </div>
            </div>
            {globalUnclosedTickets.length === 0 ? (
              <div style={{ padding: '20px', color: '#888', textAlign: 'center' }}>目前沒有未結案的盤點單 🎉</div>
            ) : (
              renderUnclosedPersonnelCards(Object.keys(unclosedTicketsGrouped))
            )}
          </div>
        </div>
      )}

      {(printingAllPersonnel || printingCard) && (() => {
        const renderPrintablePersonCard = (
          person: any,
          tab: 'stats' | 'incomplete' | 'doing',
          ticketsList: InventoryTicket[],
          taskFilterId: string,
          ticketTypeFilter: string,
          extraStyle?: React.CSSProperties,
          cardRef?: React.RefObject<HTMLDivElement | null>
        ) => (
          <div
            ref={cardRef}
            key={person.id}
            className="doodle-border"
            style={{
              padding: '20px',
              backgroundColor: 'white',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              ...extraStyle
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: '8px', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span>{person.name}</span>
                  <span style={{ fontSize: '0.95rem', color: '#888' }}>({person.title})</span>
                </h4>
                {(() => {
                  const badgeCnt = tab === 'stats' ? person.monthCompleted : ticketsList.length;
                  const badgeItems = tab === 'stats'
                    ? (person.monthCompletedItems || 0)
                    : ticketsList.reduce((sum: number, t: InventoryTicket) => sum + (t.itemCount || 0), 0);
                  return (
                    <span style={{
                      backgroundColor: 'var(--crayon-yellow)', padding: '5px 12px', borderRadius: '15px',
                      fontSize: '1.1rem', fontWeight: 'bold', border: '2px dashed var(--crayon-dark)',
                      color: 'var(--crayon-dark)', whiteSpace: 'nowrap'
                    }}>
                      {badgeCnt} 件 / {badgeItems} 項
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  backgroundColor: 'var(--crayon-green)',
                  color: 'var(--crayon-dark)',
                  border: '2px solid var(--crayon-dark)',
                  borderRadius: '8px',
                  padding: '2px 10px',
                  fontWeight: 'bold',
                  fontSize: '0.95rem'
                }}>
                  {tab === 'stats' ? '📊 統計數據' : tab === 'doing' ? '🏃 盤點中' : '📋 未完成'}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#555' }}>
                  {selectedYear}年{selectedMonthNum}月
                </span>
              </div>
            </div>

            {tab === 'stats' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>本月派送</div>
                    <div style={{ fontSize: '2rem', fontWeight: '900' }}>{person.monthDispatch}</div>
                  </div>
                  <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>本月完成</div>
                    <div style={{ fontSize: '2rem', fontWeight: '900' }}>{person.monthCompleted}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <div style={{ flex: 1, backgroundColor: '#e8eaf6', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '2px dashed var(--crayon-blue)' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>本月完成項目數</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>{person.monthCompletedItems || 0}</div>
                  </div>
                  <div style={{ flex: 1, backgroundColor: '#e8eaf6', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '2px dashed var(--crayon-blue)' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>
                      {selectedTaskId ? '此任務已盤點項目數' : '已完成總項目數'}
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>{person.totalCompletedItems}</div>
                  </div>
                </div>

                <div style={{ marginTop: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', marginBottom: '5px' }}>
                    <strong>完成率</strong>
                    <span style={{ fontSize: '1.5rem', fontWeight: '900' }}>{person.monthCompletionRate}%</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '5px', overflow: 'hidden', border: '1px solid #ccc' }}>
                    <div style={{ width: `${person.monthCompletionRate}%`, height: '100%', backgroundColor: person.monthCompletionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-blue)' }}></div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                  <strong>平均：</strong>
                  <span style={{ color: person.monthCompleted > 0 ? 'var(--crayon-red)' : '#888', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {person.monthCompleted > 0 ? `${person.avgDays.toFixed(2)} 天` : '-'}
                  </span>
                </div>
              </>
            ) : (
              <div style={{
                padding: '12px',
                backgroundColor: '#fff3e0',
                border: '2px dashed var(--crayon-orange)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>
                    總計：{ticketsList.length} 件 / {ticketsList.reduce((sum, t) => sum + (t.itemCount || 0), 0)} 項
                  </span>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>
                    <span>任務：{taskFilterId ? (tasks.find(tk => tk.id === taskFilterId)?.name || '指定任務') : '所有任務'}</span>
                    <span>｜</span>
                    <span>類型：{ticketTypeFilter || '全部類型'}</span>
                  </div>
                </div>

                {ticketsList.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>
                    太棒了！目前沒有{tab === 'doing' ? '盤點中' : '未完成'}的單據 🎉
                  </div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ticketsList.map((t, idx) => {
                      const { currentStageName, currentAssigneeName } = getTicketStageInfo(t);
                      return (
                        <li key={t.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          backgroundColor: t.taskId ? '#e1f5fe' : 'white', padding: '6px 10px',
                          border: `2px solid ${t.taskId ? 'var(--crayon-blue)' : 'var(--crayon-dark)'}`, borderRadius: '8px'
                        }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                            <span style={{ color: 'var(--crayon-blue)', marginRight: '5px' }}>{idx + 1}.</span>
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
                )}
              </div>
            )}
          </div>
        );

        return (
          <>
            {printingAllPersonnel && (
              <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
                {personnelPrintMode === 'summary' ? (
                  <div
                    ref={printAllPersonnelRef}
                    style={{
                      width: '1123px',
                      minHeight: '794px',
                      padding: '40px 48px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%', paddingBottom: '8px' }}>
                      <div style={{ flex: 1 }}></div>
                      <div style={{ flex: 2, textAlign: 'center', fontSize: '22pt', fontWeight: 'bold', color: '#000000', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const s = weeklyCompletedCalendarData.days[0]?.date;
                          const e = weeklyCompletedCalendarData.days[4]?.date;
                          const rangeText = s && e ? `(${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()})` : '';
                          return `本週${rangeText}盤點數量統計表`;
                        })()}
                      </div>
                      <div style={{ flex: 1, textAlign: 'right', fontSize: '14pt', fontWeight: 'bold', color: '#000000' }}>
                        列印日期：{new Date().toLocaleDateString('zh-TW')}
                      </div>
                    </div>

                    {(() => {
                      const allRows = personnelStats.map(p => {
                        const weeklyComp = personnelWeeklyCompletedList.find(pw => pw.id === p.id);
                        const completedCount = weeklyComp ? weeklyComp.count : 0;
                        const completedItems = weeklyComp ? weeklyComp.itemCount : 0;

                        const tab = activeTab[p.id] || 'stats';
                        const typeFilter = cardTicketType[p.id] || '';
                        const taskFilter = cardTaskFilter[p.id] || '';
                        const baseUnfinished = tab === 'incomplete' ? p.incompleteTickets : p.doingTickets;
                        let unfinishedList = typeFilter
                          ? baseUnfinished.filter((t: InventoryTicket) => t.ticketType === typeFilter)
                          : baseUnfinished;
                        if (taskFilter) {
                          unfinishedList = unfinishedList.filter((t: InventoryTicket) => t.taskId === taskFilter);
                        }
                        const uncompletedCount = unfinishedList.length;
                        const uncompletedItems = unfinishedList.reduce((sum: number, t: InventoryTicket) => sum + (t.itemCount || 0), 0);

                        const dueCount = completedCount + uncompletedCount;
                        const dueItems = completedItems + uncompletedItems;

                        return {
                          id: p.id,
                          name: p.name,
                          dueCount,
                          dueItems,
                          completedCount,
                          completedItems,
                          uncompletedCount,
                          uncompletedItems
                        };
                      });

                      const rows = excludeZeroPersonnel
                        ? allRows.filter(r => r.dueCount > 0 || r.dueItems > 0)
                        : allRows;

                      const totals = rows.reduce(
                        (acc, r) => ({
                          dueCount: acc.dueCount + r.dueCount,
                          dueItems: acc.dueItems + r.dueItems,
                          completedCount: acc.completedCount + r.completedCount,
                          completedItems: acc.completedItems + r.completedItems,
                          uncompletedCount: acc.uncompletedCount + r.uncompletedCount,
                          uncompletedItems: acc.uncompletedItems + r.uncompletedItems
                        }),
                        {
                          dueCount: 0,
                          dueItems: 0,
                          completedCount: 0,
                          completedItems: 0,
                          uncompletedCount: 0,
                          uncompletedItems: 0
                        }
                      );

                      const thStyle: React.CSSProperties = {
                        fontSize: '18pt',
                        fontWeight: 'bold',
                        border: '1px solid #000000',
                        padding: '12px 16px',
                        textAlign: 'center',
                        backgroundColor: '#f2f2f2',
                        color: '#000000'
                      };

                      const tdStyle: React.CSSProperties = {
                        fontSize: '16pt',
                        fontWeight: 'bold',
                        border: '1px solid #000000',
                        padding: '12px 16px',
                        textAlign: 'center',
                        color: '#000000'
                      };

                      return (
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000000' }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>盤點人員</th>
                              <th style={thStyle}>應完成</th>
                              <th style={thStyle}>已完成</th>
                              <th style={thStyle}>未完成</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(r => (
                              <tr key={r.id}>
                                <td style={tdStyle}>{r.name}</td>
                                <td style={tdStyle}>{r.dueCount}單/{r.dueItems}項</td>
                                <td style={tdStyle}>{r.completedCount}單/{r.completedItems}項</td>
                                <td style={tdStyle}>{r.uncompletedCount}單/{r.uncompletedItems}項</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: '#fff176', fontWeight: 'bold' }}>
                              <td style={{ ...tdStyle, fontWeight: 'bold', backgroundColor: '#fff176' }}>總計</td>
                              <td style={{ ...tdStyle, fontWeight: 'bold', backgroundColor: '#fff176' }}>{totals.dueCount}單/{totals.dueItems}項</td>
                              <td style={{ ...tdStyle, fontWeight: 'bold', backgroundColor: '#fff176' }}>{totals.completedCount}單/{totals.completedItems}項</td>
                              <td style={{ ...tdStyle, fontWeight: 'bold', backgroundColor: '#fff176' }}>{totals.uncompletedCount}單/{totals.uncompletedItems}項</td>
                            </tr>
                          </tfoot>
                        </table>
                      );
                    })()}
                  </div>
                ) : (
                <div
                  ref={printAllPersonnelRef}
                  className="doodle-border"
                  style={{
                    width: '1080px',
                    padding: '24px',
                    backgroundColor: '#e0f7fa',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px dashed var(--crayon-dark)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.8rem' }}>👥 備料員盤點情況 (所有人員)</h3>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--crayon-dark)' }}>
                      查詢期間：{selectedYear}年{selectedMonthNum}月 ｜ 盤點類型：{personnelTicketType || '全部'} ｜ 列印日期：{new Date().toLocaleDateString('zh-TW')}
                    </div>
                  </div>

                  {personnelStats.length > 0 && (
                    <>
                      <div className="doodle-border" style={{
                        backgroundColor: 'var(--crayon-yellow)', padding: '15px 20px',
                        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                        flexWrap: 'wrap', gap: '15px', border: '3px solid var(--crayon-dark)'
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                          🌟 全員總計{isAllDoingTab ? ' (盤點中)' : isAllIncompleteTab ? ' (未完成)' : ''}
                        </div>
                        {(isAllDoingTab || isAllIncompleteTab) ? (
                          <>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>{isAllIncompleteTab ? '未完成總單數' : '盤點中總單數'}</div>
                              <div style={{ fontSize: '2rem', color: 'var(--crayon-red)', fontWeight: 'bold' }}>{personnelDoingTotals.totalCount} 件</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>{isAllIncompleteTab ? '未完成總項目數' : '盤點中總項目數'}</div>
                              <div style={{ fontSize: '2rem', color: 'var(--crayon-orange)', fontWeight: 'bold' }}>{personnelDoingTotals.totalItems} 項</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>夾鉗 ({isAllIncompleteTab ? '未完成' : '盤點中'})</div>
                              <div style={{ fontSize: '1.7rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>{personnelDoingTotals.clampCount} 件 / {personnelDoingTotals.clampItems} 項</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>TKW ({isAllIncompleteTab ? '未完成' : '盤點中'})</div>
                              <div style={{ fontSize: '1.7rem', color: 'var(--crayon-purple)', fontWeight: 'bold' }}>{personnelDoingTotals.tkwCount} 件 / {personnelDoingTotals.tkwItems} 項</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '1rem', color: '#555', fontWeight: 'bold' }}>本月派送 ({isAllIncompleteTab ? '未完成' : '盤點中'})</div>
                              <div style={{ fontSize: '1.7rem', color: '#2e7d32', fontWeight: 'bold' }}>{personnelDoingTotals.monthDispatchCount} 件 / {personnelDoingTotals.monthDispatchItems} 項</div>
                            </div>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>

                      {/* 每位盤點人員的當週盤點單完成數量 */}
                      <div className="doodle-border" style={{
                        backgroundColor: '#e8f5e9', padding: '12px 20px',
                        border: '3px solid var(--crayon-dark)',
                        display: 'flex', flexDirection: 'column', gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '6px' }}>
                          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>
                            📅 每位盤點人員的當週盤點單完成數量
                            <span style={{ fontSize: '0.95rem', color: '#555', marginLeft: '8px' }}>
                              ({weeklyCompletedCalendarData.days[0]?.dateStr} ~ {weeklyCompletedCalendarData.days[4]?.dateStr})
                            </span>
                          </div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#2e7d32', backgroundColor: 'white', padding: '3px 12px', borderRadius: '12px', border: '2px solid var(--crayon-dark)' }}>
                            當週合計：{weeklyCompletedCalendarData.totalWeeklyCount} 件 / {weeklyCompletedCalendarData.totalWeeklyItems} 項
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-around' }}>
                          {personnelWeeklyCompletedList
                            .filter(pw => !excludeZeroPersonnel || pw.count > 0 || pw.itemCount > 0)
                            .map(pw => (
                            <div key={pw.id} style={{
                              backgroundColor: 'white', padding: '8px 16px', borderRadius: '12px',
                              border: '2px solid var(--crayon-dark)', display: 'flex', alignItems: 'center',
                              gap: '10px', boxShadow: '2px 2px 0px rgba(0,0,0,0.15)'
                            }}>
                              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>👤 {pw.name}</span>
                              <span style={{
                                backgroundColor: pw.count > 0 ? 'var(--crayon-yellow)' : '#eee',
                                color: 'var(--crayon-dark)', padding: '4px 10px', borderRadius: '12px',
                                fontWeight: 'bold', fontSize: '1.05rem', border: '2px dashed var(--crayon-dark)'
                              }}>
                                {pw.count} 件 / {pw.itemCount} 項
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', alignItems: 'start' }}>
                    {personnelStats.map(p => {
                      const tab = activeTab[p.id] || 'stats';
                      const typeFilter = cardTicketType[p.id] || '';
                      const taskFilter = cardTaskFilter[p.id] || '';
                      const targetTickets = tab === 'doing' ? p.doingTickets : p.incompleteTickets;
                      let list = typeFilter ? targetTickets.filter((t: InventoryTicket) => t.ticketType === typeFilter) : targetTickets;
                      if (taskFilter) {
                        list = list.filter((t: InventoryTicket) => t.taskId === taskFilter);
                      }
                      if (excludeZeroPersonnel) {
                        const isZero = tab === 'stats'
                          ? (p.monthDispatch === 0 && p.monthCompleted === 0 && (p.monthCompletedItems || 0) === 0)
                          : list.length === 0;
                        if (isZero) return null;
                      }
                      return renderPrintablePersonCard(p, tab, list, taskFilter, typeFilter);
                    })}
                  </div>
                </div>
                )}
              </div>
            )}

            {printingCard && (
              <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
                {renderPrintablePersonCard(
                  printingCard.person,
                  printingCard.tab,
                  printingCard.ticketsList,
                  printingCard.taskFilterId,
                  printingCard.ticketTypeFilter,
                  { width: '500px' },
                  printCardRef
                )}
              </div>
            )}
          </>
        );
      })()}

      </div>
  );
}
