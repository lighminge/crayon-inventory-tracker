import React, { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel, Workflow } from '../types';
import { getTickets, updateTicket, getPersonnel, getWorkflows } from '../services/api';
import { calculateBusinessDays } from '../utils/dateUtils';

export default function WorkflowTickets() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Search State
  const [searchId, setSearchId] = useState('');

  // Modals State
  const [updatingTicket, setUpdatingTicket] = useState<InventoryTicket | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isManagerFormOpen, setIsManagerFormOpen] = useState(false);
  const [managerName, setManagerName] = useState('');

  // Batch Advance State
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);

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

  // Sort by id for consistency
  const activeTickets = useMemo(() => {
    return [...tickets].sort((a, b) => a.id.localeCompare(b.id));
  }, [tickets]);

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

  const revertToPreviousStage = async (ticket: InventoryTicket) => {
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

    const confirmMsg = `確定要將單號 ${ticket.id} 退回上一個流程嗎？\n這將會清除「${workflows.find(w => w.id === lastCompletedStageId)?.name}」的完成紀錄。`;
    if (!confirm(confirmMsg)) return;

    try {
      const newStageDates = { ...ticket.stageDates };
      delete newStageDates[lastCompletedStageId];
      
      await updateTicket(ticket.id, { stageDates: newStageDates });
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

  const handleBatchAdvance = async () => {
    if (selectedTickets.size === 0) return alert('請先勾選要推進的單據！');
    if (!confirm(`確定要將選取的 ${selectedTickets.size} 筆單據推進到下一關嗎？\n(注意：若下一關是最後一關(結案)，批次推進將無法自動結案，需手動逐筆核准結案)`)) return;

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
        <form onSubmit={handleSearchAndOpen} style={{ display: 'flex', gap: '10px' }}>
          <input className="doodle-input" required value={searchId} onChange={e => setSearchId(e.target.value)} placeholder="輸入單號快速推進..." />
          <button type="submit" className="doodle-button">🔍 快查推進</button>
        </form>
      </div>

      <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#e3f2fd', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: 'var(--crayon-blue)' }}>⚡ 批次作業</h3>
        <span style={{ fontWeight: 'bold' }}>已勾選: <span style={{ color: 'var(--crayon-red)', fontSize: '1.2rem' }}>{selectedTickets.size}</span> 筆</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
          <label style={{ fontWeight: 'bold' }}>統一設定日期：</label>
          <input type="date" className="doodle-input" style={{ width: 'auto' }} value={batchDate} onChange={e => setBatchDate(e.target.value)} />
          <button className="doodle-button success" onClick={handleBatchAdvance}>批次推進至下一關</button>
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
              <th style={{ padding: '15px' }}>單號</th>
              <th style={{ padding: '15px' }}>類型</th>
              <th style={{ padding: '15px' }}>盤點人員</th>
              <th style={{ padding: '15px' }}>目前進度</th>
              <th style={{ padding: '15px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {currentTickets.map((t, index) => {
              const nextStage = getNextStage(t);
              const isPendingApproval = !nextStage && !t.closeDate;
              let currentStageName = '已派送 (未開始)';
              if (!nextStage) currentStageName = '等待主管核准結案';
              else if (t.stageDates) {
                const completedCount = Object.keys(t.stageDates).length;
                if (completedCount > 0 && completedCount <= workflows.length) {
                  currentStageName = `進行中 (${nextStage.name})`;
                }
              }

              const progress = getProgress(t);

              return (
                <React.Fragment key={t.id}>
                  <tr style={{ borderTop: '2px dashed #ccc', backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '15px' }}>
                      <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: 'var(--crayon-blue)' }} 
                        checked={selectedTickets.has(t.id)}
                        onChange={() => toggleSelectTicket(t.id)}
                      />
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold', fontSize: '1.2rem' }}>{t.id}</td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ backgroundColor: t.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)', color: 'white', padding: '4px 10px', borderRadius: '5px' }}>
                        {t.ticketType || '未指定'}
                      </span>
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>{getAssigneeName(t.assigneeId)}</td>
                    <td style={{ padding: '15px', color: isPendingApproval ? 'var(--crayon-orange)' : 'inherit', fontWeight: isPendingApproval ? 'bold' : 'normal' }}>
                      {currentStageName}
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {nextStage && (
                          <button className="doodle-button success" style={{ padding: '5px 15px', fontSize: '0.9rem' }} onClick={() => openStageUpdate(t, nextStage)}>
                            推進至 {nextStage.name}
                          </button>
                        )}
                        {isPendingApproval && (
                          <button className="doodle-button" style={{ backgroundColor: 'var(--crayon-orange)', padding: '5px 15px', fontSize: '0.9rem' }} onClick={() => handleOpenManagerForm(t)}>
                            主管核准結案
                          </button>
                        )}
                        {t.stageDates && Object.keys(t.stageDates).length > 0 && (
                          <button className="doodle-button danger" style={{ padding: '5px 15px', fontSize: '0.9rem' }} onClick={() => revertToPreviousStage(t)}>
                            退回上一關
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '2px dashed #ccc', backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff' }}>
                    <td colSpan={6} style={{ padding: '0 15px 15px 15px' }}>
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

      {/* Manager Approval Modal */}
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
