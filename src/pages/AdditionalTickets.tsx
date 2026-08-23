import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTickets, addTicket, deleteTicket, getPersonnel } from '../services/api';
import type { InventoryTicket, Personnel } from '../types';
import CrayonDatePicker from '../components/CrayonDatePicker';

export default function AdditionalTickets() {
  const { hasPermission } = useAuth();
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [newId, setNewId] = useState('');
  const [itemCount, setItemCount] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState('');
  const [completionDate, setCompletionDate] = useState<string>('');

  const loadData = async () => {
    try {
      const [ticketsData, personnelData] = await Promise.all([
        getTickets(),
        getPersonnel()
      ]);
      setTickets(ticketsData.filter(t => t.isAdditional));
      setPersonnel(personnelData);
    } catch (e) {
      console.error(e);
      alert('讀取失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !itemCount || !assigneeId || !completionDate) {
      return alert('請填寫完整資訊');
    }

    if (tickets.some(t => t.id === newId.trim())) {
      return alert('此單號已存在');
    }

    const timestamp = new Date(completionDate).getTime();
    const count = parseInt(itemCount, 10);
    if (isNaN(count) || count <= 0) {
      return alert('項目數必須是大於0的整數');
    }

    const ticket: InventoryTicket = {
      id: newId.trim(),
      title: newId.trim(),
      ticketType: '追加',
      isAdditional: true,
      assigneeId: assigneeId,
      dispatchDate: timestamp,
      closeDate: timestamp,
      stageDates: {},
      totalProcessingDays: 0,
      itemCount: count,
    };

    try {
      await addTicket(ticket);
      setNewId('');
      setItemCount('');
      setAssigneeId('');
      setCompletionDate('');
      loadData();
    } catch (err) {
      console.error(err);
      alert('新增失敗');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(`確定要刪除追加單 ${id} 嗎？`)) {
      try {
        await deleteTicket(id);
        loadData();
      } catch (err) {
        console.error(err);
        alert('刪除失敗');
      }
    }
  };

  if (loading) return <div className="doodle-border" style={{ padding: '20px' }}>載入中...</div>;

  const canEdit = hasPermission('tickets', 'edit');
  const assigneeOptions = personnel.filter(p => (p.roles || []).includes('盤點'));

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '2.5rem', color: 'var(--crayon-blue)' }}>
        ➕ 追加盤點
      </h2>

      {canEdit && (
        <form onSubmit={handleAdd} className="doodle-border" style={{ padding: '20px', marginBottom: '30px', backgroundColor: '#e3f2fd' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>新增追加單</h3>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>追加單號：</label>
              <input 
                type="text" 
                className="doodle-input" 
                value={newId}
                onChange={e => setNewId(e.target.value)}
                placeholder="例如: 260801"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>項目數：</label>
              <input 
                type="number" 
                className="doodle-input" 
                value={itemCount}
                onChange={e => setItemCount(e.target.value)}
                placeholder="例如: 15"
                min="1"
                required
                style={{ width: '100px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>盤點人員：</label>
              <select 
                className="doodle-input" 
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                required
              >
                <option value="">- 選擇人員 -</option>
                {assigneeOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ width: '200px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>完成日期：</label>
              <CrayonDatePicker 
                value={completionDate}
                onChange={setCompletionDate}
                placeholder="選擇日期"
              />
            </div>
            <div style={{ alignSelf: 'flex-end', paddingBottom: '2px' }}>
              <button type="submit" className="doodle-button" style={{ padding: '12px 25px' }}>
                新增
              </button>
            </div>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontStyle: 'italic' }}>
            目前沒有追加盤點紀錄
          </div>
        ) : (
          tickets.map(t => {
            const assigneeName = personnel.find(p => p.id === t.assigneeId)?.name || '未知人員';
            const dateStr = t.closeDate ? new Date(t.closeDate).toISOString().split('T')[0] : '';
            return (
              <div key={t.id} className="doodle-border" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
                <div>
                  <h3 style={{ margin: '0 0 10px 0', color: 'var(--crayon-dark)' }}>單號: {t.id}</h3>
                  <div style={{ display: 'flex', gap: '20px', color: '#555', flexWrap: 'wrap' }}>
                    <span><strong style={{ color: 'var(--crayon-blue)' }}>負責人員:</strong> {assigneeName}</span>
                    <span><strong style={{ color: 'var(--crayon-orange)' }}>項目數:</strong> {t.itemCount} 項</span>
                    <span><strong style={{ color: 'var(--crayon-green)' }}>完成日期:</strong> {dateStr}</span>
                  </div>
                </div>
                {canEdit && (
                  <button 
                    onClick={() => handleDelete(t.id)} 
                    className="doodle-button danger"
                    title="刪除"
                  >
                    🗑️ 刪除
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
