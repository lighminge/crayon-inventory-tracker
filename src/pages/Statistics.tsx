import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel, Workflow, InventoryTask } from '../types';
import { getTickets, getPersonnel, getWorkflows, getTasks, getHolidays } from '../services/api';
import { calculateBusinessDays } from '../utils/dateUtils';
import type { HolidaySetting } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line, ComposedChart, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import CrayonDatePicker from '../components/CrayonDatePicker';
import ExpeditingReport from '../components/ExpeditingReport';

export default function Statistics() {
  const [mainTab, setMainTab] = useState<'overview' | 'expediting'>('overview');
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tasks, setTasks] = useState<InventoryTask[]>([]);
  const [holidays, setHolidays] = useState<HolidaySetting[]>([]);


  const handleExportAllExcel = () => {
    const wb = XLSX.utils.book_new();
    statsByPerson.forEach(stat => {
      if (stat.pTickets.length === 0) return;
      const exportData: any[] = stat.pTickets.map((t: any, i: number) => {
        const start = getFirstStageDate(t);
        const processingDays = (t.closeDate && start) ? calculateBusinessDays(start, t.closeDate, holidays) : null;
        return {
          '序號': i + 1,
          '單號': t.id,
          '任務': t.taskId ? (tasks.find(tsk => tsk.id === t.taskId)?.name || '未知任務') : '無任務',
          '盤點類型': t.ticketType,
          '狀態': t.closeDate ? '已結案' : '處理中',
          '項目數': t.itemCount || 0,
          '派送日期': t.dispatchDate ? new Date(t.dispatchDate).toLocaleDateString('zh-TW') : '-',
          '結案日期': t.closeDate ? new Date(t.closeDate).toLocaleDateString('zh-TW') : '-',
          '處理天數': processingDays !== null ? processingDays : '-'
        };
      });
      
      const totalTickets = exportData.length;
      const totalItems = exportData.reduce((sum: number, row: any) => sum + (row['項目數'] || 0), 0);
      const taskCount = exportData.filter((row: any) => row['任務'] !== '無任務').length;
      const closedWithDays = exportData.filter((row: any) => row['處理天數'] !== '-');
      const totalDays = closedWithDays.reduce((sum: number, row: any) => sum + row['處理天數'], 0);
      const avgDaysStr = closedWithDays.length > 0 ? `平均 ${(totalDays / closedWithDays.length).toFixed(1)} 天` : '-';
      
      exportData.push({
        '序號': '', '單號': '總計', '任務': `共 ${taskCount} 筆`, '盤點類型': '', '狀態': `共 ${totalTickets} 單`, '項目數': `共 ${totalItems} 項`, '派送日期': '', '結案日期': '', '處理天數': avgDaysStr
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, stat.name.substring(0, 31));
    });
    
    if (wb.SheetNames.length === 0) {
      alert('無盤點數據可匯出');
      return;
    }
    
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    XLSX.writeFile(wb, `全部人員_盤點數據_${dateStr}.xlsx`);
  };

  const handleExportAllImage = async () => {
    const el = document.getElementById('all-persons-container');
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 1.5 });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `全部人員_統計數據.png`;
    a.click();
  };

  const handleExportPersonExcel = (stat: any) => {
    const exportData: any[] = stat.pTickets.map((t: any, i: number) => {
        const start = getFirstStageDate(t);
        const processingDays = (t.closeDate && start) ? calculateBusinessDays(start, t.closeDate, holidays) : null;
        return {
          '序號': i + 1,
          '單號': t.id,
          '任務': t.taskId ? (tasks.find(tsk => tsk.id === t.taskId)?.name || '未知任務') : '無任務',
          '盤點類型': t.ticketType,
          '狀態': t.closeDate ? '已結案' : '處理中',
          '項目數': t.itemCount || 0,
          '派送日期': t.dispatchDate ? new Date(t.dispatchDate).toLocaleDateString('zh-TW') : '-',
          '結案日期': t.closeDate ? new Date(t.closeDate).toLocaleDateString('zh-TW') : '-',
          '處理天數': processingDays !== null ? processingDays : '-'
        };
      });
      
      const totalTickets = exportData.length;
      const totalItems = exportData.reduce((sum: number, row: any) => sum + (row['項目數'] || 0), 0);
      const taskCount = exportData.filter((row: any) => row['任務'] !== '無任務').length;
      const closedWithDays = exportData.filter((row: any) => row['處理天數'] !== '-');
      const totalDays = closedWithDays.reduce((sum: number, row: any) => sum + row['處理天數'], 0);
      const avgDaysStr = closedWithDays.length > 0 ? `平均 ${(totalDays / closedWithDays.length).toFixed(1)} 天` : '-';
      
      exportData.push({
        '序號': '', '單號': '總計', '任務': `共 ${taskCount} 筆`, '盤點類型': '', '狀態': `共 ${totalTickets} 單`, '項目數': `共 ${totalItems} 項`, '派送日期': '', '結案日期': '', '處理天數': avgDaysStr
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${stat.name}盤點數據`);
    
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    XLSX.writeFile(wb, `${stat.name}_盤點數據_${dateStr}.xlsx`);
  };

  const handleExportPersonImage = async (statId: string, statName: string) => {
    const el = document.getElementById(`person-card-${statId}`);
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${statName}_統計數據.png`;
    a.click();
  };
  
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

  // Filter Enable state
  const [enableDateFilter, setEnableDateFilter] = useState(false);
  const [enableTicketFilter, setEnableTicketFilter] = useState(false);
  const [enableTaskFilter, setEnableTaskFilter] = useState(false);
  const [enableTypeFilter, setEnableTypeFilter] = useState(false);
  const [enableDaysFilter, setEnableDaysFilter] = useState(false);

  // Multi-select state
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDaysFilter, setSelectedDaysFilter] = useState('0');

  // Chart configuration state
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line' | 'composed'>('bar');
  const [chartMetric, setChartMetric] = useState<'total' | 'completionRate' | 'avgDays'>('total');
  
  // Person Chart Tab state
  const [personChartTab, setPersonChartTab] = useState<Record<string, 'stats' | 'chart'>>({});
  const [personChartType, setPersonChartType] = useState<Record<string, 'bar' | 'line'>>({});
  const [personTicketType, setPersonTicketType] = useState<Record<string, string>>({});

  // Local task list filter & pagination
  const [taskFilterType, setTaskFilterType] = useState('');
  const [taskPage, setTaskPage] = useState(1);
  
  // Year Filter
  const [globalYear, setGlobalYear] = useState<number | ''>(new Date().getFullYear());
  const [categoryFilter, setCategoryFilter] = useState<'一般' | '追加'>('一般');
  const [additionalTypeFilter, setAdditionalTypeFilter] = useState<'全部' | '領料單' | '低點表'>('全部');
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({length: 5}, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, pData, wData, tasksData, hData] = await Promise.all([getTickets(), getPersonnel(), getWorkflows(), getTasks(), getHolidays()]);
      setTickets(tData);
      setPersonnel(pData);
      setWorkflows(wData.sort((a, b) => a.order - b.order));
      setTasks(tasksData);
      setHolidays(hData);
    } catch (e) {
      console.error(e);
      alert('讀取資料失敗');
    }
  };

  const getFirstStageDate = (t: InventoryTicket) => {
    if (t.stageDates && Object.keys(t.stageDates).length > 0) {
      return Math.min(...Object.values(t.stageDates));
    }
    return t.dispatchDate;
  };

  // Filter tickets based on Date and ID ranges
  const filteredTickets = useMemo(() => {
    let baseTickets = tickets.filter(t => categoryFilter === '追加' ? t.isAdditional : !t.isAdditional);
    if (categoryFilter === '追加' && additionalTypeFilter !== '全部') {
      baseTickets = baseTickets.filter(t => t.subType === additionalTypeFilter);
    }
    const startMs = startDate ? new Date(startDate).getTime() : 0;
    const endMs = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;

    return baseTickets.filter(t => {
      // Global Year Filter
      if (globalYear !== '') {
        const d = t.dispatchDate ? new Date(t.dispatchDate) : null;
        if (!d || d.getFullYear() !== globalYear) return false;
      }

      // Date filter
      if (enableDateFilter) {
        if (!t.dispatchDate) return false;
        if (t.dispatchDate < startMs || t.dispatchDate > endMs) return false;
      }

      // Ticket ID filter (string comparison)
      if (enableTicketFilter) {
        if (startTicketId && t.id.localeCompare(startTicketId) < 0) return false;
        if (endTicketId && t.id.localeCompare(endTicketId) > 0) return false;
      }

      // Task filter
      if (enableTaskFilter && selectedTaskIds.length > 0) {
        if (!t.taskId || !selectedTaskIds.includes(t.taskId)) return false;
      }

      // Type filter
      if (enableTypeFilter && selectedTypes.length > 0) {
        if (!t.ticketType || !selectedTypes.includes(t.ticketType)) return false;
      }

      // Days filter
      if (enableDaysFilter && selectedDaysFilter) {
        if (!t.closeDate) return false;
        const start = getFirstStageDate(t);
        if (!start) return false;
        const days = calculateBusinessDays(start, t.closeDate, holidays);
        
        if (selectedDaysFilter === '7+') {
          if (days < 7) return false;
        } else {
          if (days !== parseInt(selectedDaysFilter)) return false;
        }
      }

      return true;
    });
  }, [tickets, startDate, endDate, startTicketId, endTicketId, selectedTaskIds, selectedTypes, selectedDaysFilter, enableDateFilter, enableTicketFilter, enableTaskFilter, enableTypeFilter, enableDaysFilter, holidays, globalYear, categoryFilter, additionalTypeFilter]);

  // Derive tasks to show in the "依盤點任務" list
  const filteredTasksList = useMemo(() => {
    let list = tasks;
    if (enableTypeFilter && selectedTypes.length > 0) {
      // 1. 如果有勾選"依盤點類型"，只能顯示該類型的任務
      list = list.filter(t => selectedTypes.includes(t.ticketType));
    } else if (taskFilterType) {
      // 2. 否則，依照本地下拉選單過濾
      list = list.filter(t => t.ticketType === taskFilterType);
    }
    return list;
  }, [tasks, enableTypeFilter, selectedTypes, taskFilterType]);

  const totalTaskPages = Math.ceil(filteredTasksList.length / 5);
  const paginatedTasks = filteredTasksList.slice((taskPage - 1) * 5, taskPage * 5);
  
  // Reset page if filtered list changes
  useEffect(() => {
    setTaskPage(1);
  }, [filteredTasksList]);

  const statsByPerson = useMemo(() => {
    return personnel.map(p => {
      const pTickets = filteredTickets.filter(t => t.assigneeId === p.id);
      const total = pTickets.length;
      const closed = pTickets.filter(t => t.closeDate).length;
      const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);
      
      const closedWithDays = pTickets.filter(t => t.closeDate && getFirstStageDate(t));
      const avgDays = closedWithDays.length === 0 ? 0 : 
        Number((closedWithDays.reduce((sum, t) => sum + calculateBusinessDays(getFirstStageDate(t)!, t.closeDate!, holidays), 0) / closedWithDays.length).toFixed(2));
      const totalItems = pTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      const closedItems = pTickets.filter(t => t.closeDate).reduce((sum, t) => sum + (t.itemCount || 0), 0);
      const itemCompletionRate = totalItems === 0 ? 0 : Math.round((closedItems / totalItems) * 100);
        
      return {
        ...p,
        total,
        closed,
        completionRate,
        avgDays,
        totalItems,
        closedItems,
        itemCompletionRate,
        pTickets
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredTickets, personnel, holidays]);

  const globalStats = useMemo(() => {
    const total = statsByPerson.reduce((sum, p) => sum + p.total, 0);
    const closed = statsByPerson.reduce((sum, p) => sum + p.closed, 0);
    const completionRate = total === 0 ? 0 : Math.round((closed / total) * 100);
    
    const globalClosedWithDays = filteredTickets.filter(t => t.closeDate && getFirstStageDate(t));
    const avgDays = globalClosedWithDays.length === 0 ? 0 : 
      Number((globalClosedWithDays.reduce((sum, t) => sum + calculateBusinessDays(getFirstStageDate(t)!, t.closeDate!, holidays), 0) / globalClosedWithDays.length).toFixed(2));
      
    const totalItems = filteredTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
    const closedItems = filteredTickets.filter(t => t.closeDate).reduce((sum, t) => sum + (t.itemCount || 0), 0);
    const itemCompletionRate = totalItems === 0 ? 0 : Math.round((closedItems / totalItems) * 100);

    return { total, closed, completionRate, avgDays, totalItems, closedItems, itemCompletionRate };
  }, [statsByPerson, filteredTickets, holidays]);

  const calculateDays = (startMs: number, endMs: number) => {
    return calculateBusinessDays(startMs, endMs, holidays);
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
        Number((stageStats[w.id].totalDays / stageStats[w.id].count).toFixed(2));
      return {
        name: w.name,
        avgDays: avg,
        count: stageStats[w.id].count
      };
    });
  }, [filteredTickets, workflows]);

  // Colors for Pie Chart
  // Colors for Pie Chart
  const COLORS = ['#E63946', '#1D3557', '#2A9D8F', '#F4A261', '#E76F51', '#264653', '#2B2D42', '#8D99AE', '#D90429', '#023047'];

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
            <XAxis dataKey="name" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 16, fontWeight: 'bold'}} />
            <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 16, fontWeight: 'bold'}} />
            <Tooltip 
              contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '2px solid var(--crayon-dark)', color: 'var(--crayon-dark)', fontWeight: 'bold', backgroundColor: '#ffffff'}}
            />
            <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--crayon-dark)'}} />
            <Bar dataKey={dataKey} name={yAxisLabel} fill="var(--crayon-blue)" radius={[5, 5, 0, 0]} barSize={50}>
              <LabelList dataKey={dataKey} position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'pie') {
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
              label={({ cx, cy, midAngle, outerRadius, name, percent }) => {
                const RADIAN = Math.PI / 180;
                const radius = outerRadius + 20;
                const mAngle = midAngle || 0;
                const x = cx + radius * Math.cos(-mAngle * RADIAN);
                const y = cy + radius * Math.sin(-mAngle * RADIAN);
                return (
                  <text x={x} y={y} fill="var(--crayon-dark)" fontWeight="bold" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                    {`${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  </text>
                );
              }}
              labelLine={{ stroke: 'var(--crayon-dark)', strokeWidth: 2 }}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--crayon-dark)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '2px solid var(--crayon-dark)', color: 'var(--crayon-dark)', fontWeight: 'bold', backgroundColor: '#ffffff'}} />
            <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--crayon-dark)'}} />
          </PieChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
            <XAxis dataKey="name" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 16, fontWeight: 'bold'}} />
            <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 16, fontWeight: 'bold'}} />
            <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '2px solid var(--crayon-dark)', color: 'var(--crayon-dark)', fontWeight: 'bold', backgroundColor: '#ffffff'}} />
            <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--crayon-dark)'}} />
            <Line type="monotone" dataKey={dataKey} name={yAxisLabel} stroke="var(--crayon-blue)" strokeWidth={4} activeDot={{ r: 8 }}>
              <LabelList dataKey={dataKey} position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
            <XAxis dataKey="name" stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 16, fontWeight: 'bold'}} />
            <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 16, fontWeight: 'bold'}} />
            <Tooltip contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '2px solid var(--crayon-dark)', color: 'var(--crayon-dark)', fontWeight: 'bold', backgroundColor: '#ffffff'}} />
            <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--crayon-dark)'}} />
            <Bar dataKey={dataKey} name={`${yAxisLabel} (直條)`} fill="var(--crayon-orange)" radius={[5, 5, 0, 0]} barSize={50}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
            <Line type="monotone" dataKey={dataKey} name={`${yAxisLabel} (折線)`} stroke="var(--crayon-blue)" strokeWidth={4} activeDot={{ r: 8 }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '15px' }}>
        <button 
          className={`doodle-button ${mainTab === 'overview' ? 'success' : ''}`}
          onClick={() => setMainTab('overview')}
        >
          📊 統計總覽
        </button>
        <button 
          className={`doodle-button ${mainTab === 'expediting' ? 'success' : ''}`}
          onClick={() => setMainTab('expediting')}
        >
          📋 稽催報表
        </button>
      </div>

      {mainTab === 'expediting' && (
        <ExpeditingReport tickets={tickets} personnel={personnel} tasks={tasks} workflows={workflows} />
      )}

      {mainTab === 'overview' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <h2 style={{ margin: 0, fontFamily: 'Caveat, cursive', fontSize: '2.5rem', color: 'var(--crayon-blue)' }}>📈 統計作業</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-dark)' }}>西元年度：</label>
                <select className="doodle-input" style={{ width: 'auto', backgroundColor: '#e8f5e9', fontSize: '1.1rem' }} value={globalYear} onChange={e => setGlobalYear(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">全部年度</option>
                  {yearOptions.map(y => <option key={y} value={y}>{y} 年</option>)}
                </select>
              </div>
            </div>
          </div>

      {/* 條件篩選 */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '30px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ margin: 0, marginBottom: '15px', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>📅 設定統計條件</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {/* 日期區間卡片 */}
          <div className="doodle-border" style={{ 
            backgroundColor: '#fff3e0', 
            padding: '15px', transform: 'rotate(-1deg)', position: 'relative', zIndex: 10,
            opacity: enableDateFilter ? 1 : 0.6
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--crayon-orange)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={enableDateFilter} onChange={e => setEnableDateFilter(e.target.checked)} style={{ transform: 'scale(1.5)', cursor: 'pointer' }} />
              📌 依日期區間
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents: enableDateFilter ? 'auto' : 'none' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>起始日期：</label>
                <CrayonDatePicker value={startDate} onChange={setStartDate} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>結束日期：</label>
                <CrayonDatePicker value={endDate} onChange={setEndDate} />
              </div>
            </div>
          </div>

          {/* 單號區間卡片 */}
          <div className="doodle-border" style={{ 
            backgroundColor: '#e8f5e9', 
            padding: '15px', transform: 'rotate(1deg)',
            opacity: enableTicketFilter ? 1 : 0.6
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--crayon-green)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={enableTicketFilter} onChange={e => setEnableTicketFilter(e.target.checked)} style={{ transform: 'scale(1.5)', cursor: 'pointer' }} />
              📌 依單號區間
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', pointerEvents: enableTicketFilter ? 'auto' : 'none' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>單號起：</label>
                <input className="doodle-input" style={{ width: '100%' }} placeholder="例如: 260101" value={startTicketId} onChange={e => setStartTicketId(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>單號迄：</label>
                <input className="doodle-input" style={{ width: '100%' }} placeholder="例如: 261299" value={endTicketId} onChange={e => setEndTicketId(e.target.value)} />
              </div>
            </div>
          </div>

          {/* 盤點任務區塊 */}
          <div className="doodle-border" style={{ 
            backgroundColor: '#e1bee7', 
            padding: '15px', transform: 'rotate(-0.5deg)',
            opacity: enableTaskFilter ? 1 : 0.6
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--crayon-purple)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={enableTaskFilter} onChange={e => setEnableTaskFilter(e.target.checked)} style={{ transform: 'scale(1.5)', cursor: 'pointer' }} />
              📌 依盤點任務
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: enableTaskFilter ? 'auto' : 'none' }}>
              
              {/* 任務過濾下拉 (若全域類型過濾未啟用，則顯示) */}
              {!(enableTypeFilter && selectedTypes.length > 0) && (
                <div style={{ marginBottom: '5px' }}>
                  <select 
                    className="doodle-input" 
                    style={{ width: '100%', padding: '2px 5px' }}
                    value={taskFilterType}
                    onChange={e => setTaskFilterType(e.target.value)}
                  >
                    <option value="">-- 過濾類型 (全部) --</option>
                    <option value="夾鉗">夾鉗</option>
                    <option value="TKW">TKW</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#555', fontWeight: 'bold' }}>
                  已選取: {selectedTaskIds.length} / {filteredTasksList.length}
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button 
                    onClick={() => setSelectedTaskIds(filteredTasksList.map(t => t.id))} 
                    style={{ padding: '2px 5px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}
                  >全選</button>
                  <button 
                    onClick={() => setSelectedTaskIds([])} 
                    style={{ padding: '2px 5px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}
                  >全取消</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px' }}>
                {paginatedTasks.length === 0 ? <div style={{ color: '#888' }}>無符合任務</div> : paginatedTasks.map(t => (
                  <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    <input 
                      type="checkbox" 
                      style={{ transform: 'scale(1.2)' }}
                      checked={selectedTaskIds.includes(t.id)} 
                      onChange={e => {
                        if (e.target.checked) setSelectedTaskIds(prev => [...prev, t.id]);
                        else setSelectedTaskIds(prev => prev.filter(id => id !== t.id));
                      }} 
                    />
                    {t.name} <span style={{ fontSize: '0.8rem', color: '#555' }}>({t.ticketType})</span>
                  </label>
                ))}
              </div>

              {/* 分頁控制 */}
              {totalTaskPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', fontSize: '0.9rem' }}>
                  <button 
                    disabled={taskPage === 1}
                    onClick={() => setTaskPage(prev => Math.max(1, prev - 1))}
                    style={{ cursor: taskPage === 1 ? 'not-allowed' : 'pointer', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: taskPage === 1 ? '#eee' : 'white' }}
                  >◀</button>
                  <span style={{ fontWeight: 'bold' }}>{taskPage} / {totalTaskPages}</span>
                  <button 
                    disabled={taskPage === totalTaskPages}
                    onClick={() => setTaskPage(prev => Math.min(totalTaskPages, prev + 1))}
                    style={{ cursor: taskPage === totalTaskPages ? 'not-allowed' : 'pointer', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: taskPage === totalTaskPages ? '#eee' : 'white' }}
                  >▶</button>
                </div>
              )}
            </div>
          </div>

          {/* 盤點種類卡片 */}
          <div className="doodle-border" style={{ 
            backgroundColor: '#e3f2fd', 
            padding: '15px', transform: 'rotate(-1deg)'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--crayon-blue)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📌 盤點種類
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <select className="doodle-input" style={{ width: '100%', backgroundColor: 'white' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as '一般' | '追加')}>
                <option value="一般">一般</option>
                <option value="追加">追加</option>
              </select>
              {categoryFilter === '追加' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>追加單據種類：</label>
                  <select className="doodle-input" style={{ width: '100%', backgroundColor: 'white' }} value={additionalTypeFilter} onChange={e => setAdditionalTypeFilter(e.target.value as any)}>
                    <option value="全部">全部</option>
                    <option value="領料單">領料單</option>
                    <option value="低點表">低點表</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 盤點類型區塊 */}
          <div className="doodle-border" style={{ 
            backgroundColor: '#ffccbc', 
            padding: '15px', transform: 'rotate(0.5deg)',
            opacity: enableTypeFilter ? 1 : 0.6
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#d84315', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={enableTypeFilter} onChange={e => setEnableTypeFilter(e.target.checked)} style={{ transform: 'scale(1.5)', cursor: 'pointer' }} />
              📌 依盤點類型
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: enableTypeFilter ? 'auto' : 'none' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input 
                  type="checkbox" 
                  style={{ transform: 'scale(1.2)' }}
                  checked={selectedTypes.includes('夾鉗')} 
                  onChange={e => {
                    if (e.target.checked) setSelectedTypes(prev => [...prev, '夾鉗']);
                    else setSelectedTypes(prev => prev.filter(v => v !== '夾鉗'));
                  }} 
                />
                夾鉗
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input 
                  type="checkbox" 
                  style={{ transform: 'scale(1.2)' }}
                  checked={selectedTypes.includes('TKW')} 
                  onChange={e => {
                    if (e.target.checked) setSelectedTypes(prev => [...prev, 'TKW']);
                    else setSelectedTypes(prev => prev.filter(v => v !== 'TKW'));
                  }} 
                />
                TKW
              </label>
            </div>
          </div>

          {/* 完成日數區塊 */}
          <div className="doodle-border" style={{ 
            backgroundColor: '#e0f7fa', 
            padding: '15px', transform: 'rotate(-0.5deg)',
            opacity: enableDaysFilter ? 1 : 0.6
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#00838f', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={enableDaysFilter} onChange={e => setEnableDaysFilter(e.target.checked)} style={{ transform: 'scale(1.5)', cursor: 'pointer' }} />
              📌 依盤點單完成日數
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: enableDaysFilter ? 'auto' : 'none' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>選擇完成日數：</label>
              <select 
                className="doodle-input" 
                style={{ width: '100%', padding: '5px' }}
                value={selectedDaysFilter}
                onChange={e => setSelectedDaysFilter(e.target.value)}
              >
                <option value="0">0 天</option>
                <option value="1">1 天</option>
                <option value="2">2 天</option>
                <option value="3">3 天</option>
                <option value="4">4 天</option>
                <option value="5">5 天</option>
                <option value="6">6 天</option>
                <option value="7+">7 天以上</option>
              </select>
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
                <XAxis dataKey="name" stroke="var(--crayon-dark)" interval={0} tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
                <YAxis stroke="var(--crayon-dark)" tick={{fontFamily: 'Caveat, cursive', fontSize: 18, fontWeight: 'bold'}} />
                <Tooltip 
                  contentStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', borderRadius: '10px', border: '3px solid var(--crayon-dark)', backgroundColor: '#ffffff', color: 'var(--crayon-dark)', fontWeight: 'bold', boxShadow: '3px 3px 0px rgba(0,0,0,0.2)'}}
                  formatter={(value) => [`${value} 天`, '平均天數']}
                />
                <Legend wrapperStyle={{fontFamily: 'Caveat, cursive', fontSize: '1.2rem', fontWeight: 'bold'}} />
                <Bar dataKey="avgDays" name="平均處理天數 (天)" fill="var(--crayon-orange)" radius={[5, 5, 0, 0]} barSize={50}>
                  <LabelList dataKey="avgDays" position="top" style={{ fontSize: '16px', fontWeight: 'bold', fill: 'var(--crayon-dark)' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 全局統計 (全部人員) */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '30px', backgroundColor: 'var(--crayon-yellow)' }}>
        <h3 style={{ marginTop: 0, textAlign: 'center', fontSize: '1.8rem', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>🌟 全部人員總計</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', textAlign: 'center', marginTop: '20px' }}>
          <div className="doodle-border" style={{ backgroundColor: 'white', padding: '15px', transform: 'rotate(-1deg)' }}>
            <div style={{ fontSize: '1.1rem', color: '#555', fontWeight: 'bold' }}>總盤點數</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-dark)' }}>{globalStats.total}</div>
            <div style={{ fontSize: '1.1rem', color: '#555', fontWeight: 'bold', marginTop: '10px' }}>已完成單數</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-blue)' }}>{globalStats.closed}</div>
          </div>
          <div className="doodle-border" style={{ backgroundColor: 'white', padding: '15px', transform: 'rotate(1deg)' }}>
            <div style={{ fontSize: '1.1rem', color: '#555', fontWeight: 'bold' }}>總項目數</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-orange)' }}>{globalStats.totalItems}</div>
            <div style={{ fontSize: '1.1rem', color: '#555', fontWeight: 'bold', marginTop: '10px' }}>已完成項目</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-green)' }}>{globalStats.closedItems}</div>
          </div>
          <div className="doodle-border" style={{ backgroundColor: 'white', padding: '15px', transform: 'rotate(1deg)' }}>
            <div style={{ fontSize: '1.1rem', color: '#555', fontWeight: 'bold' }}>平均完成率</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-green)' }}>{globalStats.completionRate}%</div>
            <div style={{ fontSize: '1.1rem', color: '#555', fontWeight: 'bold', marginTop: '10px' }}>平均處理天數</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>{globalStats.avgDays.toFixed(2)} <span style={{fontSize:'1rem'}}>天</span></div>
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
                <option value="line">折線圖</option>
                <option value="composed">直條加折線圖</option>
              </select>
            </div>
          </div>
        </div>
        
        <div style={{ padding: '10px', backgroundColor: '#fafafa', borderRadius: '10px', border: '2px solid #ddd' }}>
          {renderChart()}
        </div>
      </div>

      {/* 個人詳細數據列表 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '40px', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h3 style={{ margin: 0 }}>👥 個人詳細數據</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="doodle-button" style={{ padding: '6px 15px', fontSize: '1rem', backgroundColor: 'var(--crayon-blue)', color: 'white' }} onClick={handleExportAllExcel}>📥 匯出全部 Excel</button>
          <button className="doodle-button" style={{ padding: '6px 15px', fontSize: '1rem', backgroundColor: 'var(--crayon-purple)', color: 'white' }} onClick={handleExportAllImage}>🖼️ 匯出全部圖檔</button>
        </div>
      </div>
      <div id="all-persons-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', padding: '10px', backgroundColor: '#fff', borderRadius: '15px' }}>
        {statsByPerson.map(stat => {
          const tab = personChartTab[stat.id] || 'stats';
          const type = personChartType[stat.id] || 'bar';
          const tType = personTicketType[stat.id] || '';
          
          let chartData: any[] = [];
          if (tab === 'chart') {
            const filteredForChart = tType ? stat.pTickets.filter(t => t.ticketType === tType) : stat.pTickets;
            const dateStats: Record<string, { tickets: number; items: number }> = {};
            
            filteredForChart.forEach(t => {
              if (!t.dispatchDate) return;
              const d = new Date(t.dispatchDate);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              
              if (!dateStats[dateStr]) {
                dateStats[dateStr] = { tickets: 0, items: 0 };
              }
              dateStats[dateStr].tickets += 1;
              dateStats[dateStr].items += (t.itemCount || 0);
            });
            
            const sortedDates = Object.keys(dateStats).sort();
            chartData = sortedDates.map(dateStr => ({
              name: dateStr,
              tickets: dateStats[dateStr].tickets,
              items: dateStats[dateStr].items
            }));
          }

          return (
          <div id={`person-card-${stat.id}`} key={stat.id} className="doodle-border" style={{ padding: '20px', backgroundColor: 'var(--crayon-paper)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>
                {stat.name} <span style={{ fontSize: '0.9rem', color: '#666' }}>({stat.title})</span>
              </h3>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button 
                  style={{ 
                    padding: '5px 10px', borderRadius: '5px', border: '2px solid var(--crayon-dark)', 
                    backgroundColor: tab === 'stats' ? 'var(--crayon-blue)' : '#fff',
                    color: tab === 'stats' ? '#fff' : '#333',
                    cursor: 'pointer', fontWeight: 'bold'
                  }}
                  onClick={() => setPersonChartTab(prev => ({...prev, [stat.id]: 'stats'}))}
                >數據</button>
                <button 
                  style={{ 
                    padding: '5px 10px', borderRadius: '5px', border: '2px solid var(--crayon-dark)', 
                    backgroundColor: tab === 'chart' ? 'var(--crayon-blue)' : '#fff',
                    color: tab === 'chart' ? '#fff' : '#333',
                    cursor: 'pointer', fontWeight: 'bold'
                  }}
                  onClick={() => setPersonChartTab(prev => ({...prev, [stat.id]: 'chart'}))}
                >圖表</button>
              </div>
            </div>
            
            {tab === 'stats' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                  <div style={{ textAlign: 'center', backgroundColor: '#f0f8ff', padding: '10px', borderRadius: '10px', border: '1px solid #ccc' }}>
                    <div style={{ fontSize: '0.8rem', color: '#555' }}>總單數</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stat.total}</div>
                    <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '5px' }}>已完成單數</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--crayon-blue)' }}>{stat.closed}</div>
                  </div>
                  
                  <div style={{ textAlign: 'center', backgroundColor: '#fff9c4', padding: '10px', borderRadius: '10px', border: '1px solid #ccc' }}>
                    <div style={{ fontSize: '0.8rem', color: '#555' }}>總項目數</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--crayon-orange)' }}>{stat.totalItems}</div>
                    <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '5px' }}>已完成項目數</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--crayon-green)' }}>{stat.closedItems}</div>
                  </div>
                  
                  <div style={{ textAlign: 'center', backgroundColor: '#fff0f5', padding: '10px', borderRadius: '10px', border: '1px solid #ccc' }}>
                    <div style={{ fontSize: '0.8rem', color: '#555' }}>平均天數</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>{stat.avgDays.toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.9rem' }}>單據完成率 ({stat.closed}/{stat.total})</span>
                    <span style={{ fontWeight: 'bold' }}>{stat.completionRate}%</span>
                  </div>
                  <div style={{ width: '100%', height: '12px', backgroundColor: '#eee', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ccc' }}>
                    <div style={{ width: `${stat.completionRate}%`, height: '100%', backgroundColor: stat.completionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-blue)' }}></div>
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.9rem' }}>項目完成率 ({stat.closedItems}/{stat.totalItems})</span>
                    <span style={{ fontWeight: 'bold' }}>{stat.itemCompletionRate}%</span>
                  </div>
                  <div style={{ width: '100%', height: '12px', backgroundColor: '#eee', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ccc' }}>
                    <div style={{ width: `${stat.itemCompletionRate}%`, height: '100%', backgroundColor: stat.itemCompletionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-blue)' }}></div>
                  </div>
                </div>
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button className="doodle-button" style={{ padding: '6px 15px', fontSize: '1rem', backgroundColor: 'var(--crayon-blue)', color: 'white' }} onClick={() => handleExportPersonExcel(stat)}>📥 匯出 Excel 檔</button>
                  <button className="doodle-button" style={{ padding: '6px 15px', fontSize: '1rem', backgroundColor: 'var(--crayon-purple)', color: 'white' }} onClick={() => handleExportPersonImage(stat.id, stat.name)}>🖼️ 匯出圖檔</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <select 
                    style={{ padding: '2px 5px', borderRadius: '5px', border: '2px solid var(--crayon-dark)', outline: 'none' }}
                    value={type} onChange={e => setPersonChartType(prev => ({...prev, [stat.id]: e.target.value as any}))}
                  >
                    <option value="bar">長條圖</option>
                    <option value="line">折線圖</option>
                    <option value="composed">長條+折線</option>
                  </select>
                  <select 
                    style={{ padding: '2px 5px', borderRadius: '5px', border: '2px solid var(--crayon-dark)', outline: 'none' }}
                    value={tType} onChange={e => setPersonTicketType(prev => ({...prev, [stat.id]: e.target.value}))}
                  >
                    <option value="">全部類型</option>
                    <option value="夾鉗">夾鉗</option>
                    <option value="TKW">TKW</option>
                  </select>
                </div>
                <div style={{ height: '180px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {type === 'bar' ? (
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} height={40} angle={-35} textAnchor="end" />
                        <YAxis tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <Tooltip contentStyle={{fontWeight: 'bold', color: 'var(--crayon-dark)'}} />
                        <Legend wrapperStyle={{fontSize: '0.9rem', fontWeight: 'bold'}} />
                        <Bar dataKey="tickets" name="盤點單數量" fill="var(--crayon-orange)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="items" name="盤點項目數量" fill="var(--crayon-blue)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : type === 'line' ? (
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} height={40} angle={-35} textAnchor="end" />
                        <YAxis tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <Tooltip contentStyle={{fontWeight: 'bold', color: 'var(--crayon-dark)'}} />
                        <Legend wrapperStyle={{fontSize: '0.9rem', fontWeight: 'bold'}} />
                        <Line type="monotone" dataKey="tickets" name="盤點單數量" stroke="var(--crayon-orange)" strokeWidth={3} dot={{r: 4}} />
                        <Line type="monotone" dataKey="items" name="盤點項目數量" stroke="var(--crayon-blue)" strokeWidth={3} dot={{r: 4}} />
                      </LineChart>
                    ) : (
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} height={40} angle={-35} textAnchor="end" />
                        <YAxis yAxisId="left" tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <Tooltip contentStyle={{fontWeight: 'bold', color: 'var(--crayon-dark)'}} />
                        <Legend wrapperStyle={{fontSize: '0.9rem', fontWeight: 'bold'}} />
                        <Bar yAxisId="left" dataKey="tickets" name="盤點單數量 (長條)" fill="var(--crayon-orange)" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="items" name="盤點項目數量 (折線)" stroke="var(--crayon-blue)" strokeWidth={3} dot={{r: 4}} />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
          );
        })}
        {statsByPerson.length === 0 && <p>查無人員資料。</p>}
      </div>
        </div>
      )}
    </div>
  );
}
