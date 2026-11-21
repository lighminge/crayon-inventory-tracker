import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { InventoryTicket, Workflow, StageNote, StageNoteTemplate } from '../types';
import { updateTicket } from '../services/api';

const LOCAL_STORAGE_KEY = 'crayon_stage_note_templates_v1';

const DEFAULT_TEMPLATES: StageNoteTemplate[] = [
  { id: 'tpl_1', content: '初盤數量與帳面不符，需進行複盤確認。', createdAt: 1 },
  { id: 'tpl_2', content: '現場儲位物料待確認，已通知備料人員協查。', createdAt: 2 },
  { id: 'tpl_3', content: '料號標示或容器單重待確認。', createdAt: 3 },
  { id: 'tpl_4', content: '已完成複盤核對，數量確認無誤。', createdAt: 4 },
  { id: 'tpl_5', content: '跨儲位物料合併盤點統計中。', createdAt: 5 },
  { id: 'tpl_6', content: '資料已彙整完畢，等待主管複核簽認。', createdAt: 6 }
];

const PUNCTUATION_SYMBOLS = [
  '，', '。', '、', '；', '：', '？', '！',
  '「', '」', '『', '』', '（', '）', '【', '】',
  '《', '》', '—', '～', '…', '·', '/', '－'
];

const SPECIAL_SYMBOLS = [
  '★', '☆', '✓', '✕', '※', '◎', '●', '○',
  '▲', '△', '■', '□', '◆', '◇', '→', '←',
  '↑', '↓', '↔', '⇒', '⚠️', '📌', '❗', '❓', '✅', '❌'
];

const NUMBER_UNIT_SYMBOLS = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '＃', '＆', '＊', '％', '±', '×', '÷', '＝', '＞', '＜'
];

const FONT_SIZE_OPTIONS = [
  { label: '12點 (小)', value: '12px' },
  { label: '14點 (標準)', value: '14px' },
  { label: '16點 (中)', value: '16px' },
  { label: '18點 (大)', value: '18px' },
  { label: '20點 (特大)', value: '20px' },
  { label: '24點 (超大)', value: '24px' }
];

const COLOR_PRESETS = [
  { label: '深黑', value: '#2c3e50' },
  { label: '紅', value: '#d32f2f' },
  { label: '藍', value: '#1976d2' },
  { label: '綠', value: '#2e7d32' },
  { label: '橘', value: '#e65100' },
  { label: '紫', value: '#7b1fa2' },
  { label: '棕', value: '#5d4037' }
];

const ALIGN_OPTIONS: { label: string; value: 'left' | 'center' | 'right' }[] = [
  { label: '⬅️ 靠左', value: 'left' },
  { label: '↔️ 置中', value: 'center' },
  { label: '➡️ 靠右', value: 'right' }
];

interface StageNoteModalProps {
  ticket: InventoryTicket;
  workflow: Workflow;
  stageIndex: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function StageNoteModal({
  ticket,
  workflow,
  stageIndex,
  onClose,
  onSaved
}: StageNoteModalProps) {
  const existingNote: StageNote | undefined = ticket.stageNotes?.[workflow.id];

  const [text, setText] = useState<string>(existingNote?.text || '');
  const [fontSize, setFontSize] = useState<string>(existingNote?.fontSize || '16px');
  const [color, setColor] = useState<string>(existingNote?.color || '#2c3e50');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(
    existingNote?.textAlign || 'left'
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Separate Modal State for Common Templates ("常用內容")
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);

  // Common Templates State
  const [templates, setTemplates] = useState<StageNoteTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
    return DEFAULT_TEMPLATES;
  });

  const [newTemplateText, setNewTemplateText] = useState<string>('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateText, setEditingTemplateText] = useState<string>('');
  const [symbolTab, setSymbolTab] = useState<'punctuation' | 'special' | 'number'>('punctuation');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync templates with Firestore if available
  useEffect(() => {
    let mounted = true;
    const fetchTemplates = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'stage_note_templates'));
        if (!mounted) return;
        if (!snapshot.empty) {
          const remoteList = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as StageNoteTemplate))
            .sort((a, b) => a.createdAt - b.createdAt);
          setTemplates(remoteList);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remoteList));
        }
      } catch {
        // Ignore if Firestore rules restrict new collection; localStorage already handles persistence
      }
    };
    fetchTemplates();
    return () => {
      mounted = false;
    };
  }, []);

  const persistTemplates = (nextList: StageNoteTemplate[]) => {
    setTemplates(nextList);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {
      console.error(e);
    }
  };

  // Insert string at current cursor position in textarea
  const insertAtCursor = (insertStr: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText(prev => prev + insertStr);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const nextText = text.slice(0, start) + insertStr + text.slice(end);
    setText(nextText);
    setTimeout(() => {
      el.focus();
      const nextPos = start + insertStr.length;
      el.setSelectionRange(nextPos, nextPos);
    }, 0);
  };

  // Insert indent at current line start
  const insertParagraphIndent = () => {
    const el = textareaRef.current;
    if (!el) {
      setText(prev => '　　' + prev);
      return;
    }
    const start = el.selectionStart ?? 0;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const nextText = text.slice(0, lineStart) + '　　' + text.slice(lineStart);
    setText(nextText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + 2, start + 2);
    }, 0);
  };

  // Add common template
  const handleAddTemplate = async (contentToAdd?: string) => {
    const val = (contentToAdd ?? newTemplateText).trim();
    if (!val) return;
    const newTpl: StageNoteTemplate = {
      id: `tpl_${Date.now()}`,
      content: val,
      createdAt: Date.now()
    };
    const nextList = [...templates, newTpl];
    persistTemplates(nextList);
    if (contentToAdd === undefined) {
      setNewTemplateText('');
    }
    try {
      await setDoc(doc(db, 'stage_note_templates', newTpl.id), newTpl);
    } catch {
      // localStorage already updated
    }
  };

  // Save edited common template
  const handleSaveEditTemplate = async (id: string) => {
    const val = editingTemplateText.trim();
    if (!val) return;
    const nextList = templates.map(t => (t.id === id ? { ...t, content: val } : t));
    persistTemplates(nextList);
    setEditingTemplateId(null);
    setEditingTemplateText('');
    const updated = nextList.find(t => t.id === id);
    if (updated) {
      try {
        await setDoc(doc(db, 'stage_note_templates', id), updated);
      } catch {
        // localStorage already updated
      }
    }
  };

  // Delete common template
  const handleDeleteTemplate = async (id: string) => {
    const nextList = templates.filter(t => t.id !== id);
    persistTemplates(nextList);
    try {
      await deleteDoc(doc(db, 'stage_note_templates', id));
    } catch {
      // localStorage already updated
    }
  };

  // Save note to ticket
  const handleSaveNote = async () => {
    setIsSaving(true);
    try {
      const nextStageNotes: Record<string, StageNote> = { ...(ticket.stageNotes || {}) };
      const trimmed = text.trim();
      if (trimmed) {
        nextStageNotes[workflow.id] = {
          text: text,
          fontSize,
          color,
          textAlign,
          updatedAt: Date.now()
        };
      } else {
        delete nextStageNotes[workflow.id];
      }
      await updateTicket(ticket.id, { stageNotes: nextStageNotes });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert('儲存備註失敗');
    } finally {
      setIsSaving(false);
    }
  };

  // Clear note
  const handleClearNote = async () => {
    setIsSaving(true);
    try {
      const nextStageNotes: Record<string, StageNote> = { ...(ticket.stageNotes || {}) };
      delete nextStageNotes[workflow.id];
      await updateTicket(ticket.id, { stageNotes: nextStageNotes });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert('清除備註失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const activeSymbols =
    symbolTab === 'punctuation'
      ? PUNCTUATION_SYMBOLS
      : symbolTab === 'special'
      ? SPECIAL_SYMBOLS
      : NUMBER_UNIT_SYMBOLS;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '15px',
        overflowY: 'auto'
      }}
    >
      <div
        className="doodle-border"
        style={{
          padding: '22px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '94vh',
          overflowY: 'auto',
          backgroundColor: '#fffdf9',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'var(--crayon-paper)',
            border: '2px solid var(--crayon-dark)',
            fontSize: '1.1rem',
            cursor: 'pointer',
            color: 'var(--crayon-red)',
            fontWeight: 'bold',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
          }}
        >
          ❌
        </button>

        {/* Modal Header */}
        <div
          style={{
            borderBottom: '2px dashed var(--crayon-dark)',
            paddingBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingRight: '40px'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--crayon-dark)' }}>
            📝 流程備註設定 — 單號：{ticket.id}
          </h3>
          <span
            style={{
              backgroundColor: 'var(--crayon-red)',
              color: 'white',
              padding: '2px 10px',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              border: '2px dashed var(--crayon-dark)'
            }}
          >
            關卡 {stageIndex + 1}
          </span>
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)' }}>
            {workflow.name}
          </span>
        </div>

        {/* 備註登打內容欄 + 緊貼於正上方的整合工具列 (常用內容按鈕、格式設定、標點與特殊符號快捷列) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* 標題列與「常用內容」按鈕 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-dark)' }}>
                ✏️ 備註登打內容：
              </label>
              <button
                type="button"
                className="doodle-button"
                style={{
                  padding: '4px 14px',
                  fontSize: '0.92rem',
                  fontWeight: 'bold',
                  minHeight: 'auto',
                  backgroundColor: 'var(--crayon-blue)',
                  color: 'white'
                }}
                onClick={() => setIsTemplateModalOpen(true)}
              >
                📚 常用內容 ({templates.length})
              </button>
              {text.trim() && (
                <button
                  type="button"
                  className="doodle-button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.84rem',
                    fontWeight: 'bold',
                    minHeight: 'auto',
                    backgroundColor: 'var(--crayon-yellow)',
                    color: 'var(--crayon-dark)'
                  }}
                  onClick={() => {
                    handleAddTemplate(text.trim());
                    alert('已將目前備註內容加入「常用內容」！');
                  }}
                >
                  📌 存為常用
                </button>
              )}
            </div>

            <button
              type="button"
              className="doodle-button"
              style={{
                padding: '3px 10px',
                fontSize: '0.84rem',
                fontWeight: 'bold',
                minHeight: 'auto',
                backgroundColor: '#eee',
                color: 'var(--crayon-dark)'
              }}
              onClick={() => setText('')}
            >
              清空內容
            </button>
          </div>

          {/* 緊貼在備註登打內容欄正上方的整合編輯工具箱 */}
          <div
            style={{
              border: '2.5px solid var(--crayon-dark)',
              borderRadius: '10px',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              boxShadow: '3px 3px 0px rgba(0,0,0,0.12)'
            }}
          >
            {/* 工具列第 1 層：格式設定（字體大小、段落位置、字體顏色） */}
            <div
              style={{
                backgroundColor: '#f3e5f5',
                borderBottom: '2px dashed var(--crayon-dark)',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.88rem', color: 'var(--crayon-purple)' }}>
                  🎨 格式設定：
                </span>
                {/* 字體大小 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.86rem' }}>字體大小</label>
                  <select
                    className="doodle-input"
                    style={{
                      width: 'auto',
                      padding: '2px 8px',
                      fontSize: '0.86rem',
                      fontWeight: 'bold',
                      backgroundColor: 'white',
                      minHeight: '30px'
                    }}
                    value={fontSize}
                    onChange={e => setFontSize(e.target.value)}
                  >
                    {FONT_SIZE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 段落位置 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.86rem', marginRight: '2px' }}>
                    段落位置
                  </label>
                  {ALIGN_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className="doodle-button"
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        minHeight: 'auto',
                        backgroundColor: textAlign === opt.value ? 'var(--crayon-purple)' : 'white',
                        color: textAlign === opt.value ? 'white' : 'var(--crayon-dark)'
                      }}
                      onClick={() => setTextAlign(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="doodle-button"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      minHeight: 'auto',
                      backgroundColor: 'white',
                      color: 'var(--crayon-dark)'
                    }}
                    onClick={insertParagraphIndent}
                    title="在目前段落開頭加入兩個全形空白縮排"
                  >
                    ⇥ 首行縮排
                  </button>
                  <button
                    type="button"
                    className="doodle-button"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      minHeight: 'auto',
                      backgroundColor: 'white',
                      color: 'var(--crayon-dark)'
                    }}
                    onClick={() => insertAtCursor('\n')}
                    title="插入換行分段"
                  >
                    ↵ 換行分段
                  </button>
                </div>
              </div>

              {/* 字體顏色 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.86rem' }}>字體顏色：</label>
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border:
                        color.toLowerCase() === c.value.toLowerCase()
                          ? '2.5px solid var(--crayon-dark)'
                          : '1.5px solid #aaa',
                      backgroundColor:
                        color.toLowerCase() === c.value.toLowerCase() ? '#fff9c4' : 'white',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      color: c.value
                    }}
                  >
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: c.value,
                        border: '1px solid rgba(0,0,0,0.3)',
                        display: 'inline-block'
                      }}
                    />
                    {c.label}
                  </button>
                ))}
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    padding: '1px 8px',
                    borderRadius: '12px',
                    border: '1.5px dashed var(--crayon-dark)'
                  }}
                >
                  🎨 自訂
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      background: 'none'
                    }}
                  />
                </label>
              </div>
            </div>

            {/* 工具列第 2 層：標點符號與特殊符號快捷列（緊貼輸入框正上方） */}
            <div
              style={{
                backgroundColor: '#fff8e1',
                borderBottom: '2px solid var(--crayon-dark)',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}
              >
                <span style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#e65100' }}>
                  ⌨️ 符號快捷列：
                </span>
                {[
                  { key: 'punctuation', label: '常用標點符號' },
                  { key: 'special', label: '特殊符號 / 圖示' },
                  { key: 'number', label: '編號 / 運算符號' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    className="doodle-button"
                    style={{
                      padding: '2px 10px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      minHeight: 'auto',
                      backgroundColor:
                        symbolTab === tab.key ? 'var(--crayon-orange)' : 'white',
                      color: symbolTab === tab.key ? 'white' : 'var(--crayon-dark)'
                    }}
                    onClick={() => setSymbolTab(tab.key as any)}
                  >
                    {tab.label}
                  </button>
                ))}
                <span style={{ fontSize: '0.78rem', color: '#666', fontWeight: 'bold' }}>
                  （點擊下方符號直接插入游標處）
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {activeSymbols.map((sym, idx) => (
                  <button
                    key={`${sym}_${idx}`}
                    type="button"
                    onClick={() => insertAtCursor(sym)}
                    title={`插入「${sym}」`}
                    style={{
                      minWidth: '32px',
                      height: '30px',
                      padding: '0 6px',
                      backgroundColor: 'white',
                      color: 'var(--crayon-dark)',
                      border: '1.5px solid var(--crayon-dark)',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      boxShadow: '1px 1px 0px rgba(0,0,0,0.18)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            {/* 備註登打內容 Textarea（緊接在工具列正下方） */}
            <textarea
              ref={textareaRef}
              rows={6}
              placeholder="請在此輸入此流程關卡的備註內容..."
              value={text}
              onChange={e => setText(e.target.value)}
              style={{
                width: '100%',
                fontSize: fontSize,
                color: color,
                textAlign: textAlign,
                fontWeight: 'bold',
                lineHeight: '1.5',
                padding: '12px',
                backgroundColor: '#ffffff',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                display: 'block',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
          {existingNote?.text && (
            <button
              type="button"
              className="doodle-button danger"
              style={{ marginRight: 'auto' }}
              disabled={isSaving}
              onClick={handleClearNote}
            >
              🗑️ 刪除此關卡備註
            </button>
          )}
          <button
            type="button"
            className="doodle-button success"
            style={{ padding: '8px 24px', fontSize: '1.05rem', fontWeight: 'bold' }}
            disabled={isSaving}
            onClick={handleSaveNote}
          >
            {isSaving ? '儲存中...' : '💾 儲存備註'}
          </button>
          <button
            type="button"
            className="doodle-button"
            style={{
              padding: '8px 20px',
              fontSize: '1.05rem',
              backgroundColor: '#eee',
              color: 'var(--crayon-dark)'
            }}
            disabled={isSaving}
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </div>

      {/* 另外開出的「常用內容」選取與管理畫面 (Sub-Modal) */}
      {isTemplateModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '15px'
          }}
        >
          <div
            className="doodle-border"
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '85vh',
              backgroundColor: '#ffffff',
              padding: '22px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '6px 6px 0px rgba(0,0,0,0.25)'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsTemplateModalOpen(false);
                setEditingTemplateId(null);
              }}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'var(--crayon-paper)',
                border: '2px solid var(--crayon-dark)',
                fontSize: '1rem',
                cursor: 'pointer',
                color: 'var(--crayon-red)',
                fontWeight: 'bold',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ❌
            </button>

            <div style={{ borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px', paddingRight: '35px' }}>
              <h3 style={{ margin: 0, fontSize: '1.45rem', color: 'var(--crayon-blue)' }}>
                📚 常用內容選取與管理
              </h3>
              <div style={{ fontSize: '0.88rem', color: '#555', fontWeight: 'bold', marginTop: '4px' }}>
                點擊任一常用內容即可直接帶入備註欄，亦可在下方新增、修改或刪除常用內容。
              </div>
            </div>

            {/* 新增常用內容列 */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: '#e3f2fd',
                padding: '10px',
                borderRadius: '10px',
                border: '2px solid var(--crayon-dark)'
              }}
            >
              <input
                type="text"
                className="doodle-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '0.95rem', backgroundColor: 'white' }}
                placeholder="輸入要新增的常用內容..."
                value={newTemplateText}
                onChange={e => setNewTemplateText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTemplate();
                  }
                }}
              />
              <button
                type="button"
                className="doodle-button success"
                style={{ padding: '6px 14px', fontSize: '0.9rem', fontWeight: 'bold', minHeight: 'auto' }}
                onClick={() => handleAddTemplate()}
              >
                ➕ 新增常用
              </button>
            </div>

            {/* 常用內容清單 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto',
                maxHeight: '45vh',
                paddingRight: '4px'
              }}
            >
              {templates.length === 0 ? (
                <div style={{ color: '#777', textAlign: 'center', padding: '20px', fontWeight: 'bold' }}>
                  目前尚無常用內容，請由上方輸入框新增。
                </div>
              ) : (
                templates.map((tpl, idx) => (
                  <div
                    key={tpl.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#fafafa',
                      border: '2px solid var(--crayon-dark)',
                      borderRadius: '10px',
                      padding: '8px 10px'
                    }}
                  >
                    {editingTemplateId === tpl.id ? (
                      <>
                        <input
                          type="text"
                          className="doodle-input"
                          style={{ flex: 1, padding: '5px 8px', fontSize: '0.95rem', backgroundColor: 'white' }}
                          value={editingTemplateText}
                          onChange={e => setEditingTemplateText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEditTemplate(tpl.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="doodle-button success"
                          style={{ padding: '4px 12px', fontSize: '0.85rem', minHeight: 'auto', fontWeight: 'bold' }}
                          onClick={() => handleSaveEditTemplate(tpl.id)}
                        >
                          💾 儲存
                        </button>
                        <button
                          type="button"
                          className="doodle-button"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.85rem',
                            minHeight: 'auto',
                            backgroundColor: '#eee',
                            color: 'var(--crayon-dark)'
                          }}
                          onClick={() => {
                            setEditingTemplateId(null);
                            setEditingTemplateText('');
                          }}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          style={{
                            backgroundColor: 'var(--crayon-blue)',
                            color: 'white',
                            borderRadius: '12px',
                            padding: '1px 8px',
                            fontSize: '0.78rem',
                            fontWeight: 'bold'
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <div
                          onClick={() => {
                            insertAtCursor(tpl.content);
                            setIsTemplateModalOpen(false);
                          }}
                          title="點擊選取並帶入備註登打內容"
                          style={{
                            flex: 1,
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.98rem',
                            color: 'var(--crayon-dark)',
                            padding: '2px 4px'
                          }}
                        >
                          {tpl.content}
                        </div>
                        <button
                          type="button"
                          className="doodle-button success"
                          style={{
                            padding: '3px 10px',
                            fontSize: '0.82rem',
                            fontWeight: 'bold',
                            minHeight: 'auto'
                          }}
                          onClick={() => {
                            insertAtCursor(tpl.content);
                            setIsTemplateModalOpen(false);
                          }}
                        >
                          ✅ 選取帶入
                        </button>
                        <button
                          type="button"
                          className="doodle-button"
                          style={{
                            padding: '3px 10px',
                            fontSize: '0.82rem',
                            fontWeight: 'bold',
                            minHeight: 'auto',
                            backgroundColor: '#fff9c4',
                            color: 'var(--crayon-dark)'
                          }}
                          onClick={() => {
                            setEditingTemplateId(tpl.id);
                            setEditingTemplateText(tpl.content);
                          }}
                        >
                          ✏️ 修改
                        </button>
                        <button
                          type="button"
                          className="doodle-button danger"
                          style={{
                            padding: '3px 10px',
                            fontSize: '0.82rem',
                            fontWeight: 'bold',
                            minHeight: 'auto'
                          }}
                          onClick={() => handleDeleteTemplate(tpl.id)}
                        >
                          🗑️ 刪除
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                className="doodle-button"
                style={{
                  padding: '6px 20px',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  backgroundColor: '#eee',
                  color: 'var(--crayon-dark)'
                }}
                onClick={() => {
                  setIsTemplateModalOpen(false);
                  setEditingTemplateId(null);
                }}
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
