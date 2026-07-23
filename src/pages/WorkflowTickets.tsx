import React, { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel, Workflow } from '../types';
import { getTickets, updateTicket, getPersonnel, getWorkflows } from '../services/api';
import { calculateBusinessDays } from '../utils/dateUtils';
import CrayonDatePicker from '../components/CrayonDatePicker';

export default function WorkflowTickets() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Search & Filter State
  const [searchId, setSearchId] = useState('');
  const [filterTicketType, setFilterTicketType] = useState('');

  // Modals State
  const [updatingTicket, setUpdatingTicket] = useState<InventoryTicket | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isManagerFormOpen, setIsManagerFormOpen] = useState(false);
  const [managerName, setManagerName] = useState('');

  // Batch Advance State
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, pData, wData] = await Promise.all([getTickets(), getPersonnel(), getWorkflows()]);
      // Only keep unfinished tickets
      setTickets(tData.filter(t => !t.closeDate));
      setPersonnel(pData);
      setWorkflows(wData.sort((a, b) => a.order - b.order));
    } catch (e) {
      console.error(e);
      alert('讀取失敗');
    }
  };

  const getAssigneeName = (id: string) => {
    const p = personnel.find(p => p.id === id);
    return p ? p.name : '未知人員';
  };

  // Sort and Filter active tickets
  const activeTickets = useMemo(() => {
    return [...tickets].filter(t => !filterTicketType || t.ticketType === filterTicketType).sort((a, b) => a.id.localeCompare(b.id));
  }, [tickets, filterTicketType]);

  // Pagination Logic
  const totalPages = Math.ceil(activeTickets.length / itemsPerPage);
  const currentTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return activeTickets.slice(start, start + itemsPerPage);
  }, [activeTickets, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const getNextStage = (ticket: InventoryTicket): Workflow | null => {
    if (!ticket.dispatchDate) return null;
    for (const w of workflows) {
      if (!ticket.stageDates || !ticket.stageDates[w.id]) {
        return w;
      }
    }
    return null;
  };

  const getProgress = (ticket: InventoryTicket) => {
    const totalStages = workflows.length;
    const completedStages = ticket.stageDates ? Object.keys(ticket.stageDates).length : 0;
    const percentage = totalStages === 0 ? 0 : Math.min(100, Math.round((completedStages / totalStages) * 100));
    return { completedStages, totalStages, percentage };
  };

  const calculateDays = (startMs: number, endMs: number) => {
    return calculateBusinessDays(startMs, endMs);
  };

  const getFirstStageDate = (ticket: InventoryTicket) => {
    if (ticket.stageDates && Object.keys(ticket.stageDates).length > 0) {
      return Math.min(...Object.values(ticket.stageDates));
    }
    return ticket.dispatchDate;
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
    if (!selectedDate) return alert('請選擇完成日期');

    const timestamp = new Date(selectedDate).getTime();
    const newStageDates = { ...updatingTicket.stageDates, [selectedStageId]: timestamp };
    
    const currentIndex = workflows.findIndex(w => w.id === selectedStageId);
    const isLastStage = currentIndex === workflows.length - 1;
    
    try {
      if (isLastStage) {
        const processingDays = updatingTicket.dispatchDate ? 
          calculateBusinessDays(updatingTicket.dispatchDate, timestamp) : 1;
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
    if (!selectedDate) return alert('請選擇核准日期');
    
    const timestamp = new Date(selectedDate).getTime();
    const processingDays = updatingTicket.dispatchDate ? 
      calculateBusinessDays(updatingTicket.dispatchDate, timestamp) : 1;

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

  const [revertingTicket, setRevertingTicket] = useState<InventoryTicket | null>(null);
  const [revertStageId, setRevertStageId] = useState<string>('');

  const confirmRevertStage = (ticket: InventoryTicket) => {
    if (!ticket.stageDates || Object.keys(ticket.stageDates).length === 0) {
      alert('此單據尚未完成任何關卡，無法退回。');
      return;
    }
    
    // Find the last completed stage
    let lastCompletedStageId = '';
    for (let i = workflows.length - 1; i >= 0; i--) {
      if (ticket.stageDates[workflows[i].id]) {
        lastCompletedStageId = workflows[i].id;
        break;
      }
    }

    if (!lastCompletedStageId) return;
    setRevertingTicket(ticket);
    setRevertStageId(lastCompletedStageId);
  };

  const handleRevertToPreviousStage = async () => {
    if (!revertingTicket || !revertStageId) return;
    try {
      const newStageDates = { ...revertingTicket.stageDates };
      delete newStageDates[revertStageId];
      
      await updateTicket(revertingTicket.id, { stageDates: newStageDates });
      setRevertingTicket(null);
      setRevertStageId('');
      loadData();
    } catch (e) {
      alert('退回失敗');
    }
  };

  const handleSearchAndOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const target = tickets.find(t => t.id === searchId);
    if (!target) {
      alert(`找不到未結案的單號：${searchId}`);
      return;
    }
    
    const nextStage = getNextStage(target);
    if (nextStage) {
      openStageUpdate(target, nextStage);
    } else {
      handleOpenManagerForm(target);
    }
  };

  const toggleSelectTicket = (id: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTickets(newSelected);
  };

  const openBatchConfirm = () => {
    if (selectedTickets.size === 0) {
      setSystemAlert('請先勾選要推進的單據！');
      return;
    }
    if (!batchDate) {
      setSystemAlert('請選擇統一設定日期！');
      return;
    }
    setIsBatchConfirmOpen(true);
  };

  const executeBatchAdvance = async () => {
    setIsBatchConfirmOpen(false);
    const timestamp = new Date(batchDate).getTime();

    try {
      const promises = Array.from(selectedTickets).map(async id => {
        const ticket = tickets.find(t => t.id === id);
        if (!ticket) return;
        const nextStage = getNextStage(ticket);
        
        // Skip if there's no next stage (meaning it's waiting for manager approval)
        if (!nextStage) return;

        const newStageDates = { ...ticket.stageDates, [nextStage.id]: timestamp };
        
        const currentIndex = workflows.findIndex(w => w.id === nextStage.id);
        const isLastStage = currentIndex === workflows.length - 1;

        // Skip batch closing, require manual manager approval for closing
        if (isLastStage) return;

        await updateTicket(id, { stageDates: newStageDates });
      });

      await Promise.all(promises);
      alert('批次推進完成！\n(部分單據若已達主管核准階段，已略過處理)');
      setSelectedTickets(new Set());
      loadData();
    } catch (e) {
      alert('批次推進過程中發生錯誤');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>🔄 盤點單流程 (未結案)</h2>
      </div>

      <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#e3f2fd', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: 'var(--crayon-blue)' }}>⚡ 批次作業</h3>
        <span style={{ fontWeight: 'bold' }}>已勾選: <span style={{ color: 'var(--crayon-red)', fontSize: '1.2rem' }}>{selectedTickets.size}</span> 筆</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
          <label style={{ fontWeight: 'bold' }}>統一設定日期：</label>
          <div style={{ display: 'inline-block', width: '150px' }}>
            <CrayonDatePicker value={batchDate} onChange={setBatchDate} />
          </div>
          <button className="doodle-button success" onClick={openBatchConfirm}>批次推進至下一關</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)' }}>
          👉 目前未結案共 {activeTickets.length} 筆資料
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontWeight: 'bold' }}>每頁筆數：</label>
            <select className="doodle-input" style={{ width: 'auto' }} value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="doodle-button" style={{ padding: '5px 15px', minHeight: 'auto' }} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一頁</button>
              <div style={{ padding: '5px 15px', fontWeight: 'bold' }}>{currentPage} / {totalPages}</div>
              <button className="doodle-button" style={{ padding: '5px 15px', minHeight: 'auto' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一頁</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '30px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>🏷️ 盤點類型：</label>
          <select className="doodle-input" style={{ fontSize: '1.2rem', width: '150px' }} value={filterTicketType} onChange={e => setFilterTicketType(e.target.value)}>
            <option value="">全部</option>
            <option value="夾鉗">夾鉗</option>
            <option value="TKW">TKW</option>
          </select>
        </div>
        <form onSubmit={handleSearchAndOpen} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>🚀 快速處理：</label>
          <input className="doodle-input" style={{ width: '250px', textAlign: 'center', fontSize: '1.2rem' }} required value={searchId} onChange={e => setSearchId(e.target.value)} placeholder="輸入單號快速推進..." />
          <button type="submit" className="doodle-button" style={{ fontSize: '1.1rem' }}>🔍 快查推進</button>
        </form>
      </div>

      <div className="doodle-border" style={{ overflowX: 'auto', backgroundColor: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--crayon-dark)', color: 'white' }}>
              <th style={{ padding: '15px', width: '50px' }}>
                <input type="checkbox" style={{ width: '18px', height: '18px' }} 
                  checked={selectedTickets.size > 0 && selectedTickets.size === currentTickets.length}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedTickets(new Set(currentTickets.map(t => t.id)));
                    } else {
                      setSelectedTickets(new Set());
                    }
                  }}
                />
              </th>
              <th style={{ padding: '15px', width: '60px' }}>序號</th>
              <th style={{ padding: '15px' }}>單號</th>
              <th style={{ padding: '15px' }}>類型</th>
              <th style={{ padding: '15px' }}>盤點人員</th>
              <th style={{ padding: '15px' }}>盤點項目數量</th>
              <th style={{ padding: '15px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {currentTickets.map((t, index) => {
              const nextStage = getNextStage(t);
              const isPendingApproval = !nextStage && !t.closeDate;
              const progress = getProgress(t);

              return (
                <React.Fragment key={t.id}>
                  <tr style={{ borderTop: '4px solid var(--crayon-dark)', backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '15px' }}>
                      <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--crayon-blue)' }} 
                        checked={selectedTickets.has(t.id)}
                        onChange={() => toggleSelectTicket(t.id)}
                      />
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)' }}>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td style={{ padding: '15px', fontWeight: 'bold', fontSize: '1.5rem', color: 'var(--crayon-dark)' }}>{t.id}</td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ backgroundColor: t.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)', color: 'white', padding: '4px 10px', borderRadius: '5px', fontWeight: 'bold' }}>
                        {t.ticketType || '未指定'}
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ backgroundColor: '#fff3e0', border: '2px dashed var(--crayon-orange)', color: 'var(--crayon-orange)', fontWeight: '900', fontSize: '1.4rem', padding: '5px 15px', borderRadius: '10px', display: 'inline-block', transform: 'rotate(-2deg)' }}>
                        {getAssigneeName(t.assigneeId)}
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ backgroundColor: '#e1bee7', border: '2px dashed var(--crayon-purple)', color: 'var(--crayon-purple)', fontWeight: '900', fontSize: '1.4rem', padding: '5px 15px', borderRadius: '10px', display: 'inline-block', transform: 'rotate(2deg)' }}>
                        {t.itemCount || 0} 項
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {nextStage && (() => {
                          const cIdx = workflows.findIndex(w => w.id === nextStage.id);
                          const nNext = cIdx !== -1 && cIdx + 1 < workflows.length ? workflows[cIdx + 1] : null;
                          const btnText = nNext ? `推進至 ${nNext.name}` : '結案';
                          return (
                            <button className="doodle-button success" style={{ padding: '10px 20px', fontSize: '1.3rem', fontWeight: 'bold' }} onClick={() => openStageUpdate(t, nextStage)}>
                              {btnText}
                            </button>
                          );
                        })()}
                        {isPendingApproval && (
                          <button className="doodle-button" style={{ backgroundColor: 'var(--crayon-orange)', padding: '10px 20px', fontSize: '1.3rem', fontWeight: 'bold' }} onClick={() => handleOpenManagerForm(t)}>
                            主管核准結案
                          </button>
                        )}
                        {t.stageDates && Object.keys(t.stageDates).length > 0 && (
                          <button className="doodle-button danger" style={{ padding: '10px 20px', fontSize: '1.3rem', fontWeight: 'bold' }} onClick={() => confirmRevertStage(t)}>
                            退回上一關
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '4px solid var(--crayon-dark)', backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff' }}>
                    <td colSpan={7} style={{ padding: '0 15px 15px 15px' }}>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '600px' }}>
                          {/* Progress Bar & Stages Details */}
                          <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' }}>
                          <span>進度：{progress.completedStages} / {progress.totalStages}</span>
                          <span>{progress.percentage}%</span>
                        </div>
                        <div style={{ width: '100%', height: '15px', border: '2px solid var(--crayon-dark)', borderRadius: '15px', overflow: 'hidden' }}>
                          <div style={{ width: `${progress.percentage}%`, height: '100%', backgroundColor: 'var(--crayon-green)' }}></div>
                        </div>
                        
                        {/* Stage Date Logs */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '30px' }}>
                          {workflows.map((w, wIndex) => {
                            const isDone = t.stageDates && t.stageDates[w.id];
                            const isCurrent = !t.closeDate && nextStage?.id === w.id;
                            
                            let spentDaysText = '';
                            if (isDone) {
                              const previousDate = wIndex === 0 ? t.dispatchDate : (t.stageDates && t.stageDates[workflows[wIndex-1].id]);
                              if (previousDate) {
                                const days = calculateDays(previousDate, t.stageDates[w.id]);
                                spentDaysText = days === 0 ? '0天' : `${days}天`;
                              }
                            }

                            return (
                              <React.Fragment key={w.id}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <div style={{ 
                                  padding: '10px', borderRadius: '10px', fontSize: '0.95rem',
                                  backgroundColor: isDone ? '#e8f5e9' : (isCurrent ? '#fff3e0' : '#f5f5f5'),
                                  border: `3px solid ${isDone ? 'var(--crayon-green)' : (isCurrent ? 'var(--crayon-orange)' : '#ccc')}`,
                                  color: isDone ? '#000' : '#888',
                                  position: 'relative',
                                  minWidth: '160px',
                                  textAlign: 'center',
                                  boxShadow: isCurrent ? '2px 2px 0px rgba(255, 152, 0, 0.3)' : 'none',
                                  transform: isCurrent ? 'scale(1.05)' : 'none',
                                  transition: 'all 0.3s'
                                }}>
                                  {isCurrent && (
                                    <div style={{ 
                                      position: 'absolute', top: '-15px', right: '-10px', 
                                      fontSize: '0.85rem', fontWeight: 'bold', color: 'white',
                                      backgroundColor: 'var(--crayon-orange)', padding: '2px 10px', borderRadius: '15px', border: '2px dashed var(--crayon-dark)',
                                      whiteSpace: 'nowrap', animation: 'bounce 1s infinite', zIndex: 10,
                                      transform: 'rotate(5deg)'
                                    }}>
                                      📍 處理中
                                    </div>
                                  )}
                                  <div style={{ 
                                    position: 'absolute', top: '-15px', left: '-10px', zIndex: 5,
                                    backgroundColor: 'var(--crayon-red)', color: 'white', 
                                    padding: '2px 10px', borderRadius: '15px', 
                                    fontSize: '0.85rem', fontWeight: 'bold',
                                    border: '2px dashed var(--crayon-dark)',
                                    transform: 'rotate(-5deg)'
                                  }}>
                                    關卡 {wIndex + 1}
                                  </div>
                                  <div style={{ fontWeight: 'bold' }}>{w.name}</div>
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
                                    負責: {getAssigneeName(w.assigneeId === 'DYNAMIC_ASSIGNEE' ? t.assigneeId : (w.assigneeId || ''))}
                                  </div>
                                  <div style={{ marginTop: '5px' }}>{isDone ? new Date(t.stageDates[w.id]).toLocaleDateString() : '-'}</div>
                                </div>
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
                                {wIndex < workflows.length - 1 && (
                                  <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: isDone ? 'var(--crayon-green)' : (isCurrent ? 'var(--crayon-orange)' : '#ccc'),
                                    padding: '0 5px'
                                  }}>
                                    <svg width="40" height="40" viewBox="0 0 100 100" style={{ transform: 'rotate(5deg)' }}>
                                      <path d="M 10 50 Q 40 30 75 50" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                                      <path d="M 55 25 L 85 50 L 60 75" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {/* Total Elapsed Days Block */}
                    <div style={{ 
                      minWidth: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', 
                      borderLeft: '4px dashed var(--crayon-dark)', paddingLeft: '20px', paddingTop: '20px' 
                    }}>
                      <div style={{ 
                        fontSize: '1.2rem', fontWeight: 'bold', color: 'white', backgroundColor: 'var(--crayon-dark)', 
                        padding: '5px 15px', borderRadius: '10px', marginBottom: '15px', transform: 'rotate(2deg)' 
                      }}>
                        目前已處理總天數
                      </div>
                      <div style={{ 
                        width: '120px', height: '120px', borderRadius: '20px', backgroundColor: '#fff3e0', 
                        border: '4px solid var(--crayon-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        flexDirection: 'column', color: 'var(--crayon-orange)', transform: 'rotate(-3deg)', 
                        boxShadow: '5px 5px 0px rgba(0,0,0,0.2)' 
                      }}>
                        <span style={{ fontSize: '4rem', fontWeight: 'bold', lineHeight: '1', fontFamily: 'Caveat, cursive' }}>
                          {calculateDays(getFirstStageDate(t) || new Date().getTime(), new Date().getTime())}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>天</span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </React.Fragment>
              );
            })}
            {currentTickets.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>沒有未結案的盤點單 🎉</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
          <button className="doodle-button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一頁</button>
          <div style={{ padding: '8px 15px', fontWeight: 'bold' }}>{currentPage} / {totalPages}</div>
          <button className="doodle-button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一頁</button>
        </div>
      )}

      {/* Stage Update Modal */}
      {updatingTicket && selectedStageId && !isManagerFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', backgroundColor: 'white' }}>
            <h3 style={{ fontSize: '1.8rem', marginTop: 0 }}>🚀 更新流程進度</h3>
            <p style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>單號：{updatingTicket.id}</p>
            {(() => {
              const currentIndex = workflows.findIndex(w => w.id === selectedStageId);
              const nextFlow = workflows[currentIndex + 1];
              return (
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ margin: '5px 0', fontSize: '1.2rem', fontWeight: 'bold' }}>即將推進至：<strong style={{ fontSize: '1.6rem', color: 'var(--crayon-orange)' }}>{nextFlow ? nextFlow.name : '✅ 結案'}</strong></p>
                  {nextFlow && (
                    <p style={{ margin: '5px 0', fontSize: '1.1rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>
                      下一關負責人：<strong>{getAssigneeName(nextFlow.assigneeId === 'DYNAMIC_ASSIGNEE' ? updatingTicket.assigneeId : (nextFlow.assigneeId || ''))}</strong>
                    </p>
                  )}
                </div>
              );
            })()}
            <form onSubmit={handleStageUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>完成日期：</label>
                <CrayonDatePicker value={selectedDate} onChange={setSelectedDate} />
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

      {/* Manager Approval Modal */}
      {isManagerFormOpen && updatingTicket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', backgroundColor: 'white' }}>
            <h3 style={{ fontSize: '1.8rem', marginTop: 0 }}>🛡️ 主管核准結案</h3>
            <p style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>單號：{updatingTicket.id}</p>
            <form onSubmit={handleApproveAndClose} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>核准日期：</label>
                <CrayonDatePicker value={selectedDate} onChange={setSelectedDate} />
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

      {/* Revert Confirm Modal */}
      {revertingTicket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '450px', backgroundColor: 'white', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--crayon-red)', fontSize: '2rem', marginTop: 0 }}>⚠️ 退回確認</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>確定要將單號 <strong>{revertingTicket.id}</strong> 退回上一個流程嗎？</p>
            <p style={{ fontSize: '1.1rem', color: 'var(--crayon-orange)' }}>
              這將會清除「{workflows.find(w => w.id === revertStageId)?.name}」的完成紀錄。
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '25px' }}>
              <button className="doodle-button danger" onClick={handleRevertToPreviousStage}>確認退回</button>
              <button className="doodle-button" onClick={() => { setRevertingTicket(null); setRevertStageId(''); }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Advance Confirm Modal */}
      {isBatchConfirmOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', backgroundColor: 'white', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--crayon-blue)', fontSize: '2rem', marginTop: 0 }}>⚡ 批次推進確認</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>確定要將選取的 <strong>{selectedTickets.size}</strong> 筆單據推進到下一關嗎？</p>
            <div style={{ padding: '15px', backgroundColor: '#fff3e0', border: '2px dashed var(--crayon-orange)', borderRadius: '10px', marginTop: '15px' }}>
              <p style={{ fontSize: '1rem', color: 'var(--crayon-orange)', margin: 0, fontWeight: 'bold' }}>
                ⚠️ 注意：若下一關是最後一關(結案)，批次推進將無法自動結案，需手動逐筆核准結案。
              </p>
            </div>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '25px' }}>
              <button className="doodle-button success" onClick={executeBatchAdvance}>確認批次推進</button>
              <button className="doodle-button danger" onClick={() => setIsBatchConfirmOpen(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
      {/* System Alert Modal */}
      {systemAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'white', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--crayon-red)', fontSize: '2rem', marginTop: 0 }}>⚠️ 提示</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{systemAlert}</p>
            <div style={{ marginTop: '25px' }}>
              <button className="doodle-button" onClick={() => setSystemAlert(null)}>確定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
