import React, { useState, useEffect } from 'react';
import type { InventoryTicket } from '../types';
import { updateTicket } from '../services/api';

interface Props {
  ticket: InventoryTicket;
  onUpdate: () => void;
  canEdit: boolean;
}

export default function RecountPanel({ ticket, onUpdate, canEdit }: Props) {
  const [hasRecount, setHasRecount] = useState(!!ticket.hasRecount);
  const [recountItems, setRecountItems] = useState<Record<string, string>>(ticket.recountItems || {});
  const [defaultDate, setDefaultDate] = useState<string>(ticket.defaultRecountDate || new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!!ticket.hasRecount);

  useEffect(() => {
    setHasRecount(!!ticket.hasRecount);
    setRecountItems(ticket.recountItems || {});
    setDefaultDate(ticket.defaultRecountDate || new Date().toISOString().split('T')[0]);
    if (ticket.hasRecount) setIsExpanded(true);
  }, [ticket]);

  const handleSave = async (newHasRecount: boolean, newItems: Record<string, string>, newDefaultDate: string) => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await updateTicket(ticket.id, {
        hasRecount: newHasRecount,
        recountItems: newItems,
        defaultRecountDate: newDefaultDate
      });
      onUpdate();
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleHasRecount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setHasRecount(checked);
    setIsExpanded(checked);
    handleSave(checked, recountItems, defaultDate);
  };

  const toggleItem = (itemNum: number) => {
    const key = String(itemNum);
    const newItems = { ...recountItems };
    if (newItems[key] !== undefined) {
      delete newItems[key];
    } else {
      newItems[key] = ''; // Checked, but no specific date yet
    }
    setRecountItems(newItems);
    handleSave(hasRecount, newItems, defaultDate);
  };

  const handleDateChange = (itemNum: number, date: string) => {
    const key = String(itemNum);
    const newItems = { ...recountItems, [key]: date };
    setRecountItems(newItems);
    handleSave(hasRecount, newItems, defaultDate);
  };

  const handleDefaultDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDefaultDate(val);
    handleSave(hasRecount, recountItems, val);
  };

  if (!canEdit && !ticket.hasRecount) return null;

  const itemCount = ticket.itemCount || 0;

  return (
    <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff8e1', borderRadius: '10px', border: '2px dashed var(--crayon-orange)' }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: canEdit ? 'pointer' : 'default', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-orange)' }}>
        <input 
          type="checkbox" 
          checked={hasRecount} 
          onChange={toggleHasRecount} 
          disabled={!canEdit || isSaving}
          style={{ width: '20px', height: '20px', marginRight: '10px' }}
        />
        🔍 複盤項目 {isSaving && <span style={{ fontSize: '0.9rem', color: '#888', marginLeft: '10px', fontWeight: 'normal' }}>(儲存中...)</span>}
      </label>

      {isExpanded && (
        <div style={{ marginTop: '15px' }}>
          <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 'bold' }}>預設複盤完成日：</span>
            <input 
              type="date" 
              className="doodle-input" 
              style={{ padding: '5px', width: 'auto' }}
              value={defaultDate}
              onChange={handleDefaultDateChange}
              disabled={!canEdit || isSaving}
            />
            <span style={{ fontSize: '0.85rem', color: '#666' }}>(所有勾選的項目預設將套用此日期)</span>
          </div>

          {itemCount === 0 ? (
            <div style={{ color: '#888', fontStyle: 'italic' }}>此盤點單尚未設定項目數量，無法勾選明細。</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
              {Array.from({ length: itemCount }).map((_, idx) => {
                const itemNum = idx + 1;
                const key = String(itemNum);
                const isChecked = recountItems[key] !== undefined;
                const itemDate = isChecked ? (recountItems[key] || '') : '';

                return (
                  <div key={itemNum} style={{ 
                    display: 'flex', flexDirection: 'column', gap: '5px', 
                    padding: '10px', borderRadius: '8px', 
                    backgroundColor: isChecked ? '#e8f5e9' : '#fff',
                    border: `2px solid ${isChecked ? 'var(--crayon-green)' : '#ccc'}`,
                    width: '140px'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: canEdit ? 'pointer' : 'default', fontWeight: 'bold' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => canEdit && toggleItem(itemNum)}
                        disabled={!canEdit || isSaving}
                        style={{ marginRight: '8px', width: '16px', height: '16px' }}
                      />
                      項目 #{itemNum}
                    </label>
                    {isChecked && (
                      <input 
                        type="date"
                        className="doodle-input"
                        style={{ padding: '2px 5px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                        value={itemDate || defaultDate}
                        onChange={(e) => canEdit && handleDateChange(itemNum, e.target.value)}
                        disabled={!canEdit || isSaving}
                        title="此項目的獨立完成日"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
