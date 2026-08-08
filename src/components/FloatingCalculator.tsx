import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CrayonDatePicker from './CrayonDatePicker';
import { getPersonnel, checkItemDetailExists, saveItemDetail, getTickets, getExistingSubItems } from '../services/api';
import type { Personnel, InventoryItemDetail, InventoryTicket } from '../types';

export default function FloatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEditItemDetails = hasPermission('itemDetails', 'edit');
  
  // State for calculation
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [containerType, setContainerType] = useState('T'); // T, P, B
  const [grossWeight, setGrossWeight] = useState<number | ''>(''); // kg
  const [containerCount, setContainerCount] = useState<number | ''>(''); // integer
  const [containerUnitWeight, setContainerUnitWeight] = useState<number | ''>(''); // kg
  const [materialUnitWeight, setMaterialUnitWeight] = useState<number | ''>(''); // g
  const [preparerId, setPreparerId] = useState('');
  
  // Import State
  const [importTicketId, setImportTicketId] = useState('');
  const [importItemSeq, setImportItemSeq] = useState('001');
  const [importSubItemSeq, setImportSubItemSeq] = useState('1');
  const [existingSubItems, setExistingSubItems] = useState<InventoryItemDetail[]>([]);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [existingDetailId, setExistingDetailId] = useState<string | undefined>(undefined);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  
  useEffect(() => {
    getPersonnel().then(setPersonnel).catch(console.error);
    getTickets().then(setTickets).catch(console.error);
  }, []);

  useEffect(() => {
    if (importTicketId.trim()) {
      const ticket = tickets.find(t => t.id === importTicketId.trim());
      if (ticket && ticket.assigneeId) {
        setPreparerId(ticket.assigneeId);
      }
    }
  }, [importTicketId, tickets]);

  const currentTicket = useMemo(() => {
    return tickets.find(t => t.id === importTicketId.trim());
  }, [importTicketId, tickets]);

  const availableItemSeqs = useMemo(() => {
    if (!currentTicket || !currentTicket.itemCount) return [];
    const seqs = [];
    for (let i = 1; i <= currentTicket.itemCount; i++) {
      seqs.push(i.toString().padStart(3, '0'));
    }
    return seqs;
  }, [currentTicket]);

  useEffect(() => {
    if (availableItemSeqs.length > 0 && !availableItemSeqs.includes(importItemSeq)) {
      setImportItemSeq(availableItemSeqs[0]);
    }
  }, [availableItemSeqs, importItemSeq]);

  useEffect(() => {
    if (importTicketId.trim() && importItemSeq.trim()) {
      getExistingSubItems(importTicketId.trim(), importItemSeq.trim())
        .then(items => {
          setExistingSubItems(items);
          if (items.length > 0) {
            const sorted = [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            const latestWithMw = sorted.find(i => i.materialUnitWeight > 0);
            if (latestWithMw) {
              setMaterialUnitWeight(latestWithMw.materialUnitWeight);
            }
            const latestWithCt = sorted.find(i => i.containerType);
            if (latestWithCt) {
              setContainerType(latestWithCt.containerType);
            }
            const latestWithCw = sorted.find(i => i.containerUnitWeight > 0);
            if (latestWithCw) {
              setContainerUnitWeight(latestWithCw.containerUnitWeight);
            }
            const latestWithDate = sorted.find(i => i.date);
            if (latestWithDate) {
              setDate(latestWithDate.date || '');
            }
            
            const maxSeq = Math.max(...items.map(i => Number(i.subItemSeq)).filter(n => !isNaN(n)));
            setImportSubItemSeq(maxSeq >= 0 ? (maxSeq + 1).toString() : '1');
          } else {
            setImportSubItemSeq('1');
          }
        })
        .catch(console.error);
    } else {
      setExistingSubItems([]);
      setImportSubItemSeq('1');
    }
  }, [importTicketId, importItemSeq]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // 如果點擊的目標不是在 Calculator 容器內，就關閉它
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const preparers = useMemo(() => {
    // 尋找工作職責為「備料」或職稱為備料相關的人員
    return personnel.filter(p => (p.roles || []).includes('備料') || p.title.includes('備料'));
  }, [personnel]);

  // Derived state (Calculations)
  const netWeight = useMemo(() => {
    if (grossWeight === '' || containerCount === '' || containerUnitWeight === '') return 0;
    const gross = Number(grossWeight) || 0;
    const count = Number(containerCount) || 0;
    const unitWt = Number(containerUnitWeight) || 0;
    const nw = gross - (count * unitWt);
    return Math.max(0, nw); // Prevent negative net weight
  }, [grossWeight, containerCount, containerUnitWeight]);

  const totalItemCount = useMemo(() => {
    if (netWeight <= 0 || materialUnitWeight === '' || materialUnitWeight <= 0) return 0;
    const muw = Number(materialUnitWeight);
    const netWeightInGrams = netWeight * 1000;
    return Math.floor(netWeightInGrams / muw);
  }, [netWeight, materialUnitWeight]);

  const handleImport = async () => {
    if (!importTicketId.trim() || !importItemSeq.trim() || !importSubItemSeq.trim()) {
      setAlertMessage('請輸入盤點單號、項目編號與明細子項！');
      return;
    }
    if (grossWeight === '' || containerCount === '' || containerUnitWeight === '' || materialUnitWeight === '') {
      setAlertMessage('請先填寫完整的計算機欄位！');
      return;
    }

    try {
      const existing = await checkItemDetailExists(importTicketId.trim(), importItemSeq.trim(), importSubItemSeq.trim());
      if (existing) {
        setExistingDetailId(existing.id);
        setShowOverwriteModal(true);
      } else {
        await executeImport();
      }
    } catch (e) {
      console.error(e);
      setAlertMessage('檢查重複資料時發生錯誤');
    }
  };

  const executeImport = async (overwriteId?: string) => {
    try {
      const detail: Omit<InventoryItemDetail, 'id'> = {
        ticketId: importTicketId.trim(),
        itemSeq: importItemSeq.trim(),
        subItemSeq: importSubItemSeq.trim(),
        grossWeight: Number(grossWeight),
        containerType: containerType,
        containerCount: Number(containerCount),
        containerUnitWeight: Number(containerUnitWeight),
        materialUnitWeight: Number(materialUnitWeight),
        netWeight: Number(netWeight.toFixed(2)),
        date: date,
        totalItemCount: totalItemCount,
        createdAt: new Date().getTime(),
      };
      await saveItemDetail(detail, overwriteId);
      window.dispatchEvent(new Event('inventory_updated'));
      setAlertMessage('✅ 匯入成功！');
      setShowOverwriteModal(false);
      setExistingDetailId(undefined);
      // Auto-increment sub item sequence for next entry
      const currentSubSeq = parseInt(importSubItemSeq, 10);
      if (!isNaN(currentSubSeq)) {
        setImportSubItemSeq((currentSubSeq + 1).toString());
      }
      
      // Refresh existing sub-items
      getExistingSubItems(importTicketId.trim(), importItemSeq.trim())
        .then(setExistingSubItems)
        .catch(console.error);
        
    } catch (e) {
      console.error(e);
      setAlertMessage('匯入失敗');
    }
  };

  return (
    <div ref={containerRef}>
      {/* 浮動按鈕 */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="doodle-button"
        style={{
          position: 'fixed',
          left: '-5px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 999,
          writingMode: 'vertical-lr',
          padding: '15px 10px',
          borderTopLeftRadius: '0',
          borderBottomLeftRadius: '0',
          fontSize: '1.2rem',
          backgroundColor: 'var(--crayon-purple)',
          color: 'white',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
        }}
      >
        🧮 計算機
      </button>

      {/* 計算機面板 */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          left: '50px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1000,
          backgroundColor: 'white',
          padding: '25px',
          width: '350px',
          boxShadow: '5px 5px 15px rgba(0,0,0,0.3)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }} className="doodle-border">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, color: 'var(--crayon-purple)' }}>🧮 盤點計算機</h3>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--crayon-red)', fontWeight: 'bold' }}
            >
              ×
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* Import Section (Moved to top) */}
            <div style={{ backgroundColor: '#f0f8ff', padding: '15px', borderRadius: '8px', border: '2px dashed var(--crayon-blue)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--crayon-blue)' }}>📥 匯入設定</h4>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.85rem' }}>盤點單號</label>
                <input 
                  type="text" 
                  className="doodle-input" 
                  style={{ padding: '8px', width: '100%' }}
                  value={importTicketId} 
                  onChange={e => setImportTicketId(e.target.value)}
                  placeholder="輸入單號"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.85rem' }}>項目編號</label>
                  {availableItemSeqs.length > 0 ? (
                    <select 
                      className="doodle-input" 
                      style={{ padding: '8px', width: '100%', backgroundColor: 'white' }}
                      value={importItemSeq} 
                      onChange={e => setImportItemSeq(e.target.value)}
                    >
                      {availableItemSeqs.map(seq => (
                        <option key={seq} value={seq}>{seq}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      className="doodle-input" 
                      style={{ padding: '8px', width: '100%', backgroundColor: '#eee' }}
                      value={importItemSeq} 
                      onChange={e => setImportItemSeq(e.target.value)}
                      placeholder="請先輸入單號"
                      disabled
                      title="請先輸入正確的盤點單號"
                    />
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.85rem' }}>明細子項</label>
                  <input 
                    type="text" 
                    className="doodle-input" 
                    style={{ padding: '8px', width: '100%' }}
                    value={importSubItemSeq} 
                    onChange={e => setImportSubItemSeq(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
              {existingSubItems.length > 0 && (
                <div className="doodle-border" style={{
                  fontSize: '0.95rem',
                  color: 'white',
                  backgroundColor: 'var(--crayon-purple)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginTop: '10px',
                  border: '2px dashed white',
                  boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
                }}>
                  ✨ 已建立子項：<strong style={{ fontSize: '1.2rem', marginLeft: '5px' }}>{existingSubItems.map(i => Number(i.subItemSeq)).filter(n => !isNaN(n)).sort((a,b)=>a-b).join(', ')}</strong>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>📅 日期</label>
              <CrayonDatePicker value={date} onChange={setDate} />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>🧑‍🔧 備料人員</label>
              <select 
                className="doodle-input" 
                value={preparerId} 
                onChange={e => setPreparerId(e.target.value)}
              >
                <option value="">-- 請選擇人員 --</option>
                {preparers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>📦 容器類型</label>
              <select 
                className="doodle-input" 
                value={containerType} 
                onChange={e => setContainerType(e.target.value)}
              >
                <option value="T">鐵桶 (T)</option>
                <option value="P">塑膠箱 (P)</option>
                <option value="B">紙箱 (B)</option>
                <option value="L">摺疊籠 (L)</option>
                <option value="J">鐵架 (J)</option>
              </select>
            </div>
            
            <div style={{ padding: '10px', backgroundColor: '#f0f4c3', borderRadius: '8px', border: '1px solid #ccc' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>總重量 (含容器) [公斤]</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className="doodle-input" 
                  value={grossWeight} 
                  onChange={e => setGrossWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="請輸入總重"
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>容器數量</label>
                  <input 
                    type="number" 
                    step="1" 
                    min="0"
                    className="doodle-input" 
                    value={containerCount} 
                    onChange={e => setContainerCount(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                    placeholder="整數"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>容器單重 [公斤]</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    className="doodle-input" 
                    value={containerUnitWeight} 
                    onChange={e => setContainerUnitWeight(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="單重"
                  />
                </div>
              </div>
              
              <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '5px', border: '1px dashed var(--crayon-dark)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#555' }}>淨重 (系統自動計算)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--crayon-blue)' }}>
                  {netWeight.toFixed(2)} <span style={{fontSize: '1rem'}}>公斤</span>
                </div>
              </div>
            </div>
            
            <div style={{ padding: '10px', backgroundColor: '#e1bee7', borderRadius: '8px', border: '1px solid #ccc' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>物料單重 [公克]</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  className="doodle-input" 
                  value={materialUnitWeight} 
                  onChange={e => setMaterialUnitWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="請輸入物料單重"
                />
              </div>
              
              <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '5px', border: '2px dashed var(--crayon-red)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#555' }}>物料總數 (系統無條件捨去)</span>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>
                  {totalItemCount} <span style={{fontSize: '1rem'}}>個 (PCS)</span>
                </div>
              </div>
            </div>
            
            <button 
              className="doodle-button" 
              style={{ width: '100%', backgroundColor: canEditItemDetails ? 'var(--crayon-blue)' : '#ccc', color: 'white', marginTop: '10px', padding: '12px', fontSize: '1.1rem', cursor: canEditItemDetails ? 'pointer' : 'not-allowed' }}
              onClick={handleImport}
              disabled={!canEditItemDetails}
            >
              📥 匯入至此明細
            </button>
            
            <button 
              className="doodle-button" 
              style={{ width: '100%', marginTop: '5px' }}
              onClick={() => {
                setGrossWeight('');
                setContainerCount('');
                setContainerUnitWeight('');
                setMaterialUnitWeight('');
              }}
            >
              🔄 清空重設
            </button>
            
            <button 
              className="doodle-button" 
              style={{ width: '100%', marginTop: '15px', backgroundColor: 'var(--crayon-dark)', color: 'white' }}
              onClick={() => {
                setIsOpen(false);
                navigate('/item-details', { state: { openTicketId: importTicketId.trim() } });
              }}
            >
              📑 前往項目明細畫面
            </button>
          </div>
        </div>
      )}

      {/* Overwrite Warning Modal */}
      {showOverwriteModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10001
        }}>
          <div className="doodle-border" style={{ backgroundColor: 'white', padding: '30px', maxWidth: '400px', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--crayon-red)', marginTop: 0 }}>⚠️ 資料已存在</h3>
            <p>盤點單 <strong>{importTicketId}</strong> 的項目編號 <strong>{importItemSeq}</strong> - 子項 <strong>{importSubItemSeq}</strong> 已經有資料了。</p>
            <p>您確定要使用當前計算機的數據覆蓋它嗎？</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
              <button className="doodle-button" onClick={() => setShowOverwriteModal(false)}>取消</button>
              <button className="doodle-button" style={{ backgroundColor: 'var(--crayon-red)', color: 'white' }} onClick={() => executeImport(existingDetailId)}>確定覆蓋</button>
            </div>
          </div>
        </div>
      )}

      {/* Generic Alert Modal */}
      {alertMessage && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10001
        }}>
          <div className="doodle-border" style={{ backgroundColor: 'white', padding: '30px', maxWidth: '350px', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--crayon-purple)', marginTop: 0 }}>提示</h3>
            <p style={{ fontSize: '1.1rem', marginBottom: '20px' }}>{alertMessage}</p>
            <button className="doodle-button" style={{ width: '100%' }} onClick={() => setAlertMessage(null)}>確定</button>
          </div>
        </div>
      )}
    </div>
  );
}
