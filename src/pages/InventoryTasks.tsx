import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import type { InventoryTask, InventoryTicket, Personnel, HolidaySetting } from '../types';
import CrayonDatePicker from '../components/CrayonDatePicker';
import { getTasks, addTask, updateTask, deleteTask, getTickets, getPersonnel, getHolidays } from '../services/api';
import { calculateBusinessDays } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';

const formatDateLocal = (timestamp: number) => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function InventoryTasks() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('tasks', 'edit');
  const [tasks, setTasks] = useState<InventoryTask[]>([]);
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [holidays, setHolidays] = useState<HolidaySetting[]>([]);
  
  // Tab and Pagination States for Task Cards
  const [activeTab, setActiveTab] = useState<Record<string, 'info' | 'status' | 'report'>>({});
  const [statusPage, setStatusPage] = useState<Record<string, number>>({});
  const [itemsPerPage, setItemsPerPage] = useState<Record<string, number>>({});
  const [ticketStatusFilter, setTicketStatusFilter] = useState<Record<string, 'all' | 'incomplete' | 'completed'>>({});
  
  const [chartTypes, setChartTypes] = useState<Record<string, 'bar' | 'line' | 'pie' | 'composed'>>({});
  const [pieMetrics, setPieMetrics] = useState<Record<string, 'items' | 'completionRate' | 'tickets'>>({});
  const [reportViewMode, setReportViewMode] = useState<Record<string, 'text' | 'chart'>>({});
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<InventoryTask | null>(null);
  
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTicketType, setFilterTicketType] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [tasksPerPage, setTasksPerPage] = useState(4);
  
  const today = formatDateLocal(new Date().getTime());
  const [formData, setFormData] = useState<Omit<InventoryTask, 'id'>>({
    name: '',
    startDate: new Date(today).getTime(),
    endDate: new Date(today).getTime(),
    ticketType: '夾鉗',
    totalItemCount: 100
  });

  const [startDateStr, setStartDateStr] = useState(today);
  const [endDateStr, setEndDateStr] = useState(today);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksData, ticketsData, personnelData, holidaysData] = await Promise.all([
          getTasks(),
          getTickets(),
          getPersonnel(),
          getHolidays()
        ]);
        setTasks(tasksData);
        setTickets(ticketsData);
        setPersonnel(personnelData);
        setHolidays(holidaysData);
      } catch (e) {
        alert('載入資料失敗');
      }
    };
    fetchData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, tkData, pData, hData] = await Promise.all([getTasks(), getTickets(), getPersonnel(), getHolidays()]);
      setTasks(tData);
      setTickets(tkData);
      setPersonnel(pData);
      setHolidays(hData);
    } catch (e) {
      console.error(e);
      alert('讀取資料失敗');
    }
  };

  const handleOpenForm = (task?: InventoryTask) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        name: task.name,
        startDate: task.startDate,
        endDate: task.endDate,
        ticketType: task.ticketType,
        totalItemCount: task.totalItemCount
      });
      setStartDateStr(formatDateLocal(task.startDate));
      setEndDateStr(formatDateLocal(task.endDate));
    } else {
      setEditingTask(null);
      setFormData({
        name: '',
        startDate: new Date(today).getTime(),
        endDate: new Date(today).getTime(),
        ticketType: '夾鉗',
        totalItemCount: 100
      });
      setStartDateStr(today);
      setEndDateStr(today);
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.totalItemCount <= 0) {
      return alert('總項目數量必須大於 0');
    }
    const finalData = {
      ...formData,
      startDate: new Date(startDateStr + 'T00:00:00').getTime(),
      endDate: new Date(endDateStr + 'T23:59:59').getTime()
    };
    
    if (finalData.startDate > finalData.endDate) {
      return alert('開始日期不可大於結束日期');
    }

    try {
      if (editingTask) {
        await updateTask(editingTask.id, finalData);
      } else {
        await addTask(finalData);
      }
      setIsFormOpen(false);
      loadData();
    } catch (error: any) {
      alert('儲存失敗：' + error.message);
    }
  };

  const confirmDelete = async () => {
    if (taskToDelete) {
      await deleteTask(taskToDelete);
      setTaskToDelete(null);
      loadData();
    }
  };

  // Calculate stats for each task
  const tasksWithStats = useMemo(() => {
    return tasks.map(task => {
      // Find all tickets linked to this task
      const allLinkedTickets = tickets.filter(t => t.taskId === task.id);
      const completedLinkedTickets = allLinkedTickets.filter(t => t.closeDate);
      
      // Sum their item counts
      const openedItemsCount = allLinkedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      const completedItems = completedLinkedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      const completedTicketsCount = completedLinkedTickets.length;
      
      const completionRate = task.totalItemCount > 0 
        ? Math.min(100, Math.round((completedItems / task.totalItemCount) * 100))
        : 0;

      const openedRate = task.totalItemCount > 0 
        ? Math.min(100, Math.round((openedItemsCount / task.totalItemCount) * 100))
        : 0;

      const isExpired = new Date().getTime() > task.endDate;
      
      // Calculate assignee stats for report
      const assigneeStats: Record<string, { name: string; tickets: number; items: number; totalDays: number }> = {};
      completedLinkedTickets.forEach(t => {
        const id = t.assigneeId || '未指定';
        if (!assigneeStats[id]) {
          const p = personnel.find(p => p.id === id);
          assigneeStats[id] = { name: p ? p.name : id, tickets: 0, items: 0, totalDays: 0 };
        }
        assigneeStats[id].tickets += 1;
        assigneeStats[id].items += (t.itemCount || 0);
        
        const startDate = (t.stageDates && Object.keys(t.stageDates).length > 0) ? Math.min(...Object.values(t.stageDates)) : t.dispatchDate;
        if (startDate && t.closeDate) {
          assigneeStats[id].totalDays += calculateBusinessDays(startDate, t.closeDate, holidays);
        }
      });
      const assigneeList = Object.values(assigneeStats).map(a => ({
        ...a,
        avgDays: a.tickets > 0 ? (a.totalDays / a.tickets) : 0,
        completionRate: task.totalItemCount > 0 ? ((a.items / task.totalItemCount) * 100) : 0
      })).sort((a, b) => b.items - a.items);

      // Calculate ticket list with assignee names for display
      const mappedTickets = allLinkedTickets.map(t => {
        const p = personnel.find(p => p.id === t.assigneeId);
        let processingDays: number | null = null;
        if (t.closeDate) {
          const startDate = (t.stageDates && Object.keys(t.stageDates).length > 0) ? Math.min(...Object.values(t.stageDates)) : t.dispatchDate;
          if (startDate) {
            processingDays = calculateBusinessDays(startDate, t.closeDate, holidays);
          }
        }
        return {
          ...t,
          assigneeName: p ? p.name : t.assigneeId || '未指定',
          processingDays
        };
      }).sort((a, b) => (b.dispatchDate || 0) - (a.dispatchDate || 0));

      // Calculate total days spent based on completed tickets
      let totalDaysSpent: number | null = null;
      if (completedLinkedTickets.length > 0) {
        const maxCloseDate = Math.max(...completedLinkedTickets.map(t => t.closeDate || 0));
        if (maxCloseDate > 0) {
          totalDaysSpent = calculateBusinessDays(task.startDate, maxCloseDate, holidays);
        }
      }

      return {
        ...task,
        openedItemsCount,
        openedRate,
        completedItems,
        completedTicketsCount,
        completionRate,
        isExpired,
        mappedTickets,
        assigneeList,
        totalDaysSpent
      };
    });
  }, [tasks, tickets, personnel, holidays]);

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const filteredTasks = useMemo(() => {
    return tasksWithStats.filter(t => {
      if (filterStatus === 'active') { if (t.isExpired) return false; }
      else if (filterStatus === 'expired') { if (!t.isExpired) return false; }
      
      if (filterTicketType !== 'all' && t.ticketType !== filterTicketType) return false;
      
      if (filterYear !== 'all') {
        const y = new Date(t.startDate).getFullYear().toString();
        if (y !== filterYear) return false;
      }

      if (filterStartDate) {
        const startMs = new Date(filterStartDate).getTime();
        if (t.startDate < startMs) return false;
      }
      
      if (filterEndDate) {
        const endMs = new Date(filterEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (t.startDate > endMs) return false;
      }
      
      return true;
    }).sort((a, b) => b.startDate - a.startDate);
  }, [tasksWithStats, filterStatus, filterTicketType, filterYear, filterStartDate, filterEndDate]);

  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * tasksPerPage, currentPage * tasksPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterTicketType, filterYear, filterStartDate, filterEndDate, tasksPerPage]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontFamily: 'Caveat, cursive', fontSize: '2.5rem', color: 'var(--crayon-blue)' }}>🎯 盤點任務管理</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>年度：</label>
            <select className="doodle-input" style={{ width: 'auto' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="all">全部</option>
              {Array.from(new Set(tasks.map(t => new Date(t.startDate).getFullYear()))).sort().reverse().map(y => (
                <option key={y} value={y.toString()}>{y} 年</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {canEdit && (
            <button className="doodle-button" onClick={() => handleOpenForm()}>＋ 新增盤點任務</button>
          )}
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)' }}>
            總任務數量：{filteredTasks.length} 筆
          </div>
        </div>
      </div>

      <div className="doodle-border" style={{ padding: '15px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', backgroundColor: '#f9f9f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>任務狀態：</label>
          <select className="doodle-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="active">未到期</option>
            <option value="expired">已到期</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>類型：</label>
          <select className="doodle-input" style={{ width: 'auto' }} value={filterTicketType} onChange={e => setFilterTicketType(e.target.value)}>
            <option value="all">全部</option>
            <option value="夾鉗">夾鉗</option>
            <option value="TKW">TKW</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>建立日期區間：</label>
          <div style={{ width: '130px' }}><CrayonDatePicker value={filterStartDate} onChange={setFilterStartDate} /></div>
          <span>~</span>
          <div style={{ width: '130px' }}><CrayonDatePicker value={filterEndDate} onChange={setFilterEndDate} /></div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '10px', border: '1px dashed var(--crayon-blue)', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>每頁顯示筆數：</label>
          <select className="doodle-input" style={{ width: 'auto', padding: '5px' }} value={tasksPerPage} onChange={e => setTasksPerPage(Number(e.target.value))}>
            {[2, 4, 6, 8, 10, 12, 16, 20].map(n => <option key={n} value={n}>{n} 筆</option>)}
          </select>
        </div>
        
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button className="doodle-button" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>上一頁</button>
            <span style={{ fontWeight: 'bold', margin: '0 10px' }}>第 {currentPage} / {totalPages} 頁</span>
            <button className="doodle-button" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>下一頁</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {paginatedTasks.map((task, index) => {
          const currentTab = activeTab[task.id] || 'info';
          const currentPage = statusPage[task.id] || 1;
          const currentItemsPerPage = itemsPerPage[task.id] || 5;

          return (
            <div key={task.id} className="doodle-border" style={{ 
              padding: '20px', 
              backgroundColor: task.isExpired ? '#f5f5f5' : 'white',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute', top: '-20px', right: '-15px',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', zIndex: 2
              }}>
                <div style={{ 
                  backgroundColor: task.completionRate === 100 ? 'var(--crayon-green)' : (task.isExpired ? 'var(--crayon-red)' : 'var(--crayon-orange)'), 
                  color: 'white', padding: '10px 20px',
                  borderRadius: '10px', transform: 'rotate(3deg)', fontSize: '1.4rem',
                  fontWeight: '900', border: '3px solid var(--crayon-dark)',
                  boxShadow: '4px 4px 0px rgba(0,0,0,0.2)', textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                }}>
                  {task.completionRate === 100 ? '已完成' : (task.isExpired ? '未完成' : '進行中')}
                </div>
                <div style={{ 
                  backgroundColor: task.isExpired ? '#ffebee' : '#e8f5e9', 
                  color: task.isExpired ? 'var(--crayon-red)' : 'var(--crayon-green)', 
                  padding: '5px 15px',
                  borderRadius: '10px', fontSize: '1.2rem',
                  fontWeight: '900', border: '3px solid var(--crayon-dark)'
                }}>
                  {task.isExpired ? '已到期' : '未到期'}
                </div>
              </div>
              
              <h3 style={{ margin: '20px 0 10px 0', borderBottom: '2px solid var(--crayon-dark)', paddingBottom: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ backgroundColor: 'var(--crayon-dark)', color: 'white', padding: '2px 10px', borderRadius: '15px', fontSize: '1rem' }}>#{(currentPage - 1) * tasksPerPage + index + 1}</span>
                📝 {task.name}
              </h3>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button 
                  className={`doodle-button ${currentTab === 'info' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '5px', minHeight: 'auto', backgroundColor: currentTab === 'info' ? 'var(--crayon-dark)' : 'white', color: currentTab === 'info' ? 'white' : 'var(--crayon-dark)' }}
                  onClick={() => setActiveTab(prev => ({...prev, [task.id]: 'info'}))}
                >
                  任務資訊
                </button>
                <button 
                  className={`doodle-button ${currentTab === 'status' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '5px', minHeight: 'auto', backgroundColor: currentTab === 'status' ? 'var(--crayon-dark)' : 'white', color: currentTab === 'status' ? 'white' : 'var(--crayon-dark)' }}
                  onClick={() => setActiveTab(prev => ({...prev, [task.id]: 'status'}))}
                >
                  完成狀態
                </button>
                <button 
                  className={`doodle-button ${currentTab === 'report' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '5px', minHeight: 'auto', backgroundColor: currentTab === 'report' ? 'var(--crayon-dark)' : 'white', color: currentTab === 'report' ? 'white' : 'var(--crayon-dark)' }}
                  onClick={() => setActiveTab(prev => ({...prev, [task.id]: 'report'}))}
                >
                  任務報告
                </button>
              </div>

              {currentTab === 'info' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ fontSize: '1.2rem' }}><strong>類型：</strong><span style={{ fontWeight: '900', fontSize: '1.4rem' }}>{task.ticketType}</span></div>
                    <div style={{ fontSize: '1.2rem' }}>
                      <strong>總項目：</strong><span style={{ fontWeight: '900', fontSize: '1.4rem' }}>{task.totalItemCount} 項</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '1.2rem', color: '#333', marginBottom: '15px' }}>
                    <strong>期間：</strong><br/>
                    <span style={{ fontWeight: '900', fontSize: '1.3rem' }}>{new Date(task.startDate).toLocaleDateString()} ~ {new Date(task.endDate).toLocaleDateString()}</span>
                  </div>

                  <div className="doodle-border" style={{ padding: '10px', backgroundColor: '#e3f2fd', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>已開立品項進度</span>
                      <span style={{ fontWeight: 'bold', color: task.openedRate === 100 ? 'var(--crayon-purple)' : 'var(--crayon-blue)' }}>
                        {task.openedRate}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid var(--crayon-dark)', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${task.openedRate}%`, 
                        height: '100%', 
                        backgroundColor: task.openedRate === 100 ? 'var(--crayon-purple)' : 'var(--crayon-blue)' 
                      }}></div>
                    </div>
                    <div style={{ fontSize: '0.8rem', textAlign: 'right', marginTop: '5px', color: '#555' }}>
                      目前已開立：{task.openedItemsCount} / {task.totalItemCount} 項
                    </div>
                  </div>

                  <div className="doodle-border" style={{ padding: '10px', backgroundColor: '#e8f5e9', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>完成進度</span>
                      <span style={{ fontWeight: 'bold', color: task.completionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-orange)' }}>
                        {task.completionRate}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid var(--crayon-dark)', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${task.completionRate}%`, 
                        height: '100%', 
                        backgroundColor: task.completionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-orange)' 
                      }}></div>
                    </div>
                    <div style={{ fontSize: '0.8rem', textAlign: 'right', marginTop: '5px', color: '#555' }}>
                      已完成：{task.completedItems} / {task.totalItemCount} 項
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div className="doodle-border" style={{ padding: '10px', backgroundColor: '#fff9c4', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#555', fontWeight: 'bold' }}>剩餘天數</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>
                        {task.isExpired ? 0 : Math.max(0, Math.ceil((task.endDate - Date.now()) / (1000 * 60 * 60 * 24)))} <span style={{fontSize: '1rem'}}>天</span>
                      </div>
                    </div>
                    <div className="doodle-border" style={{ padding: '10px', backgroundColor: '#e8f5e9', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#555', fontWeight: 'bold' }}>剩餘可開立數</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--crayon-orange)' }}>
                        {Math.max(0, task.totalItemCount - task.openedItemsCount)} <span style={{fontSize: '1rem'}}>項</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : currentTab === 'status' ? (() => {
                const currentFilter = ticketStatusFilter[task.id] || 'all';
                const filteredTickets = task.mappedTickets.filter((t: any) => {
                  if (currentFilter === 'completed') return t.closeDate;
                  if (currentFilter === 'incomplete') return !t.closeDate;
                  return true;
                });

                const totalFilteredTickets = filteredTickets.length;
                const totalFilteredItems = filteredTickets.reduce((sum: number, t: any) => sum + (t.itemCount || 0), 0);
                
                const totalPages = Math.ceil(filteredTickets.length / currentItemsPerPage);
                const startIndex = (currentPage - 1) * currentItemsPerPage;
                const paginatedTickets = filteredTickets.slice(startIndex, startIndex + currentItemsPerPage);

                const assigneeStats = filteredTickets.reduce((acc: Record<string, {name: string, count: number, items: number}>, t: any) => {
                  const id = t.assigneeId || 'unknown';
                  if (!acc[id]) {
                    acc[id] = { name: t.assigneeName || '未指定', count: 0, items: 0 };
                  }
                  acc[id].count += 1;
                  acc[id].items += (t.itemCount || 0);
                  return acc;
                }, {});

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', minHeight: '340px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 'bold' }}>狀態篩選：</div>
                      <select className="doodle-input" style={{ width: 'auto', padding: '2px 5px', fontSize: '0.9rem', backgroundColor: 'white' }}
                        value={currentFilter}
                        onChange={e => {
                          setTicketStatusFilter(prev => ({...prev, [task.id]: e.target.value as 'all' | 'incomplete' | 'completed'}));
                          setStatusPage(prev => ({...prev, [task.id]: 1}));
                        }}
                      >
                        <option value="all">全部</option>
                        <option value="incomplete">未完成</option>
                        <option value="completed">已完成</option>
                      </select>
                    </div>

                    <div className="doodle-border" style={{ backgroundColor: '#e3f2fd', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--crayon-blue)', marginBottom: '5px' }}>統計數量 (根據篩選)</div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ backgroundColor: 'white', padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--crayon-blue)' }}>
                          盤點單：<span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)' }}>{totalFilteredTickets}</span> 筆
                        </div>
                        <div style={{ backgroundColor: 'white', padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--crayon-orange)' }}>
                          總項目：<span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-orange)' }}>{totalFilteredItems}</span> 項
                        </div>
                      </div>
                      
                      {Object.keys(assigneeStats).length > 0 && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--crayon-blue)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#666' }}>人員統計</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                            {Object.values(assigneeStats).map((st, idx) => (
                              <div key={idx} style={{ backgroundColor: '#fff', fontSize: '0.8rem', padding: '3px 8px', borderRadius: '15px', border: '1px solid #ccc', display: 'flex', gap: '5px' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--crayon-dark)' }}>{st.name}</span>
                                <span style={{ color: 'var(--crayon-blue)' }}>{st.count}筆</span>
                                <span style={{ color: 'var(--crayon-orange)' }}>{st.items}項</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                      <span style={{ fontWeight: 'bold' }}>盤點單清單</span>
                      <select className="doodle-input" style={{ width: 'auto', padding: '2px 5px', fontSize: '0.8rem', backgroundColor: 'white' }}
                        value={currentItemsPerPage}
                        onChange={e => {
                          setItemsPerPage(prev => ({...prev, [task.id]: Number(e.target.value)}));
                          setStatusPage(prev => ({...prev, [task.id]: 1}));
                        }}
                      >
                        <option value="5">每頁 5 筆</option>
                        <option value="10">每頁 10 筆</option>
                        <option value="15">每頁 15 筆</option>
                      </select>
                    </div>

                    {filteredTickets.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#888', padding: '20px 0', flex: 1 }}>目前無符合條件的盤點單</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                          {paginatedTickets.map((t: any, tIdx: number) => {
                            const isCompleted = !!t.closeDate;
                            return (
                              <li key={tIdx} className="doodle-border" style={{ padding: '10px', backgroundColor: isCompleted ? '#f1f8e9' : '#fff3e0', display: 'flex', flexDirection: 'column', gap: '5px', border: `2px solid ${isCompleted ? 'var(--crayon-green)' : 'var(--crayon-orange)'}`, borderLeft: `8px solid ${isCompleted ? 'var(--crayon-green)' : 'var(--crayon-orange)'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${isCompleted ? '#c5e1a5' : '#ffe0b2'}`, paddingBottom: '5px' }}>
                                  <strong style={{ color: 'var(--crayon-dark)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ backgroundColor: 'var(--crayon-dark)', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.85rem' }}>{startIndex + tIdx + 1}</span>
                                    單號: {t.id}
                                  </strong>
                                  <span style={{ backgroundColor: isCompleted ? 'var(--crayon-green)' : 'var(--crayon-red)', color: 'white', padding: '3px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', boxShadow: '1px 1px 0 rgba(0,0,0,0.2)' }}>
                                    {isCompleted ? '✔️ 已完成' : '⏳ 未完成'}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', backgroundColor: 'rgba(255,255,255,0.6)', padding: '5px', borderRadius: '5px' }}>
                                  <span>負責人: <strong style={{ color: 'var(--crayon-purple)', fontSize: '1.1rem' }}>{t.assigneeName}</strong></span>
                                  <span>品項: <strong style={{ color: 'var(--crayon-red)', fontSize: '1.1rem' }}>{t.itemCount || 0}</strong> <span style={{fontSize: '0.85rem'}}>項</span></span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                                    派送日: {new Date(t.dispatchDate).toLocaleDateString()}
                                  </div>
                                  {isCompleted && t.processingDays !== null && (
                                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--crayon-blue)' }}>
                                      處理天數: {t.processingDays} 天
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        {totalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                            <button 
                              className="doodle-button" style={{ padding: '2px 8px', minHeight: 'auto', fontSize: '0.8rem' }}
                              disabled={currentPage === 1}
                              onClick={() => setStatusPage(prev => ({...prev, [task.id]: currentPage - 1}))}
                            >◀</button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{currentPage} / {totalPages}</span>
                            <button 
                              className="doodle-button" style={{ padding: '2px 8px', minHeight: 'auto', fontSize: '0.8rem' }}
                              disabled={currentPage === totalPages}
                              onClick={() => setStatusPage(prev => ({...prev, [task.id]: currentPage + 1}))}
                            >▶</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', minHeight: '340px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        className={`doodle-button ${(reportViewMode[task.id] || 'text') === 'text' ? 'active' : ''}`}
                        style={{ padding: '5px 15px', minHeight: 'auto', backgroundColor: (reportViewMode[task.id] || 'text') === 'text' ? 'var(--crayon-dark)' : 'white', color: (reportViewMode[task.id] || 'text') === 'text' ? 'white' : 'var(--crayon-dark)' }}
                        onClick={() => setReportViewMode(prev => ({...prev, [task.id]: 'text'}))}
                      >
                        📄 數據報告
                      </button>
                      <button 
                        className={`doodle-button ${(reportViewMode[task.id] || 'text') === 'chart' ? 'active' : ''}`}
                        style={{ padding: '5px 15px', minHeight: 'auto', backgroundColor: (reportViewMode[task.id] || 'text') === 'chart' ? 'var(--crayon-dark)' : 'white', color: (reportViewMode[task.id] || 'text') === 'chart' ? 'white' : 'var(--crayon-dark)' }}
                        onClick={() => setReportViewMode(prev => ({...prev, [task.id]: 'chart'}))}
                      >
                        📊 績效圖表
                      </button>
                    </div>
                    <button 
                      className="doodle-button" 
                      style={{ backgroundColor: 'var(--crayon-blue)', color: 'white', padding: '5px 15px', display: 'flex', alignItems: 'center', gap: '5px', minHeight: 'auto' }}
                      onClick={() => navigate('/calendar', { state: { targetDate: task.startDate } })}
                    >
                      📅 在行事曆中查看
                    </button>
                  </div>
                  
                  {(reportViewMode[task.id] || 'text') === 'text' ? (
                    <>
                      <div className="doodle-border" style={{ backgroundColor: '#fff9c4', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--crayon-orange)' }}>完成所有盤點項目的總花費天數</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '5px' }}>
                      {task.totalDaysSpent !== null ? <span style={{ color: 'var(--crayon-red)' }}>{task.totalDaysSpent} 天</span> : <span style={{ color: '#888' }}>尚未完成</span>}
                    </div>
                  </div>
                  
                  <div style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '1.1rem' }}>🏆 人員完成項目排名</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {task.assigneeList.map((assignee, rankIdx) => {
                      let rankStyle = { backgroundColor: 'white', color: 'var(--crayon-dark)', border: '2px solid var(--crayon-dark)' };
                      let rankBadge = '';
                      if (rankIdx === 0) {
                        rankStyle = { backgroundColor: '#fff8e1', color: '#8b6508', border: '2px solid #daa520' };
                        rankBadge = '🥇 第 1 名';
                      } else if (rankIdx === 1) {
                        rankStyle = { backgroundColor: '#f5f5f5', color: '#555', border: '2px solid #9e9e9e' };
                        rankBadge = '🥈 第 2 名';
                      } else if (rankIdx === 2) {
                        rankStyle = { backgroundColor: '#fbe9e7', color: '#8b4513', border: '2px solid #cd7f32' };
                        rankBadge = '🥉 第 3 名';
                      } else {
                        rankBadge = `第 ${rankIdx + 1} 名`;
                      }
                      
                      return (
                        <div key={assignee.name} className="doodle-border" style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                          padding: '12px 15px', borderRadius: '10px', flexWrap: 'wrap', gap: '10px',
                          ...rankStyle
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: '900', fontSize: '1.2rem', minWidth: '80px' }}>{rankBadge}</span>
                            <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{assignee.name}</span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 'bold' }}>完成項目數</div>
                              <div style={{ fontWeight: '900', fontSize: '1.5rem', color: rankIdx < 3 ? 'inherit' : 'var(--crayon-orange)' }}>{assignee.items} <span style={{ fontSize: '1rem' }}>項</span></div>
                            </div>
                            
                            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(0,0,0,0.2)', paddingLeft: '20px' }}>
                              <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 'bold' }}>完成比率</div>
                              <div style={{ fontWeight: '900', fontSize: '1.5rem', color: 'var(--crayon-blue)' }}>{assignee.completionRate.toFixed(2)}%</div>
                            </div>
                            
                            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(0,0,0,0.2)', paddingLeft: '20px' }}>
                              <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 'bold' }}>平均天數</div>
                              <div style={{ fontWeight: '900', fontSize: '1.5rem', color: 'var(--crayon-purple)' }}>{assignee.avgDays.toFixed(2)} <span style={{ fontSize: '1rem' }}>天</span></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {task.assigneeList.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>暫無人員參與</div>}
                  </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📊 績效圖表</span>
                    <select 
                      className="doodle-input" 
                      style={{ padding: '2px 5px', fontSize: '0.9rem', width: 'auto' }}
                      value={chartTypes[task.id] || 'bar'}
                      onChange={(e) => setChartTypes(prev => ({...prev, [task.id]: e.target.value as 'bar'|'line'|'pie'|'composed'}))}
                    >
                      <option value="bar">長條圖</option>
                      <option value="line">折線圖</option>
                      <option value="pie">圓餅圖</option>
                      <option value="composed">長條與折線圖</option>
                    </select>
                  </div>
                  
                  {task.assigneeList.length > 0 && (
                    <div className="doodle-border" style={{ padding: '15px', backgroundColor: 'white', marginTop: '10px', overflowX: 'auto' }}>
                      {(chartTypes[task.id] || 'bar') === 'pie' && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                          <button 
                            className={`doodle-button ${(pieMetrics[task.id] || 'items') === 'items' ? 'active' : ''}`}
                            style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto', backgroundColor: (pieMetrics[task.id] || 'items') === 'items' ? 'var(--crayon-dark)' : 'white', color: (pieMetrics[task.id] || 'items') === 'items' ? 'white' : 'var(--crayon-dark)' }}
                            onClick={() => setPieMetrics(prev => ({...prev, [task.id]: 'items'}))}
                          >完成項目數</button>
                          <button 
                            className={`doodle-button ${(pieMetrics[task.id] || 'items') === 'completionRate' ? 'active' : ''}`}
                            style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto', backgroundColor: (pieMetrics[task.id] || 'items') === 'completionRate' ? 'var(--crayon-dark)' : 'white', color: (pieMetrics[task.id] || 'items') === 'completionRate' ? 'white' : 'var(--crayon-dark)' }}
                            onClick={() => setPieMetrics(prev => ({...prev, [task.id]: 'completionRate'}))}
                          >完成比率</button>
                          <button 
                            className={`doodle-button ${(pieMetrics[task.id] || 'items') === 'tickets' ? 'active' : ''}`}
                            style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto', backgroundColor: (pieMetrics[task.id] || 'items') === 'tickets' ? 'var(--crayon-dark)' : 'white', color: (pieMetrics[task.id] || 'items') === 'tickets' ? 'white' : 'var(--crayon-dark)' }}
                            onClick={() => setPieMetrics(prev => ({...prev, [task.id]: 'tickets'}))}
                          >盤點單數</button>
                        </div>
                      )}
                      
                      <div style={{ height: '300px', width: '100%', minWidth: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          {(() => {
                            const cType = chartTypes[task.id] || 'bar';
                            const pMetric = pieMetrics[task.id] || 'items';
                            const data = task.assigneeList;
                            const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

                            if (cType === 'bar') {
                              return (
                                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis yAxisId="left" orientation="left" stroke="var(--crayon-dark)" />
                                  <YAxis yAxisId="right" orientation="right" stroke="var(--crayon-blue)" />
                                  <Tooltip cursor={{fill: 'transparent'}} />
                                  <Legend />
                                  <Bar yAxisId="left" dataKey="items" name="完成項目數" fill="var(--crayon-green)" />
                                  <Bar yAxisId="left" dataKey="tickets" name="盤點單數" fill="var(--crayon-orange)" />
                                  <Bar yAxisId="right" dataKey="completionRate" name="完成比率(%)" fill="var(--crayon-blue)" />
                                </BarChart>
                              );
                            } else if (cType === 'line') {
                              return (
                                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis yAxisId="left" orientation="left" stroke="var(--crayon-dark)" />
                                  <YAxis yAxisId="right" orientation="right" stroke="var(--crayon-blue)" />
                                  <Tooltip />
                                  <Legend />
                                  <Line yAxisId="left" type="monotone" dataKey="items" name="完成項目數" stroke="var(--crayon-green)" strokeWidth={3} />
                                  <Line yAxisId="left" type="monotone" dataKey="tickets" name="盤點單數" stroke="var(--crayon-orange)" strokeWidth={3} />
                                  <Line yAxisId="right" type="monotone" dataKey="completionRate" name="完成比率(%)" stroke="var(--crayon-blue)" strokeWidth={3} />
                                </LineChart>
                              );
                            } else if (cType === 'composed') {
                              return (
                                <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis yAxisId="left" orientation="left" stroke="var(--crayon-dark)" />
                                  <YAxis yAxisId="right" orientation="right" stroke="var(--crayon-blue)" />
                                  <Tooltip cursor={{fill: 'transparent'}} />
                                  <Legend />
                                  <Bar yAxisId="left" dataKey="items" name="完成項目數" fill="var(--crayon-green)" />
                                  <Bar yAxisId="left" dataKey="tickets" name="盤點單數" fill="var(--crayon-orange)" />
                                  <Line yAxisId="right" type="monotone" dataKey="completionRate" name="完成比率(%)" stroke="var(--crayon-blue)" strokeWidth={3} />
                                </ComposedChart>
                              );
                            } else {
                              return (
                                <PieChart>
                                  <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey={pMetric}
                                    nameKey="name"
                                    label={({name, percent}) => `${name} ${(percent ? percent * 100 : 0).toFixed(0)}%`}
                                  >
                                    {data.map((_entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: any) => [pMetric === 'completionRate' ? `${Number(value).toFixed(2)}%` : value, pMetric === 'items' ? '完成項目數' : pMetric === 'tickets' ? '盤點單數' : '完成比率']} />
                                  <Legend />
                                </PieChart>
                              );
                            }
                          })()}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                {canEdit && (
                  <>
                    <button className="doodle-button success" style={{ flex: 1 }} onClick={() => handleOpenForm(task)}>編輯</button>
                    <button 
                      className="doodle-button danger" 
                      style={{ flex: 1, opacity: task.mappedTickets.length > 0 ? 0.5 : 1, cursor: task.mappedTickets.length > 0 ? 'not-allowed' : 'pointer' }} 
                      disabled={task.mappedTickets.length > 0} 
                      title={task.mappedTickets.length > 0 ? "已有派送單據，無法刪除" : ""}
                      onClick={() => setTaskToDelete(task.id)}
                    >
                      刪除
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <p style={{ color: '#888', gridColumn: '1 / -1' }}>目前尚未建立任何盤點任務。</p>
        )}
      </div>

      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', backgroundColor: 'white' }}>
            <h3 style={{ marginTop: 0 }}>{editingTask ? '編輯任務' : '新增盤點任務'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              
              <div>
                <label style={{ fontWeight: 'bold' }}>任務名稱：</label>
                <input className="doodle-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontWeight: 'bold' }}>開始日期：</label>
                  <CrayonDatePicker value={startDateStr} onChange={setStartDateStr} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontWeight: 'bold' }}>結束日期：</label>
                  <CrayonDatePicker value={endDateStr} onChange={setEndDateStr} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontWeight: 'bold' }}>盤點類型：</label>
                  <select className="doodle-input" value={formData.ticketType} onChange={e => setFormData({...formData, ticketType: e.target.value as any})}>
                    <option value="夾鉗">夾鉗</option>
                    <option value="TKW">TKW</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 'bold' }}>需盤點總項目數：</label>
                  <input type="number" min="1" className="doodle-input" required value={formData.totalItemCount} onChange={e => setFormData({...formData, totalItemCount: Number(e.target.value)})} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="doodle-button success" style={{ flex: 1 }}>儲存</button>
                <button type="button" className="doodle-button danger" style={{ flex: 1 }} onClick={() => setIsFormOpen(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'white', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, color: 'var(--crayon-red)' }}>⚠️ 刪除確認</h3>
            <p style={{ margin: '20px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>確定要刪除這筆盤點任務嗎？</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
              <button type="button" className="doodle-button" style={{ flex: 1 }} onClick={() => setTaskToDelete(null)}>取消</button>
              <button type="button" className="doodle-button danger" style={{ flex: 1 }} onClick={confirmDelete}>確定刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
