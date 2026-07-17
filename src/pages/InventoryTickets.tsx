import { useState, useEffect, useMemo } from 'react';
import type { InventoryTicket, Personnel, Workflow } from '../types';
import { getTickets, updateTicket, deleteTicket, getPersonnel, getWorkflows } from '../services/api';

export default function InventoryTicketsPage() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Filter State
  const [filterId, setFilterId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'inProgress' | 'closed'>('all');
  const [filterPerson, setFilterPerson] = useState('');

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
      const [tData, pData, wData] = await Promise.all([getTickets(), getPersonnel(), getWorkflows()]);
      // Order by ID ascending
      setTickets(tData.sort((a, b) => a.id.localeCompare(b.id)));
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

  // Filter Logic
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // 1. ID
      if (filterId && !t.id.includes(filterId)) return false;
      // 2. Date Range (using dispatchDate)
      if (filterStartDate || filterEndDate) {
        if (!t.dispatchDate) return false;
        const dDate = new Date(t.dispatchDate);
        // set to start/end of day for comparison
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

      return true;
    });
  }, [tickets, filterId, filterStartDate, filterEndDate, filterStatus, filterPerson]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const currentTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(start, start + itemsPerPage);
  }, [filteredTickets, currentPage, itemsPerPage]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [filterId, filterStartDate, filterEndDate, filterStatus, filterPerson, itemsPerPage]);

  const getProgress = (ticket: InventoryTicket) => {
    let completedStages = 0;
    if (ticket.dispatchDate) completedStages++;
    for (const w of workflows) {
      if (ticket.stageDates && ticket.stageDates[w.id]) {
        completedStages++;
      } else {
        break;
      }
    }
    const totalStages = workflows.length + 1;
    const percentage = Math.round((completedStages / totalStages) * 100);
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
  };

  const handleStageUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingTicket || !selectedStageId) return;

    const timestamp = new Date(selectedDate).getTime();
    const newStageDates = { ...updatingTicket.stageDates, [selectedStageId]: timestamp };
    
    try {
      await updateTicket(updatingTicket.id, { stageDates: newStageDates });
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
      Math.max(1, Math.ceil((timestamp - updatingTicket.dispatchDate) / (1000 * 60 * 60 * 24))) : 1;

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

      // If ID changed, we need to create new doc and delete old one, but for simplicity here we assume we can just update other fields or we actually delete & recreate.
      // Firebase updateDoc doesn't change document ID. If they want to change ID, we must recreate.
      if (editFormData.id !== editingTicket.id) {
         // Firebase updateDoc doesn't change document ID. If they want to change ID, we must recreate.
         alert('如需更改單號，請刪除後重新派送。本次修改將不包含單號變更。');
      }

      await updateTicket(editingTicket.id, {
        ticketType: editFormData.ticketType,
        assigneeId: editFormData.assigneeId,
        dispatchDate: editFormData.dispatchDateStr ? new Date(editFormData.dispatchDateStr).getTime() : null,
        stageDates: newStageDates,
        // If they clear dates, we might need to clear closeDate too
        closeDate: Object.values(newStageDates).length === workflows.length ? editingTicket.closeDate : null
      });

      setEditingTicket(null);
      loadData();
    } catch (e) {
      alert('修改失敗');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📝 盤點單管理</h2>
        <div>
          <label>每頁筆數：</label>
          <select className="doodle-input" style={{ width: 'auto' }} value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>🔍 查詢條件</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>盤點單號：</label>
            <input className="doodle-input" style={{ width: '150px' }} value={filterId} onChange={e => setFilterId(e.target.value)} placeholder="輸入單號" />
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
          <button className="doodle-button" style={{ height: '42px' }} onClick={() => {
            setFilterId(''); setFilterStartDate(''); setFilterEndDate(''); setFilterStatus('all'); setFilterPerson('');
          }}>清除條件</button>
        </div>
      </div>

      <div style={{ marginBottom: '15px', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)' }}>
        👉 目前符合條件共 {filteredTickets.length} 筆資料
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {currentTickets.map((t, index) => {
          const progress = getProgress(t);
          const nextStage = getNextStage(t);
          const isFinished = !nextStage && t.closeDate;
          const isPendingApproval = !nextStage && !t.closeDate;
          // Calculate global sequence number
          const seqNum = (currentPage - 1) * itemsPerPage + index + 1;

          return (
            <div key={t.id} className="doodle-border" style={{ padding: '20px', position: 'relative' }}>
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
                  
                  <div style={{ margin: '15px 0' }}>
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
                  </div>
                  
                  {isFinished && (
                    <div style={{ marginTop: '5px', color: 'var(--crayon-green)', fontWeight: 'bold' }}>
                      ✓ 已結案 (主管：{t.managerName} | 處理天數：{t.totalProcessingDays} 天)
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px' }}>
                  <div style={{ 
                    padding: '5px 10px', borderRadius: '5px', fontSize: '0.85rem',
                    backgroundColor: t.dispatchDate ? '#e8f5e9' : '#f5f5f5',
                    border: `1px solid ${t.dispatchDate ? 'var(--crayon-green)' : '#ccc'}`
                  }}>
                    📤 派送：<br/>{t.dispatchDate ? new Date(t.dispatchDate).toLocaleDateString() : '-'}
                  </div>
                  {workflows.map(w => {
                    const isDone = t.stageDates && t.stageDates[w.id];
                    return (
                      <div key={w.id} style={{ 
                        padding: '5px 10px', borderRadius: '5px', fontSize: '0.85rem',
                        backgroundColor: isDone ? '#e8f5e9' : '#f5f5f5',
                        border: `1px solid ${isDone ? 'var(--crayon-green)' : '#ccc'}`,
                        color: isDone ? '#000' : '#888'
                      }}>
                        🔹 {w.name}：<br/>{isDone ? new Date(t.stageDates[w.id]).toLocaleDateString() : '-'}
                      </div>
                    )
                  })}
                  <div style={{ 
                    padding: '5px 10px', borderRadius: '5px', fontSize: '0.85rem',
                    backgroundColor: t.closeDate ? '#e8f5e9' : '#f5f5f5',
                    border: `1px solid ${t.closeDate ? 'var(--crayon-green)' : '#ccc'}`,
                    color: t.closeDate ? '#000' : '#888'
                  }}>
                    ✅ 結案：<br/>{t.closeDate ? new Date(t.closeDate).toLocaleDateString() : '-'}
                  </div>
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

      {/* Modals ... (Stage Update, Manager Approval, Delete Confirm, Edit Ticket) */}
      
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
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', backgroundColor: 'white', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>📝 修改盤點單 ({editingTicket.id})</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'flex', gap: '15px' }}>
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

              <div style={{ borderTop: '2px dashed #ccc', paddingTop: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>流程日期修改 (清除日期即可退回流程)</h4>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.9rem' }}>派送日期：</label>
                  <input type="date" className="doodle-input" value={editFormData.dispatchDateStr} onChange={e => setEditFormData({...editFormData, dispatchDateStr: e.target.value})} />
                </div>
                
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
            <p>即將推進至：<strong>{workflows.find(w => w.id === selectedStageId)?.name}</strong></p>
            <form onSubmit={handleStageUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div>
                <label>完成日期：</label>
                <input type="date" className="doodle-input" required value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>
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
                <input className="doodle-input" required value={managerName} onChange={e => setManagerName(e.target.value)} />
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
