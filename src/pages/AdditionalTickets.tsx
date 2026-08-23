import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTickets, addTicket, deleteTicket, getPersonnel } from '../services/api';
import type { InventoryTicket, Personnel } from '../types';
import CrayonDatePicker from '../components/CrayonDatePicker';

export default function AdditionalTickets() {
  const { hasPermission } = useAuth();
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemAlert, setSystemAlert] = useState<{ message: string, onConfirm?: () => void } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Dispatch Modal State
  const [targetPerson, setTargetPerson] = useState<Personnel | null>(null);
  const [newId, setNewId] = useState('');
  const [itemCount, setItemCount] = useState<string>('');
  const [completionDate, setCompletionDate] = useState<string>('');

  const loadData = async () => {
    try {
      const [ticketsData, personnelData] = await Promise.all([
        getTickets(),
        getPersonnel()
      ]);
      setTickets(ticketsData.filter(t => t.isAdditional).sort((a, b) => (b.dispatchDate || 0) - (a.dispatchDate || 0)));
      setPersonnel(personnelData);
    } catch (e) {
      console.error(e);
      setSystemAlert({ message: '讀取失敗' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (p: Personnel) => {
    setTargetPerson(p);
    setNewId('');
    setItemCount('');
    setCompletionDate(new Date().toISOString().split('T')[0]);
  };

  const handleAdd = async () => {
    if (!targetPerson) return;
    if (!newId.trim() || !itemCount || !completionDate) {
      return setSystemAlert({ message: '請填寫完整資訊' });
    }

    if (tickets.some(t => t.id === newId.trim())) {
      return setSystemAlert({ message: '此單號已存在' });
    }

    const timestamp = new Date(completionDate).getTime();
    const count = parseInt(itemCount, 10);
    if (isNaN(count) || count <= 0) {
      return setSystemAlert({ message: '項目數必須是大於0的整數' });
    }

    const ticket: InventoryTicket = {
      id: newId.trim(),
      title: newId.trim(),
      ticketType: '追加',
      isAdditional: true,
      assigneeId: targetPerson.id,
      dispatchDate: timestamp,
      closeDate: timestamp,
      stageDates: {},
      totalProcessingDays: 0,
      itemCount: count,
    };

    try {
      await addTicket(ticket);
      setTargetPerson(null);
      loadData();
    } catch (err) {
      console.error(err);
      setSystemAlert({ message: '新增失敗' });
    }
  };

  const handleDeletePrompt = (id: string) => {
    setSystemAlert({
      message: `確定要刪除追加單 ${id} 嗎？`,
      onConfirm: async () => {
        try {
          await deleteTicket(id);
          setSystemAlert(null);
          loadData();
        } catch (err) {
          console.error(err);
          setSystemAlert({ message: '刪除失敗' });
        }
      }
    });
  };

  if (loading) return <div className="doodle-border" style={{ padding: '20px' }}>載入中...</div>;

  const canEdit = hasPermission('tickets', 'edit');
  const assigneeOptions = personnel.filter(p => (p.roles || []).includes('盤點'));

  // Pagination Logic
  const totalItemsCount = tickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
  const totalPages = Math.ceil(tickets.length / itemsPerPage);
  const paginatedTickets = tickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '2.5rem', color: 'var(--crayon-blue)' }}>
        ➕ 追加盤點
      </h2>

      {/* System Alert Modal */}
      {systemAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'white', textAlign: 'center' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{systemAlert.message}</p>
            <div style={{ marginTop: '25px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
              {systemAlert.onConfirm && (
                <button className="doodle-button danger" onClick={systemAlert.onConfirm}>確認</button>
              )}
              <button className="doodle-button" onClick={() => setSystemAlert(null)}>
                {systemAlert.onConfirm ? '取消' : '確定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {targetPerson && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', backgroundColor: '#e3f2fd' }}>
            <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>指派追加單給 {targetPerson.name}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>追加單號：</label>
                <input 
                  type="text" 
                  className="doodle-input" 
                  value={newId}
                  onChange={e => setNewId(e.target.value)}
                  placeholder="例如: 260801"
                  style={{ width: '100%' }}
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
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>完成日期：</label>
                <CrayonDatePicker 
                  value={completionDate}
                  onChange={setCompletionDate}
                  placeholder="選擇日期"
                />
              </div>
              
              <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                <button className="doodle-button" style={{ flex: 1 }} onClick={handleAdd}>確定新增</button>
                <button className="doodle-button danger" style={{ flex: 1 }} onClick={() => setTargetPerson(null)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Personnel Cards for Dispatch */}
      {canEdit && (
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ marginBottom: '15px', color: 'var(--crayon-dark)' }}>👥 點選人員派送追加單</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
            {assigneeOptions.map(p => {
              const personTickets = tickets.filter(t => t.assigneeId === p.id);
              const personItems = personTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
              return (
                <div key={p.id} className="doodle-border" style={{ padding: '15px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--crayon-purple)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    已完成: {personTickets.length} 單 / {personItems} 項
                  </div>
                  <button 
                    className="doodle-button"
                    style={{ marginTop: 'auto' }}
                    onClick={() => handleOpenModal(p)}
                  >
                    ➕ 追加派送
                  </button>
                </div>
              );
            })}
            {assigneeOptions.length === 0 && (
              <p style={{ color: '#888', gridColumn: '1 / -1' }}>目前沒有具備「盤點」權限的人員。</p>
            )}
          </div>
        </div>
      )}

      {/* Statistics and Pagination Controls */}
      <div className="doodle-border" style={{ padding: '15px', marginBottom: '20px', backgroundColor: '#fff9c4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ fontSize: '1.1rem' }}>
          <strong style={{ color: 'var(--crayon-orange)' }}>總計追加：</strong>
          <span style={{ margin: '0 15px' }}>共 {tickets.length} 單</span>
          <span>共 {totalItemsCount} 項</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>每頁顯示：</label>
          <select 
            className="doodle-input"
            value={itemsPerPage}
            onChange={e => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{ padding: '5px', width: '80px' }}
          >
            {[10, 20, 30, 40, 50].map(num => (
              <option key={num} value={num}>{num} 筆</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
        {paginatedTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontStyle: 'italic', border: '2px dashed #ccc', borderRadius: '10px' }}>
            目前沒有追加盤點紀錄
          </div>
        ) : (
          paginatedTickets.map((t, idx) => {
            const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
            const assigneeName = personnel.find(p => p.id === t.assigneeId)?.name || '未知人員';
            const dateStr = t.closeDate ? new Date(t.closeDate).toISOString().split('T')[0] : '';
            return (
              <div key={t.id} className="doodle-border" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', backgroundColor: 'white', gap: '15px' }}>
                {canEdit && (
                  <button 
                    onClick={() => handleDeletePrompt(t.id)} 
                    className="doodle-button danger"
                    title="刪除"
                    style={{ padding: '8px 12px', fontSize: '0.9rem', flexShrink: 0 }}
                  >
                    🗑️ 刪除
                  </button>
                )}
                
                <div style={{ 
                  backgroundColor: 'var(--crayon-purple)', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '35px', 
                  height: '35px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  flexShrink: 0
                }}>
                  {actualIndex}
                </div>
                
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 8px 0', color: 'var(--crayon-dark)' }}>單號: {t.id}</h3>
                  <div style={{ display: 'flex', gap: '20px', color: '#555', flexWrap: 'wrap', fontSize: '0.95rem' }}>
                    <span><strong style={{ color: 'var(--crayon-blue)' }}>負責人員:</strong> {assigneeName}</span>
                    <span><strong style={{ color: 'var(--crayon-orange)' }}>項目數:</strong> {t.itemCount} 項</span>
                    <span><strong style={{ color: 'var(--crayon-green)' }}>完成日期:</strong> {dateStr}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Nav */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
          <button 
            className="doodle-button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            上一頁
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            第 {currentPage} / {totalPages} 頁
          </div>
          <button 
            className="doodle-button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
