import { useState, useEffect } from 'react';
import { getPersonnel, addTicket } from '../services/api';
import type { Personnel } from '../types';

export default function DispatchTickets() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);
  
  const [dispatchType, setDispatchType] = useState<'single' | 'multi'>('single');
  const [singleId, setSingleId] = useState('');
  const [multiStartId, setMultiStartId] = useState('');
  const [multiEndId, setMultiEndId] = useState('');
  
  // yyyy-MM-dd format for date input
  const today = new Date().toISOString().split('T')[0];
  const [dispatchDate, setDispatchDate] = useState(today);

  useEffect(() => {
    getPersonnel().then(setPersonnel);
  }, []);

  const parseIdSuffix = (idStr: string) => {
    const match = idStr.match(/(\d+)$/);
    if (!match) return { prefix: idStr, num: NaN, suffixLen: 0 };
    const numStr = match[1];
    const prefix = idStr.slice(0, idStr.length - numStr.length);
    return { prefix, num: parseInt(numStr, 10), suffixLen: numStr.length };
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return alert('請先選擇派送人員！');

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
      for (const id of idsToCreate) {
        await addTicket({
          id,
          title: id,
          assigneeId: selectedPerson.id,
          dispatchDate: timestamp,
          closeDate: null,
          stageDates: {},
          totalProcessingDays: null
        });
      }
      alert(`成功派送 ${idsToCreate.length} 筆盤點單！`);
      setSingleId('');
      setMultiStartId('');
      setMultiEndId('');
      setSelectedPerson(null);
    } catch (err: any) {
      alert('派送失敗：' + err.message);
    }
  };

  return (
    <div>
      <h2>📤 盤點單派送</h2>

      {/* 派送設定區 */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '30px', backgroundColor: '#f0f8ff' }}>
        <h3 style={{ borderBottom: '2px solid var(--crayon-dark)', paddingBottom: '10px' }}>派送設定</h3>
        <div style={{ display: 'flex', gap: '20px', marginTop: '15px', alignItems: 'center' }}>
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
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {/* 左側：人員列表 */}
        <div>
          <h3>1. 點選要派送的人員</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            {personnel.map(p => (
              <div 
                key={p.id} 
                className="doodle-border" 
                style={{ 
                  padding: '15px', 
                  cursor: 'pointer',
                  backgroundColor: selectedPerson?.id === p.id ? 'var(--crayon-yellow)' : 'var(--crayon-paper)',
                  transform: selectedPerson?.id === p.id ? 'scale(1.02)' : 'none'
                }}
                onClick={() => setSelectedPerson(p)}
              >
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{p.name}</div>
                <div style={{ color: '#555', fontSize: '0.9rem' }}>{p.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 右側：輸入單號 */}
        <div>
          <h3>2. 輸入單號並派送</h3>
          {selectedPerson ? (
            <div className="doodle-border" style={{ padding: '20px', marginTop: '15px' }}>
              <p>目前選擇：<strong>{selectedPerson.name} ({selectedPerson.title})</strong></p>
              <form onSubmit={handleDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                
                {dispatchType === 'single' ? (
                  <div>
                    <label>單筆盤點單號：</label>
                    <input className="doodle-input" placeholder="例如: 2607A1" required value={singleId} onChange={e => setSingleId(e.target.value)} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label>起始盤點單號：</label>
                      <input className="doodle-input" placeholder="例如: 260701" required value={multiStartId} onChange={e => setMultiStartId(e.target.value)} />
                    </div>
                    <div>
                      <label>結束盤點單號：</label>
                      <input className="doodle-input" placeholder="例如: 260705" required value={multiEndId} onChange={e => setMultiEndId(e.target.value)} />
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>系統將自動產生起迄區間內的所有連續編號單據。</p>
                  </>
                )}

                <button type="submit" className="doodle-button success" style={{ marginTop: '10px' }}>
                  確認派送
                </button>
              </form>
            </div>
          ) : (
            <div className="doodle-border" style={{ padding: '20px', marginTop: '15px', textAlign: 'center', color: '#888' }}>
              請先從左側選擇一位人員
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
