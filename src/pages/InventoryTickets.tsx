import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel, Workflow } from '../types';
import { getTickets, updateTicket, deleteTicket, getPersonnel, getWorkflows, addTicket, getTasks } from '../services/api';
import { calculateBusinessDays } from '../utils/dateUtils';

export default function InventoryTicketsPage() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter State
  const [filterId, setFilterId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'inProgress' | 'closed'>('all');
  const [filterPerson, setFilterPerson] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterTaskId, setFilterTaskId] = useState('');
  
  // Sort State
  const [sortMethod, setSortMethod] = useState<'id' | 'dispatchDate' | 'personnel'>('id');

  // Modals State
  const [updatingTicket, setUpdatingTicket] = useState<InventoryTicket | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isManagerFormOpen, setIsManagerFormOpen] = useState(false);
  const [managerName, setManagerName] = useState('');

  // Edit Modal State
  const [editingTicket, setEditingTicket] = useState<InventoryTicket | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  // Confirm Delete Modal
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, pData, wData, tasksData] = await Promise.all([getTickets(), getPersonnel(), getWorkflows(), getTasks()]);
      setTickets(tData);
      setPersonnel(pData);
      setWorkflows(wData.sort((a, b) => a.order - b.order));
      setTasks(tasksData);
    } catch (e) {
      console.error(e);
      alert('讀取失敗');
    }
  };

  const getAssigneeName = (id: string) => {
    const p = personnel.find(p => p.id === id);
    return p ? p.name : '未知人員';
  };

  // Filter Logic
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // 1. ID
      if (filterId && !t.id.includes(filterId)) return false;
      // 2. Date Range (using dispatchDate)
      if (filterStartDate || filterEndDate) {
        if (!t.dispatchDate) return false;
        const dDate = new Date(t.dispatchDate);
        if (filterStartDate) {
          const s = new Date(filterStartDate);
          s.setHours(0,0,0,0);
          if (dDate < s) return false;
        }
        if (filterEndDate) {
          const e = new Date(filterEndDate);
          e.setHours(23,59,59,999);
          if (dDate > e) return false;
        }
      }
      // 3. Status
      if (filterStatus === 'inProgress' && t.closeDate) return false;
      if (filterStatus === 'closed' && !t.closeDate) return false;
      // 4. Person
      if (filterPerson && t.assigneeId !== filterPerson) return false;
      // 5. Task
      if (filterTaskId && t.taskId !== filterTaskId) return false;
      // 6. Year / Month (based on dispatchDate)
      if ((filterYear || filterMonth) && t.dispatchDate) {
        const dDate = new Date(t.dispatchDate);
        if (filterYear && dDate.getFullYear().toString() !== filterYear) return false;
        if (filterMonth && (dDate.getMonth() + 1).toString() !== filterMonth) return false;
      }

      return true;
    });
  }, [tickets, filterId, filterStartDate, filterEndDate, filterStatus, filterPerson, filterTaskId, filterYear, filterMonth]);

  // Sort Logic
  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort((a, b) => {
      if (sortMethod === 'id') {
        return a.id.localeCompare(b.id);
      } else if (sortMethod === 'dispatchDate') {
        return (b.dispatchDate || 0) - (a.dispatchDate || 0);
      } else if (sortMethod === 'personnel') {
        const nameA = getAssigneeName(a.assigneeId);
        const nameB = getAssigneeName(b.assigneeId);
        return nameA.localeCompare(nameB);
      }
      return 0;
    });
  }, [filteredTickets, sortMethod, personnel]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedTickets.length / itemsPerPage);
  const currentTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedTickets.slice(start, start + itemsPerPage);
  }, [sortedTickets, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterId, filterStartDate, filterEndDate, filterStatus, filterPerson, filterTaskId, filterYear, filterMonth, sortMethod, itemsPerPage]);

  const getProgress = (ticket: InventoryTicket) => {
    const totalStages = workflows.length;
    const completedStages = ticket.stageDates ? Object.keys(ticket.stageDates).length : 0;
    const percentage = totalStages === 0 ? 0 : Math.min(100, Math.round((completedStages / totalStages) * 100));
    return { completedStages, totalStages, percentage };
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

  const openStageUpdate = (ticket: InventoryTicket, stage: Workflow) => {
    setUpdatingTicket(ticket);
    setSelectedStageId(stage.id);
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setManagerName('');
  };

  const handleStageUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingTicket || !selectedStageId) return;

    const timestamp = new Date(selectedDate).getTime();
    const newStageDates = { ...updatingTicket.stageDates, [selectedStageId]: timestamp };
    
    const currentIndex = workflows.findIndex(w => w.id === selectedStageId);
    const isLastStage = currentIndex === workflows.length - 1;
    
    try {
      if (isLastStage) {
        const processingDays = updatingTicket.dispatchDate ? 
          calculateBusinessDays(updatingTicket.dispatchDate, timestamp) : 0;
        await updateTicket(updatingTicket.id, { 
          stageDates: newStageDates,
          closeDate: timestamp,
          managerName: managerName,
          totalProcessingDays: processingDays
        });
      } else {
        await updateTicket(updatingTicket.id, { stageDates: newStageDates });
      }
      setUpdatingTicket(null);
      loadData();
    } catch (e) {
      alert('更新失敗');
    }
  };

  const handleOpenManagerForm = (ticket: InventoryTicket) => {
    setUpdatingTicket(ticket);
    setManagerName('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setIsManagerFormOpen(true);
  };

  const handleApproveAndClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingTicket) return;
    
    const timestamp = new Date(selectedDate).getTime();
    const processingDays = updatingTicket.dispatchDate ? 
      calculateBusinessDays(updatingTicket.dispatchDate, timestamp) : 0;

    try {
      await updateTicket(updatingTicket.id, {
        closeDate: timestamp,
        managerName: managerName,
        totalProcessingDays: processingDays
      });
      setIsManagerFormOpen(false);
      setUpdatingTicket(null);
      loadData();
    } catch (e) {
      alert('結案失敗');
    }
  };

  const confirmDelete = async () => {
    if (deletingId) {
      await deleteTicket(deletingId);
      setDeletingId(null);
      loadData();
    }
  };

  const openEditModal = (t: InventoryTicket) => {
    setEditingTicket(t);
    setEditFormData({
      id: t.id,
      ticketType: t.ticketType || '夾鉗',
      assigneeId: t.assigneeId,
      itemCount: t.itemCount || '',
      taskId: t.taskId || '',
      dispatchDateStr: t.dispatchDate ? new Date(t.dispatchDate).toISOString().split('T')[0] : '',
      stageDatesStr: workflows.reduce((acc: any, w) => {
        acc[w.id] = (t.stageDates && t.stageDates[w.id]) ? new Date(t.stageDates[w.id]).toISOString().split('T')[0] : '';
        return acc;
      }, {})
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    try {
      const newStageDates: Record<string, number> = {};
      workflows.forEach(w => {
        if (editFormData.stageDatesStr[w.id]) {
          newStageDates[w.id] = new Date(editFormData.stageDatesStr[w.id]).getTime();
        }
      });

      if (editFormData.id !== editingTicket.id) {
         const newTicket: InventoryTicket = {
            id: editFormData.id,
            title: editFormData.id, 
            ticketType: editFormData.ticketType,
            assigneeId: editFormData.assigneeId,
            dispatchDate: editFormData.dispatchDateStr ? new Date(editFormData.dispatchDateStr).getTime() : null,
            stageDates: newStageDates,
            closeDate: Object.values(newStageDates).length === workflows.length ? editingTicket.closeDate : null,
            managerName: editingTicket.managerName,
            totalProcessingDays: editingTicket.totalProcessingDays,
         };
         if (editFormData.itemCount) newTicket.itemCount = Number(editFormData.itemCount);
         if (editFormData.taskId) newTicket.taskId = editFormData.taskId;
         
         await addTicket(newTicket);
         await deleteTicket(editingTicket.id);
      } else {
         const updates: any = {
           ticketType: editFormData.ticketType,
           assigneeId: editFormData.assigneeId,
           dispatchDate: editFormData.dispatchDateStr ? new Date(editFormData.dispatchDateStr).getTime() : null,
           stageDates: newStageDates,
           closeDate: Object.values(newStageDates).length === workflows.length ? editingTicket.closeDate : null,
           itemCount: editFormData.itemCount ? Number(editFormData.itemCount) : null,
           taskId: editFormData.taskId || null
         };
         await updateTicket(editingTicket.id, updates);
      }

      setEditingTicket(null);
      loadData();
    } catch (e) {
      alert('修改失敗');
    }
  };

  const calculateDays = (startMs: number, endMs: number) => {
    return calculateBusinessDays(startMs, endMs);
  };

  const getCurrentTotalDays = (ticket: InventoryTicket) => {
    if (ticket.totalProcessingDays !== undefined && ticket.totalProcessingDays !== null) return ticket.totalProcessingDays;
    if (ticket.dispatchDate) {
      return calculateDays(ticket.dispatchDate, new Date().getTime());
    }
    return 0;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📝 盤點單管理</h2>
      </div>

      {/* Filter & Sort Bar */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>🔍 查詢與排序</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>盤點單號：</label>
            <input className="doodle-input" style={{ width: '120px' }} value={filterId} onChange={e => setFilterId(e.target.value)} placeholder="輸入單號" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>派送日期起：</label>
            <input type="date" className="doodle-input" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>派送日期迄：</label>
            <input type="date" className="doodle-input" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>狀態：</label>
            <select className="doodle-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
              <option value="all">全部</option>
              <option value="inProgress">處理中</option>
              <option value="closed">已完成</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>盤點人員：</label>
            <select className="doodle-input" value={filterPerson} onChange={e => setFilterPerson(e.target.value)}>
              <option value="">-- 全部 --</option>
              {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>年度：</label>
            <select className="doodle-input" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">-- 全部 --</option>
              {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>月份：</label>
            <select className="doodle-input" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              <option value="">-- 全部 --</option>
              {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m} 月</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>盤點任務：</label>
            <select className="doodle-input" value={filterTaskId} onChange={e => setFilterTaskId(e.target.value)}>
              <option value="">-- 全部 --</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>排序方式：</label>
              <select className="doodle-input" style={{ border: '2px solid var(--crayon-blue)' }} value={sortMethod} onChange={e => setSortMethod(e.target.value as any)}>
                <option value="id">單號排序</option>
                <option value="dispatchDate">盤點派單日排序</option>
                <option value="personnel">人員排序</option>
              </select>
            </div>
            <button className="doodle-button" style={{ height: '42px' }} onClick={() => {
              setFilterId(''); setFilterStartDate(''); setFilterEndDate(''); setFilterStatus('all'); setFilterPerson(''); setFilterTaskId(''); setFilterYear(''); setFilterMonth(''); setSortMethod('id');
            }}>清除</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)' }}>
          👉 目前符合條件共 {sortedTickets.length} 筆資料
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontWeight: 'bold' }}>每頁筆數：</label>
            <select className="doodle-input" style={{ width: 'auto' }} value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>
          
          {/* Top Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="doodle-button" style={{ padding: '5px 15px', minHeight: 'auto' }} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一頁</button>
              <div style={{ padding: '5px 15px', fontWeight: 'bold' }}>{currentPage} / {totalPages}</div>
              <button className="doodle-button" style={{ padding: '5px 15px', minHeight: 'auto' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一頁</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {currentTickets.map((t, index) => {
          const progress = getProgress(t);
          const nextStage = getNextStage(t);
          const isFinished = !nextStage && t.closeDate;
          const isPendingApproval = !nextStage && !t.closeDate;
          const seqNum = (currentPage - 1) * itemsPerPage + index + 1;
          const currentTotalDays = getCurrentTotalDays(t);

          return (
            <div key={t.id} className="doodle-border" style={{ padding: '20px', position: 'relative', display: 'flex', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ 
                        backgroundColor: 'var(--crayon-dark)', color: 'white', 
                        padding: '2px 10px', borderRadius: '15px', fontWeight: 'bold' 
                      }}>#{seqNum}</span>
                      <h3 style={{ margin: 0, fontSize: '1.5rem' }}>單號：{t.id}</h3>
                      <span style={{
                        backgroundColor: t.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)',
                        color: 'white', padding: '2px 10px', borderRadius: '5px', fontSize: '0.9rem'
                      }}>{t.ticketType || '未指定'}</span>
                    </div>
                    
                    <div style={{ margin: '15px 0', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                      <span style={{ 
                        backgroundColor: 'var(--crayon-yellow)', 
                        padding: '5px 15px', 
                        borderRadius: '20px', 
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        border: '2px dashed var(--crayon-dark)'
                      }}>
                        👤 盤點人員：{getAssigneeName(t.assigneeId)}
                      </span>
                      {t.itemCount !== undefined && t.itemCount !== null && (
                        <span style={{ 
                          backgroundColor: '#e1bee7', 
                          padding: '5px 15px', 
                          borderRadius: '20px', 
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          border: '2px dashed var(--crayon-dark)'
                        }}>
                          📦 項目數量：{t.itemCount}
                        </span>
                      )}
                      {t.taskId && (
                        <span style={{ 
                          backgroundColor: '#b2dfdb', 
                          padding: '5px 15px', 
                          borderRadius: '20px', 
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          border: '2px dashed var(--crayon-dark)'
                        }}>
                          🎯 任務：{tasks.find(tk => tk.id === t.taskId)?.name || '未知任務'}
                        </span>
                      )}
                    </div>
                    
                    {isFinished && (
                      <div style={{ marginTop: '5px', color: 'var(--crayon-green)', fontWeight: 'bold' }}>
                        ✓ 已結案 (主管：{t.managerName})
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '300px' }}>
                    {!isFinished && nextStage && (
                      <button className="doodle-button success" onClick={() => openStageUpdate(t, nextStage)}>推進: {nextStage.name}</button>
                    )}
                    {!isFinished && isPendingApproval && (
                      <button className="doodle-button" style={{ backgroundColor: 'var(--crayon-orange)' }} onClick={() => handleOpenManagerForm(t)}>主管核准結案</button>
                    )}
                    <button className="doodle-button" onClick={() => openEditModal(t)}>修改</button>
                    <button className="doodle-button danger" onClick={() => setDeletingId(t.id)}>刪除</button>
                  </div>
                </div>

                {/* Progress Bar & Stages Details */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' }}>
                    <span>進度：{progress.completedStages} / {progress.totalStages}</span>
                    <span>{progress.percentage}%</span>
                  </div>
                  <div style={{ width: '100%', height: '15px', border: '2px solid var(--crayon-dark)', borderRadius: '15px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress.percentage}%`, height: '100%', backgroundColor: 'var(--crayon-green)' }}></div>
                  </div>
                  
                  {/* Stage Date Logs (Block style) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '30px' }}>
                    {workflows.map((w, wIndex) => {
                      const isDone = t.stageDates && t.stageDates[w.id];
                      const isCurrent = !isFinished && nextStage?.id === w.id;
                      
                      let spentDaysText = '';
                      if (isDone) {
                        const previousDate = wIndex === 0 ? t.dispatchDate : (t.stageDates && t.stageDates[workflows[wIndex-1].id]);
                        if (previousDate) {
                          const days = calculateDays(previousDate, t.stageDates[w.id]);
                          spentDaysText = days === 0 ? '0天' : `${days}天`;
                        }
                      }

                      return (
                        <div key={w.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ 
                            padding: '10px', borderRadius: '10px', fontSize: '0.95rem',
                            backgroundColor: isDone ? '#e8f5e9' : (isCurrent ? '#fff3e0' : '#f5f5f5'),
                            border: `3px solid ${isDone ? 'var(--crayon-green)' : (isCurrent ? 'var(--crayon-orange)' : '#ccc')}`,
                            color: isDone ? '#000' : '#888',
                            position: 'relative',
                            minWidth: '100px',
                            textAlign: 'center',
                            boxShadow: isCurrent ? '2px 2px 0px rgba(255, 152, 0, 0.3)' : 'none',
                            transform: isCurrent ? 'scale(1.05)' : 'none',
                            transition: 'all 0.3s'
                          }}>
                            {isCurrent && (
                              <div style={{ 
                                position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', 
                                fontSize: '1rem', fontWeight: 'bold', color: 'var(--crayon-orange)',
                                backgroundColor: 'white', padding: '2px 8px', borderRadius: '10px', border: '2px dashed var(--crayon-orange)',
                                whiteSpace: 'nowrap', animation: 'bounce 1s infinite', zIndex: 10
                              }}>
                                📍 處理中
                              </div>
                            )}
                            <div style={{ fontWeight: 'bold' }}>{w.name}</div>
                            {/* 加入流程負責人 */}
                            <div style={{ 
                              fontSize: '0.8rem', 
                              color: 'var(--crayon-blue)', 
                              backgroundColor: 'white', 
                              padding: '2px 5px', 
                              borderRadius: '5px',
                              border: '1px dashed var(--crayon-blue)',
                              marginTop: '5px',
                              marginBottom: '5px'
                            }}>
                              負責: {getAssigneeName(w.assigneeId || '')}
                            </div>
                            <div style={{ marginTop: '5px' }}>{isDone ? new Date(t.stageDates[w.id]).toLocaleDateString() : '-'}</div>
                          </div>
                          {/* 耗時顯示 - 明顯的便利貼風格 */}
                          {isDone && spentDaysText && (
                            <div style={{ 
                              marginTop: '8px', fontSize: '0.9rem', fontWeight: 'bold', 
                              color: 'var(--crayon-dark)',
                              backgroundColor: spentDaysText === '0天' ? '#c8e6c9' : '#ffcdd2', 
                              padding: '4px 10px', 
                              borderRadius: '4px', 
                              border: '2px solid var(--crayon-dark)',
                              transform: 'rotate(-2deg)',
                              boxShadow: '1px 1px 0px rgba(0,0,0,0.5)'
                            }}>
                              耗時: {spentDaysText}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Huge Total Processing Days Marker on the far right */}
              <div style={{ 
                marginLeft: '30px',
                paddingLeft: '30px',
                borderLeft: '4px dashed var(--crayon-dark)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minWidth: '150px'
              }}>
                <div style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 'bold', 
                  color: 'white', 
                  backgroundColor: 'var(--crayon-dark)',
                  padding: '5px 15px',
                  borderRadius: '10px',
                  marginBottom: '15px',
                  transform: 'rotate(2deg)'
                }}>
                  總處理天數
                </div>
                <div style={{ 
                  width: '120px', height: '120px', 
                  borderRadius: '20px', 
                  backgroundColor: isFinished ? 'var(--crayon-green)' : 'var(--crayon-red)',
                  border: `4px solid var(--crayon-dark)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column',
                  color: 'white',
                  transform: 'rotate(-3deg)',
                  boxShadow: '5px 5px 0px rgba(0,0,0,0.2)'
                }}>
                  <span style={{ fontSize: '4rem', fontWeight: 'bold', lineHeight: '1', fontFamily: 'Caveat, cursive' }}>{currentTotalDays}</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>天</span>
                </div>
              </div>
            </div>
          );
        })}
        {filteredTickets.length === 0 && <p style={{ textAlign: 'center', padding: '20px' }}>找不到符合條件的盤點單。</p>}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '30px' }}>
          <button className="doodle-button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一頁</button>
          <div style={{ padding: '8px 15px', fontWeight: 'bold' }}>{currentPage} / {totalPages}</div>
          <button className="doodle-button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一頁</button>
        </div>
      )}

      {/* 刪除確認視窗 */}
      {deletingId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'white', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--crayon-red)', fontSize: '2rem', marginTop: 0 }}>⚠️ 警告</h3>
            <p style={{ fontSize: '1.2rem' }}>您確定要刪除單號 <strong>{deletingId}</strong> 嗎？<br/>刪除後將無法復原！</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '25px' }}>
              <button className="doodle-button danger" onClick={confirmDelete}>確認刪除</button>
              <button className="doodle-button" onClick={() => setDeletingId(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 修改盤點單視窗 */}
      {editingTicket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', backgroundColor: 'white', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={() => setEditingTicket(null)}
              style={{ 
                position: 'absolute', top: '15px', right: '15px', 
                background: 'var(--crayon-paper)', border: '2px solid var(--crayon-dark)', 
                fontSize: '1.2rem', cursor: 'pointer', color: 'var(--crayon-red)', 
                fontWeight: 'bold', width: '35px', height: '35px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
              }}
            >
              ❌
            </button>
            
            <h3 style={{ marginTop: 0 }}>📝 修改盤點單 ({editingTicket.id})</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label>單號：</label>
                  <input className="doodle-input" required value={editFormData.id} onChange={e => setEditFormData({...editFormData, id: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>類型：</label>
                  <select className="doodle-input" value={editFormData.ticketType} onChange={e => setEditFormData({...editFormData, ticketType: e.target.value})}>
                    <option value="夾鉗">夾鉗</option>
                    <option value="TKW">TKW</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>盤點人員：</label>
                  <select className="doodle-input" value={editFormData.assigneeId} onChange={e => setEditFormData({...editFormData, assigneeId: e.target.value})}>
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label>項目數量 (選填)：</label>
                  <input type="number" className="doodle-input" value={editFormData.itemCount} onChange={e => setEditFormData({...editFormData, itemCount: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>關聯任務 (選填)：</label>
                  <select className="doodle-input" value={editFormData.taskId} onChange={e => setEditFormData({...editFormData, taskId: e.target.value})}>
                    <option value="">-- 無 --</option>
                    {tasks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ borderTop: '2px dashed #ccc', paddingTop: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>流程日期修改 (清除日期即可退回流程)</h4>
                
                {workflows.map(w => (
                  <div key={w.id} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '0.9rem', width: '100px' }}>{w.name}：</label>
                    <input type="date" className="doodle-input" style={{ flex: 1 }} 
                      value={editFormData.stageDatesStr[w.id] || ''} 
                      onChange={e => setEditFormData({
                        ...editFormData, 
                        stageDatesStr: { ...editFormData.stageDatesStr, [w.id]: e.target.value }
                      })} 
                    />
                    <button type="button" className="doodle-button danger" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => setEditFormData({
                      ...editFormData, 
                      stageDatesStr: { ...editFormData.stageDatesStr, [w.id]: '' }
                    })}>退回(清除)</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="doodle-button success" style={{ flex: 1 }}>儲存修改</button>
                <button type="button" className="doodle-button danger" style={{ flex: 1 }} onClick={() => setEditingTicket(null)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 原本的 Stage Update Modal */}
      {updatingTicket && selectedStageId && !isManagerFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'white' }}>
            <h3>更新流程進度</h3>
            <p>單號：{updatingTicket.id}</p>
            {(() => {
              const currentIndex = workflows.findIndex(w => w.id === selectedStageId);
              const nextFlow = workflows[currentIndex + 1];
              return (
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ margin: '5px 0' }}>即將推進至：<strong>{nextFlow ? nextFlow.name : '✅ 結案'}</strong></p>
                  {nextFlow && (
                    <p style={{ margin: '5px 0', color: 'var(--crayon-blue)' }}>
                      下一關負責人：<strong>{getAssigneeName(nextFlow.assigneeId || '')}</strong>
                    </p>
                  )}
                </div>
              );
            })()}
            <form onSubmit={handleStageUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
              <div>
                <label>完成日期：</label>
                <input type="date" className="doodle-input" required value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>
              {workflows.findIndex(w => w.id === selectedStageId) === workflows.length - 1 && (
                <div>
                  <label>核准主管姓名：</label>
                  <select className="doodle-input" required value={managerName} onChange={e => setManagerName(e.target.value)}>
                    <option value="">-- 請選擇主管 --</option>
                    {personnel.filter(p => (p.roles || []).includes('主管')).map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="doodle-button success" style={{ flex: 1 }}>確認推進</button>
                <button type="button" className="doodle-button danger" style={{ flex: 1 }} onClick={() => {setUpdatingTicket(null); setSelectedStageId('');}}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 原本的 Manager Approval Modal */}
      {isManagerFormOpen && updatingTicket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'white' }}>
            <h3>主管核准結案</h3>
            <p>單號：{updatingTicket.id}</p>
            <form onSubmit={handleApproveAndClose} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div>
                <label>核准日期：</label>
                <input type="date" className="doodle-input" required value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>
              <div>
                <label>核准主管姓名：</label>
                <select className="doodle-input" required value={managerName} onChange={e => setManagerName(e.target.value)}>
                  <option value="">-- 請選擇主管 --</option>
                  {personnel.filter(p => (p.roles || []).includes('主管')).map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="doodle-button success" style={{ flex: 1 }}>確認結案</button>
                <button type="button" className="doodle-button danger" style={{ flex: 1 }} onClick={() => setIsManagerFormOpen(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
