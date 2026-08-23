import React, { useState, useEffect } from 'react';
import type { InventoryTicket } from '../types';
import { updateTicket } from '../services/api';
import CrayonDatePicker from './CrayonDatePicker';

interface Props {
  ticket: InventoryTicket;
  onUpdate: () => void;
  canEdit: boolean;
}

export default function RecountPanel({ ticket, onUpdate, canEdit }: Props) {
  const [hasRecount, setHasRecount] = useState(!!ticket.hasRecount);
  const [recountItems, setRecountItems] = useState<Record<string, string>>(ticket.recountItems || {});
  const [totalRecountDate, setTotalRecountDate] = useState<string>(ticket.totalRecountCompletionDate || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setHasRecount(!!ticket.hasRecount);
    setRecountItems(ticket.recountItems || {});
    setTotalRecountDate(ticket.totalRecountCompletionDate || '');
  }, [ticket]);

  const checkedKeys = Object.keys(recountItems);
  const completedCount = checkedKeys.filter(k => !!recountItems[k]).length;
  const allCheckedCompleted = checkedKeys.length > 0 && completedCount === checkedKeys.length;
  const isMainLocked = checkedKeys.length > 0 && !allCheckedCompleted;

  const maxDate = checkedKeys.reduce((max, k) => {
    const d = recountItems[k];
    if (!d) return max;
    if (!max) return d;
    return d > max ? d : max;
  }, '');

  const handleSave = async (newHasRecount: boolean, newItems: Record<string, string>, newTotalDate: string) => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await updateTicket(ticket.id, {
        hasRecount: newHasRecount,
        recountItems: newItems,
        totalRecountCompletionDate: newTotalDate,
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
    handleSave(checked, recountItems, totalRecountDate);
  };

  const toggleItem = (itemNum: number) => {
    const key = String(itemNum);
    const newItems = { ...recountItems };
    if (newItems[key] !== undefined) {
      delete newItems[key];
    } else {
      newItems[key] = ''; // Check, empty date
    }
    setRecountItems(newItems);
    handleSave(hasRecount, newItems, totalRecountDate);
  };

  const handleDateChange = (itemNum: number, date: string) => {
    const key = String(itemNum);
    const newItems = { ...recountItems, [key]: date };
    setRecountItems(newItems);
    
    // Auto-update total date if all are now completed
    const newCheckedKeys = Object.keys(newItems);
    const newCompletedCount = newCheckedKeys.filter(k => !!newItems[k]).length;
    const newAllCompleted = newCheckedKeys.length > 0 && newCompletedCount === newCheckedKeys.length;
    
    let newTotalDate = totalRecountDate;
    if (newAllCompleted) {
      const newMaxDate = newCheckedKeys.reduce((max, k) => {
        const d = newItems[k];
        if (!d) return max;
        if (!max) return d;
        return d > max ? d : max;
      }, '');
      if (newMaxDate && (!newTotalDate || newTotalDate < newMaxDate)) {
        newTotalDate = newMaxDate;
        setTotalRecountDate(newMaxDate);
      }
    }

    handleSave(hasRecount, newItems, newTotalDate);
  };

  const handleTotalDateChange = (date: string) => {
    if (date && maxDate && date < maxDate) {
      alert(`整體完成日期不能早於最晚的項目完成日 (${maxDate})`);
      return;
    }
    setTotalRecountDate(date);
    handleSave(hasRecount, recountItems, date);
  };

  if (!canEdit && !ticket.hasRecount) return null;

  const itemCount = ticket.itemCount || 0;

  return (
    <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff8e1', borderRadius: '10px', border: '2px dashed var(--crayon-orange)' }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: (canEdit && !isMainLocked) ? 'pointer' : 'default', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-orange)' }}>
        <input 
          type="checkbox" 
          checked={hasRecount} 
          onChange={toggleHasRecount} 
          disabled={!canEdit || isSaving || isMainLocked}
          style={{ width: '20px', height: '20px', marginRight: '10px', accentColor: 'var(--crayon-orange)' }}
          title={isMainLocked ? "請先完成所有已選取的複盤項目，或取消選取" : ""}
        />
        🔍 複盤項目 
        {checkedKeys.length > 0 && (
           <span style={{ marginLeft: '10px', fontSize: '1rem', color: 'var(--crayon-dark)', backgroundColor: '#ffecb3', padding: '2px 8px', borderRadius: '5px', border: '1px solid var(--crayon-orange)' }}>
             (已選: {checkedKeys.length} 項 / 已完成: {completedCount} 項)
           </span>
        )}
        {isSaving && <span style={{ fontSize: '0.9rem', color: '#888', marginLeft: '10px', fontWeight: 'normal' }}>(儲存中...)</span>}
      </label>

      {hasRecount && (
        <div style={{ marginTop: '15px' }}>
          {itemCount === 0 ? (
            <div style={{ color: '#888', fontStyle: 'italic' }}>此盤點單尚未設定項目數量，無法勾選明細。</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
              {Array.from({ length: itemCount }).map((_, idx) => {
                const itemNum = idx + 1;
                const key = String(itemNum);
                const isChecked = recountItems[key] !== undefined;
                const itemDate = recountItems[key] || '';

                return (
                  <div key={itemNum} style={{ 
                    display: 'flex', flexDirection: 'column', gap: '8px', 
                    padding: '10px', borderRadius: '8px', 
                    backgroundColor: isChecked ? '#e8f5e9' : '#fff',
                    border: `2px solid ${isChecked ? 'var(--crayon-green)' : '#ccc'}`,
                    width: '180px'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: canEdit ? 'pointer' : 'default', fontWeight: 'bold', color: isChecked ? 'var(--crayon-dark)' : '#666' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => canEdit && toggleItem(itemNum)}
                        disabled={!canEdit || isSaving}
                        style={{ marginRight: '8px', width: '18px', height: '18px', accentColor: 'var(--crayon-green)' }}
                      />
                      項目 #{itemNum}
                    </label>
                    {isChecked && (
                      <div style={{ width: '100%' }}>
                        <CrayonDatePicker 
                           value={itemDate}
                           onChange={(val) => canEdit && handleDateChange(itemNum, val)}
                           disabled={!canEdit || isSaving}
                           placeholder="選擇完成日"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {allCheckedCompleted && (
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px dashed #ccc', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-green)' }}>✅ 整體複盤完成日期：</span>
              <div style={{ width: '180px' }}>
                <CrayonDatePicker 
                  value={totalRecountDate}
                  onChange={handleTotalDateChange}
                  disabled={!canEdit || isSaving}
                  placeholder="選擇整體完成日"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
