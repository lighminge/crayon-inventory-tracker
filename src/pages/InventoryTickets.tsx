import { useState, useEffect } from 'react';
import { InventoryTicket, Personnel, TicketStatus } from '../types';
import { getTickets, addTicket, updateTicket, deleteTicket, getPersonnel } from '../services/api';

export default function InventoryTicketsPage() {
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isManagerFormOpen, setIsManagerFormOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [managerName, setManagerName] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    assigneeId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [tData, pData] = await Promise.all([getTickets(), getPersonnel()]);
    setTickets(tData);
    setPersonnel(pData);
  };

  const getAssigneeName = (id: string) => {
    const p = personnel.find(p => p.id === id);
    return p ? p.name : '未知人員';
  };

  const handleOpenForm = () => {
    setFormData({ title: '', assigneeId: personnel[0]?.id || '' });
    setIsFormOpen(true);
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assigneeId) return alert('請先新增備料人員');
    
    await addTicket({
      title: formData.title,
      assigneeId: formData.assigneeId,
      status: 'In Progress',
      dispatchDate: Date.now(),
      returnDate: null,
      confirmDate: null,
      approvalDate: null,
      closeDate: null,
      managerName: '',
      totalProcessingDays: null
    });
    setIsFormOpen(false);
    loadData();
  };

  const updateStatus = async (ticket: InventoryTicket, newStatus: TicketStatus) => {
    const updates: Partial<InventoryTicket> = { status: newStatus };
    const now = Date.now();
    
    if (newStatus === 'Returned') updates.returnDate = now;
    if (newStatus === 'Confirmed') updates.confirmDate = now;
    
    await updateTicket(ticket.id, updates);
    loadData();
  };

  const handleOpenManagerForm = (id: string) => {
    setSelectedTicketId(id);
    setManagerName('');
    setIsManagerFormOpen(true);
  };

  const handleApproveAndClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId) return;
    
    const ticket = tickets.find(t => t.id === selectedTicketId);
    if (!ticket || !ticket.dispatchDate) return;

    const now = Date.now();
    const processingDays = Math.max(1, Math.ceil((now - ticket.dispatchDate) / (1000 * 60 * 60 * 24)));

    await updateTicket(selectedTicketId, {
      status: 'Approved & Closed',
      approvalDate: now,
      closeDate: now,
      managerName: managerName,
      totalProcessingDays: processingDays
    });

    setIsManagerFormOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除這張單據嗎？')) {
      await deleteTicket(id);
      loadData();
    }
  };

  const formatDate = (ms: number | null) => {
    if (!ms) return '-';
    return new Date(ms).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📝 盤點單管理</h2>
        <button className="doodle-button" onClick={handleOpenForm}>＋ 派送新盤點單</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {tickets.map(t => (
          <div key={t.id} className="doodle-border" style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 10px 0' }}>{t.title}</h3>
              <p><strong>負責人員：</strong> {getAssigneeName(t.assigneeId)}</p>
              <p><strong>狀態：</strong> <span style={{ color: 'var(--crayon-blue)', fontWeight: 'bold' }}>{t.status}</span></p>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                <div>派送：{formatDate(t.dispatchDate)}</div>
                <div>繳回：{formatDate(t.returnDate)}</div>
                <div>確認：{formatDate(t.confirmDate)}</div>
                <div>結案：{formatDate(t.closeDate)}</div>
              </div>
              {t.status === 'Approved & Closed' && (
                <div style={{ marginTop: '10px', color: 'var(--crayon-purple)' }}>
                  <strong>主管：</strong> {t.managerName} | <strong>處理天數：</strong> {t.totalProcessingDays} 天
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '150px' }}>
              {t.status === 'In Progress' && (
                <button className="doodle-button success" onClick={() => updateStatus(t, 'Returned')}>標記為繳回</button>
              )}
              {t.status === 'Returned' && (
                <button className="doodle-button" onClick={() => updateStatus(t, 'Confirmed')}>資料確認</button>
              )}
              {t.status === 'Confirmed' && (
                <button className="doodle-button" style={{ backgroundColor: 'var(--crayon-orange)' }} onClick={() => handleOpenManagerForm(t.id)}>主管審核結案</button>
              )}
              <button className="doodle-button danger" onClick={() => handleDelete(t.id)}>刪除單據</button>
            </div>
          </div>
        ))}
        {tickets.length === 0 && <p>目前沒有盤點單資料。</p>}
      </div>

      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px' }}>
            <h3>派送新盤點單</h3>
            <form onSubmit={handleDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div>
                <label>單據名稱/描述：</label>
                <input className="doodle-input" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div>
                <label>派送給 (備料人員)：</label>
                <select className="doodle-input" required value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}>
                  {personnel.map(p => <option key={p.id} value={p.id}>{p.name} ({p.title})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="doodle-button success" style={{ flex: 1 }}>確定派送</button>
                <button type="button" className="doodle-button danger" style={{ flex: 1 }} onClick={() => setIsFormOpen(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isManagerFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px' }}>
            <h3>主管審核結案</h3>
            <form onSubmit={handleApproveAndClose} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
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
