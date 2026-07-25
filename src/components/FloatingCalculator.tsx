import { useState, useEffect, useMemo, useRef } from 'react';
import CrayonDatePicker from './CrayonDatePicker';
import { getPersonnel } from '../services/api';
import type { Personnel } from '../types';

export default function FloatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State for calculation
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [containerType, setContainerType] = useState('T'); // T, P, B
  const [grossWeight, setGrossWeight] = useState<number | ''>(''); // kg
  const [containerCount, setContainerCount] = useState<number | ''>(''); // integer
  const [containerUnitWeight, setContainerUnitWeight] = useState<number | ''>(''); // kg
  const [materialUnitWeight, setMaterialUnitWeight] = useState<number | ''>(''); // g
  const [preparerId, setPreparerId] = useState('');
  
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  
  useEffect(() => {
    getPersonnel().then(setPersonnel).catch(console.error);
  }, []);

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
    return Math.ceil(netWeightInGrams / muw);
  }, [netWeight, materialUnitWeight]);

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
                <span style={{ fontSize: '0.9rem', color: '#555' }}>物料總數 (系統無條件進位)</span>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--crayon-red)' }}>
                  {totalItemCount} <span style={{fontSize: '1rem'}}>項</span>
                </div>
              </div>
            </div>
            
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
          </div>
        </div>
      )}
    </div>
  );
}
