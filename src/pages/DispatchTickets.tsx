import { useState, useEffect } from 'react';
import { getPersonnel, addTicket, getWorkflows, getTickets } from '../services/api';
import type { Personnel, Workflow, InventoryTicket } from '../types';

export default function DispatchTickets() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  
  // Settings State
  const [dispatchType, setDispatchType] = useState<'single' | 'multi'>('single');
  const [ticketType, setTicketType] = useState<'夾鉗' | 'TKW'>('夾鉗');
  const today = new Date().toISOString().split('T')[0];
  const [dispatchDate, setDispatchDate] = useState(today);

  // Dispatch Modal State
  const [targetPerson, setTargetPerson] = useState<Personnel | null>(null);
  const [singleId, setSingleId] = useState('');
  const [multiStartId, setMultiStartId] = useState('');
  const [multiEndId, setMultiEndId] = useState('');

  // Success Modal
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allP, wData, tData] = await Promise.all([getPersonnel(), getWorkflows(), getTickets()]);
    const inventoryStaff = allP.filter(p => (p.roles || []).includes('盤點'));
    setPersonnel(inventoryStaff);
    setWorkflows(wData.sort((a,b) => a.order - b.order));
    setTickets(tData);
  };

  const parseIdSuffix = (idStr: string) => {
    const match = idStr.match(/(\d+)$/);
    if (!match) return { prefix: idStr, num: NaN, suffixLen: 0 };
    const numStr = match[1];
    const prefix = idStr.slice(0, idStr.length - numStr.length);
    return { prefix, num: parseInt(numStr, 10), suffixLen: numStr.length };
  };

  const getUnfinishedCount = (personId: string) => {
    return tickets.filter(t => t.assigneeId === personId && !t.closeDate).length;
  };

  const handleOpenDispatchModal = (p: Personnel) => {
    setTargetPerson(p);
    setSingleId('');
    setMultiStartId('');
    setMultiEndId('');
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPerson) return;

    const timestamp = new Date(dispatchDate).getTime();
    const idsToCreate: string[] = [];

    if (dispatchType === 'single') {
      if (!singleId) return alert('請輸入單據編號');
      idsToCreate.push(singleId);
    } else {
      if (!multiStartId || !multiEndId) return alert('請輸入起迄編號');
      const start = parseIdSuffix(multiStartId);
      const end = parseIdSuffix(multiEndId);

      if (start.prefix !== end.prefix || isNaN(start.num) || isNaN(end.num) || start.num > end.num) {
        return alert('起迄編號格式不正確或無法對應 (請確保結尾為數字，且前綴相同，如: 260701 ~ 260705)');
      }

      for (let i = start.num; i <= end.num; i++) {
        const paddedNum = i.toString().padStart(start.suffixLen, '0');
        idsToCreate.push(`${start.prefix}${paddedNum}`);
      }
    }

    try {
      const firstStage = workflows.length > 0 ? workflows[0] : null;
      const initialStageDates: Record<string, number> = {};
      if (firstStage) {
        initialStageDates[firstStage.id] = timestamp;
      }

      for (const id of idsToCreate) {
        await addTicket({
          id,
          title: id,
          ticketType,
          assigneeId: targetPerson.id,
          dispatchDate: timestamp,
          closeDate: null,
          stageDates: initialStageDates,
          totalProcessingDays: null
        });
      }
      
      setSuccessMessage(`成功派送 ${idsToCreate.length} 筆盤點單給 ${targetPerson.name}！`);
      setTargetPerson(null);
      loadData(); // Refresh tickets to update unfinished counts
    } catch (err: any) {
      alert('派送失敗：' + err.message);
    }
  };

  return (
    <div>
      <h2>📤 盤點單派送</h2>

      {/* 派送通用設定區 */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '30px', backgroundColor: '#f0f8ff' }}>
        <h3 style={{ borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px', marginTop: 0 }}>⚙️ 通用派送設定</h3>
        <div style={{ display: 'flex', gap: '20px', marginTop: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontWeight: 'bold', marginRight: '10px' }}>派送模式：</label>
            <select className="doodle-input" style={{ width: 'auto' }} value={dispatchType} onChange={e => setDispatchType(e.target.value as 'single' | 'multi')}>
              <option value="single">單筆派送</option>
              <option value="multi">多筆批次派送</option>
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 'bold', marginRight: '10px' }}>派送日期：</label>
            <input type="date" className="doodle-input" style={{ width: 'auto' }} value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontWeight: 'bold', marginRight: '10px' }}>盤點類型：</label>
            <select className="doodle-input" style={{ width: 'auto' }} value={ticketType} onChange={e => setTicketType(e.target.value as '夾鉗' | 'TKW')}>
              <option value="夾鉗">夾鉗</option>
              <option value="TKW">TKW</option>
            </select>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: '20px', color: 'var(--crayon-dark)' }}>👉 點選人員進行派送</h3>

      {/* 人員卡片網格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {personnel.map(p => {
          const unfinished = getUnfinishedCount(p.id);
          return (
            <div 
              key={p.id} 
              className="doodle-border" 
              style={{ 
                padding: '20px', 
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}
            >
              <div style={{ marginBottom: '15px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', borderBottom: '2px solid var(--crayon-dark)', paddingBottom: '5px' }}>
                  👤 {p.name}
                </h3>
                <div style={{ color: '#555', fontSize: '1rem' }}>{p.title}</div>
              </div>

              {/* 未完成單據數量 (塗鴉標籤風格) */}
              <div style={{ 
                alignSelf: 'center',
                backgroundColor: unfinished > 0 ? '#ffebee' : '#e8f5e9',
                border: `3px solid ${unfinished > 0 ? 'var(--crayon-red)' : 'var(--crayon-green)'}`,
                borderRadius: '15px',
                padding: '10px 20px',
                marginBottom: '20px',
                transform: 'rotate(-2deg)',
                textAlign: 'center',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#555' }}>目前未完成</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: unfinished > 0 ? 'var(--crayon-red)' : 'var(--crayon-green)', lineHeight: 1 }}>
                  {unfinished} <span style={{ fontSize: '1rem' }}>件</span>
                </div>
              </div>

              <button 
                className="doodle-button success" 
                style={{ width: '100%', fontSize: '1.2rem', padding: '10px' }}
                onClick={() => handleOpenDispatchModal(p)}
              >
                📤 派送盤點單
              </button>
            </div>
          )
        })}
        {personnel.length === 0 && (
          <p style={{ color: '#888', gridColumn: '1 / -1' }}>目前沒有具備「盤點」職責的人員。請先至人員管理設定職責。</p>
        )}
      </div>

      {/* 輸入單號的派送 Modal */}
      {targetPerson && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'var(--crayon-paper)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--crayon-blue)' }}>📤 派送給：{targetPerson.name}</h3>
            
            <div style={{ 
              backgroundColor: 'white', padding: '10px', borderRadius: '5px', 
              border: '1px dashed #ccc', marginBottom: '20px', fontSize: '0.9rem' 
            }}>
              <strong>目前設定：</strong><br/>
              模式: {dispatchType === 'single' ? '單筆' : '多筆批次'} | 類型: {ticketType} | 日期: {dispatchDate}
            </div>

            <form onSubmit={handleDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {dispatchType === 'single' ? (
                <div>
                  <label style={{ fontWeight: 'bold' }}>輸入單筆盤點單號：</label>
                  <input className="doodle-input" placeholder="例如: 2607A1" required value={singleId} onChange={e => setSingleId(e.target.value)} />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontWeight: 'bold' }}>起始盤點單號：</label>
                    <input className="doodle-input" placeholder="例如: 260701" required value={multiStartId} onChange={e => setMultiStartId(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 'bold' }}>結束盤點單號：</label>
                    <input className="doodle-input" placeholder="例如: 260705" required value={multiEndId} onChange={e => setMultiEndId(e.target.value)} />
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>* 系統將自動產生起迄區間內的所有連續編號單據。</p>
                </>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="doodle-button success" style={{ flex: 1 }}>確認送出</button>
                <button type="button" className="doodle-button danger" style={{ flex: 1 }} onClick={() => setTargetPerson(null)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 客製化成功視窗 */}
      {successMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '10px' }}>🎉</div>
            <h3 style={{ color: 'var(--crayon-green)', fontSize: '2rem', marginTop: 0 }}>派送成功</h3>
            <p style={{ fontSize: '1.2rem', marginBottom: '25px', fontWeight: 'bold' }}>{successMessage}</p>
            <button className="doodle-button success" onClick={() => setSuccessMessage('')}>
              繼續派送
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
