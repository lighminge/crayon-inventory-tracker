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

  // Manual Date Input State for stages
  const [updatingTicket, setUpdatingTicket] = useState<InventoryTicket | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Final Approval State
  const [isManagerFormOpen, setIsManagerFormOpen] = useState(false);
  const [managerName, setManagerName] = useState('');

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

  // Calculate progress for a ticket based on stageDates and workflows
  const getProgress = (ticket: InventoryTicket) => {
    let completedStages = 0;
    // Dispatch is stage 0
    if (ticket.dispatchDate) completedStages++;
    
    // Check remaining workflows in order
    for (const w of workflows) {
      if (ticket.stageDates && ticket.stageDates[w.id]) {
        completedStages++;
      } else {
        break; // Stop at the first incomplete stage
      }
    }
    const totalStages = workflows.length + 1; // dispatch + custom workflows
    const percentage = Math.round((completedStages / totalStages) * 100);
    return { completedStages, totalStages, percentage };
  };

  // Next Stage logic
  const getNextStage = (ticket: InventoryTicket): Workflow | null => {
    // If it's not even dispatched (shouldn't happen with our logic, but just in case)
    if (!ticket.dispatchDate) return null;
    
    for (const w of workflows) {
      if (!ticket.stageDates || !ticket.stageDates[w.id]) {
        return w;
      }
    }
    return null; // All stages completed
  };

  const openStageUpdate = (ticket: InventoryTicket, stage: Workflow) => {
    setUpdatingTicket(ticket);
    setSelectedStageId(stage.id);
    setSelectedDate(new Date().toISOString().split('T')[0]); // Default today
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

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除這張單據嗎？')) {
      await deleteTicket(id);
      loadData();
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(tickets.length / itemsPerPage);
  const currentTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return tickets.slice(start, start + itemsPerPage);
  }, [tickets, currentPage, itemsPerPage]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📝 盤點單管理</h2>
        <div>
          <label>每頁筆數：</label>
          <select className="doodle-input" style={{ width: 'auto' }} value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {currentTickets.map(t => {
          const progress = getProgress(t);
          const nextStage = getNextStage(t);
          const isFinished = !nextStage && t.closeDate;
          const isPendingApproval = !nextStage && !t.closeDate;

          return (
            <div key={t.id} className="doodle-border" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.5rem' }}>單號：{t.id}</h3>
                  <p><strong>負責人員：</strong> {getAssigneeName(t.assigneeId)}</p>
                  
                  {isFinished && (
                    <div style={{ marginTop: '5px', color: 'var(--crayon-purple)', fontWeight: 'bold' }}>
                      ✓ 已結案 (主管：{t.managerName} | 處理天數：{t.totalProcessingDays} 天)
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  {!isFinished && nextStage && (
                    <button className="doodle-button success" onClick={() => openStageUpdate(t, nextStage)}>推進: {nextStage.name}</button>
                  )}
                  {!isFinished && isPendingApproval && (
                    <button className="doodle-button" style={{ backgroundColor: 'var(--crayon-orange)' }} onClick={() => handleOpenManagerForm(t)}>主管核准結案</button>
                  )}
                  <button className="doodle-button danger" onClick={() => handleDelete(t.id)}>刪除</button>
                </div>
              </div>

              {/* Progress Bar & Stages Details */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' }}>
                  <span>進度：{progress.completedStages} / {progress.totalStages}</span>
                  <span>{progress.percentage}%</span>
                </div>
                <div style={{ width: '100%', height: '15px', border: '2px solid var(--crayon-dark)', borderRadius: '15px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress.percentage}%`, height: '100%', backgroundColor: 'var(--crayon-blue)' }}></div>
                </div>
                
                {/* Stage Date Logs */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '15px', fontSize: '0.85rem', color: '#555' }}>
                  <div>📤 派送：{t.dispatchDate ? new Date(t.dispatchDate).toLocaleDateString() : '-'}</div>
                  {workflows.map(w => (
                    <div key={w.id}>
                      🔹 {w.name}：{t.stageDates && t.stageDates[w.id] ? new Date(t.stageDates[w.id]).toLocaleDateString() : '-'}
                    </div>
                  ))}
                  {t.closeDate && <div>✅ 結案：{new Date(t.closeDate).toLocaleDateString()}</div>}
                </div>
              </div>
            </div>
          );
        })}
        {tickets.length === 0 && <p>目前沒有盤點單資料。</p>}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '30px' }}>
          <button className="doodle-button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一頁</button>
          <div style={{ padding: '8px 15px', fontWeight: 'bold' }}>{currentPage} / {totalPages}</div>
          <button className="doodle-button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一頁</button>
        </div>
      )}

      {/* Stage Update Modal */}
      {updatingTicket && selectedStageId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px' }}>
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

      {/* Manager Approval Modal */}
      {isManagerFormOpen && updatingTicket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px' }}>
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
