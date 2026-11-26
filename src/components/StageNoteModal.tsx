import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { InventoryTicket, Workflow, StageNote, StageNoteTemplate } from '../types';
import { updateTicket } from '../services/api';
import { sanitizeRichHtml } from '../utils/security';

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
  { label: '24點 (超大)', value: '24px' },
  { label: '26點', value: '26px' },
  { label: '28點', value: '28px' },
  { label: '36點', value: '36px' },
  { label: '48點', value: '48px' }
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

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const convertPlainTextToHtml = (
  plainText: string,
  defaultFontSize = '16px',
  defaultColor = '#2c3e50',
  defaultAlign: 'left' | 'center' | 'right' = 'left'
): string => {
  if (!plainText) return '';
  const lines = plainText.split('\n');
  return lines
    .map(line => {
      const inner = line ? escapeHtml(line) : '<br>';
      return `<div style="text-align: ${defaultAlign};"><span style="font-size: ${defaultFontSize}; color: ${defaultColor};">${inner}</span></div>`;
    })
    .join('');
};

interface StageNoteViewModalProps {
  ticket: InventoryTicket;
  workflow: Workflow;
  stageIndex: number;
  onClose: () => void;
  onEdit: () => void;
}

export function StageNoteViewModal({
  ticket,
  workflow,
  stageIndex,
  onClose,
  onEdit
}: StageNoteViewModalProps) {
  const stageNote = ticket.stageNotes?.[workflow.id];

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
        padding: '15px'
      }}
    >
      <div
        className="doodle-border"
        style={{
          padding: '24px',
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#fffdf9',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '6px 6px 0px rgba(0,0,0,0.25)'
        }}
      >
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

        {/* Header */}
        <div
          style={{
            borderBottom: '2px dashed var(--crayon-dark)',
            paddingBottom: '10px',
            paddingRight: '40px'
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'var(--crayon-dark)' }}>
            📋 流程備註內容 — 單號：{ticket.id}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
            <span style={{ fontWeight: 'bold', fontSize: '1.15rem', color: 'var(--crayon-blue)' }}>
              {workflow.name}
            </span>
            {stageNote?.updatedAt && (
              <span style={{ fontSize: '0.82rem', color: '#666', fontWeight: 'bold', marginLeft: 'auto' }}>
                更新時間：{new Date(stageNote.updatedAt).toLocaleString('zh-TW')}
              </span>
            )}
          </div>
        </div>

        {/* Note Content Display Area */}
        <div
          style={{
            backgroundColor: '#fffde7',
            border: '2.5px dashed var(--crayon-orange)',
            borderRadius: '10px',
            padding: '16px 18px',
            minHeight: '110px',
            maxHeight: '55vh',
            overflowY: 'auto',
            boxShadow: 'inset 0 0 6px rgba(0,0,0,0.04)'
          }}
        >
          {stageNote?.html ? (
            <div
              style={{
                fontSize: stageNote.fontSize || '16px',
                color: stageNote.color || '#2c3e50',
                textAlign: stageNote.textAlign || 'left',
                wordBreak: 'break-word',
                lineHeight: '1.55'
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(stageNote.html) }}
            />
          ) : stageNote?.text ? (
            <div
              style={{
                fontSize: stageNote.fontSize || '16px',
                color: stageNote.color || '#2c3e50',
                textAlign: stageNote.textAlign || 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.55'
              }}
            >
              {stageNote.text}
            </div>
          ) : (
            <div style={{ color: '#888', textAlign: 'center', padding: '20px', fontWeight: 'bold' }}>
              尚無備註內容
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            className="doodle-button"
            style={{
              padding: '8px 20px',
              fontSize: '1rem',
              fontWeight: 'bold',
              backgroundColor: 'var(--crayon-yellow)',
              color: 'var(--crayon-dark)'
            }}
            onClick={onEdit}
          >
            ✏️ 修改備註
          </button>
          <button
            type="button"
            className="doodle-button"
            style={{
              padding: '8px 22px',
              fontSize: '1rem',
              fontWeight: 'bold',
              backgroundColor: '#eee',
              color: 'var(--crayon-dark)'
            }}
            onClick={onClose}
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const [fontSize, setFontSize] = useState<string>(existingNote?.fontSize || '16px');
  const [color, setColor] = useState<string>(existingNote?.color || '#2c3e50');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(
    existingNote?.textAlign || 'left'
  );
  const [isBoldActive, setIsBoldActive] = useState<boolean>(false);
  const [isItalicActive, setIsItalicActive] = useState<boolean>(false);
  const [isUnderlineActive, setIsUnderlineActive] = useState<boolean>(false);

  const [plainText, setPlainText] = useState<string>(existingNote?.text || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Separate Modal State for Common Templates ("常用內容")
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);

  // System-style Confirm / Notice Modals
  const [isSaveCommonConfirmOpen, setIsSaveCommonConfirmOpen] = useState<boolean>(false);
  const [isDeleteNoteConfirmOpen, setIsDeleteNoteConfirmOpen] = useState<boolean>(false);
  const [deletingTemplate, setDeletingTemplate] = useState<StageNoteTemplate | null>(null);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);

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

  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const updateActiveFormats = () => {
    try {
      setIsBoldActive(document.queryCommandState('bold'));
      setIsItalicActive(document.queryCommandState('italic'));
      setIsUnderlineActive(document.queryCommandState('underline'));
    } catch {
      // ignore if queryCommandState is unsupported in edge environments
    }
  };

  // Initialize Rich Text Editor HTML content on mount
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (existingNote?.html) {
      el.innerHTML = sanitizeRichHtml(existingNote.html);
    } else if (existingNote?.text) {
      el.innerHTML = convertPlainTextToHtml(
        existingNote.text,
        existingNote.fontSize || '16px',
        existingNote.color || '#2c3e50',
        existingNote.textAlign || 'left'
      );
    } else {
      el.innerHTML = `<div style="text-align: left;"><br></div>`;
    }
    setPlainText((el.innerText || '').replace(/\u200B/g, ''));
  }, []);

  // Track user's text selection inside the contentEditable editor
  useEffect(() => {
    const handleSelectionChange = () => {
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
        updateActiveFormats();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

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
        // localStorage already handles persistence
      }
    };
    fetchTemplates();
    return () => {
      mounted = false;
    };
  }, []);

  const syncEditorState = () => {
    const el = editorRef.current;
    if (!el) return;
    const textVal = (el.innerText || '').replace(/\u200B/g, '');
    setPlainText(textVal);
  };

  const saveCurrentSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (el.contains(r.commonAncestorContainer)) {
        savedRangeRef.current = r.cloneRange();
      }
    }
  };

  const restoreSelection = (): Range | null => {
    const el = editorRef.current;
    if (!el) return null;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return null;
    if (
      savedRangeRef.current &&
      el.contains(savedRangeRef.current.commonAncestorContainer)
    ) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
      return savedRangeRef.current;
    }
    if (sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const r = sel.getRangeAt(0);
      savedRangeRef.current = r.cloneRange();
      return r;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRangeRef.current = range.cloneRange();
    return range;
  };

  // Toggle Bold, Italic, or Underline on the selected text (or current cursor typing position), like Word
  const toggleTextStyleCommand = (command: 'bold' | 'italic' | 'underline') => {
    const el = editorRef.current;
    if (!el) return;
    restoreSelection();
    document.execCommand(command, false);
    saveCurrentSelection();
    updateActiveFormats();
    syncEditorState();
  };

  // Apply font-size or color ONLY to the selected text (or current cursor typing position), like Word
  const applyInlineStyle = (styleProp: 'fontSize' | 'color', styleValue: string) => {
    const el = editorRef.current;
    if (!el) return;

    const range = restoreSelection();
    if (!range) return;

    if (range.collapsed) {
      // No text selected: insert a styled span with a zero-width space so newly typed text gets this style
      const span = document.createElement('span');
      if (styleProp === 'fontSize') {
        span.style.fontSize = styleValue;
        span.style.color = color;
      } else {
        span.style.color = styleValue;
        span.style.fontSize = fontSize;
      }
      if (isBoldActive) span.style.fontWeight = 'bold';
      if (isItalicActive) span.style.fontStyle = 'italic';
      if (isUnderlineActive) span.style.textDecoration = 'underline';

      const zwsp = document.createTextNode('\u200B');
      span.appendChild(zwsp);
      range.insertNode(span);

      const nextRange = document.createRange();
      nextRange.setStart(zwsp, 1);
      nextRange.collapse(true);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(nextRange);
      }
      savedRangeRef.current = nextRange.cloneRange();
      syncEditorState();
      return;
    }

    // Collect all Text nodes intersecting the user's selection range
    const textNodes: { node: Text; start: number; end: number }[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let currentNode = walker.nextNode() as Text | null;
    while (currentNode) {
      if (range.intersectsNode(currentNode)) {
        const start = currentNode === range.startContainer ? range.startOffset : 0;
        const end =
          currentNode === range.endContainer
            ? range.endOffset
            : currentNode.length;
        if (end > start) {
          textNodes.push({ node: currentNode, start, end });
        }
      }
      currentNode = walker.nextNode() as Text | null;
    }

    if (textNodes.length === 0) {
      syncEditorState();
      return;
    }

    const wrappedTargets: Text[] = [];
    textNodes.forEach(({ node, start, end }) => {
      let target = node;
      if (end < target.length) {
        target.splitText(end);
      }
      if (start > 0) {
        target = target.splitText(start);
      }

      const parent = target.parentElement;
      if (
        parent &&
        parent !== el &&
        parent.tagName === 'SPAN' &&
        parent.childNodes.length === 1
      ) {
        parent.style[styleProp] = styleValue;
      } else {
        const span = document.createElement('span');
        span.style[styleProp] = styleValue;
        target.parentNode?.insertBefore(span, target);
        span.appendChild(target);
      }
      wrappedTargets.push(target);
    });

    if (wrappedTargets.length > 0) {
      const first = wrappedTargets[0];
      const last = wrappedTargets[wrappedTargets.length - 1];
      const newRange = document.createRange();
      newRange.setStart(first, 0);
      newRange.setEnd(last, last.length);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      savedRangeRef.current = newRange.cloneRange();
    }

    syncEditorState();
  };

  // Apply paragraph alignment ONLY to the selected paragraph(s) / current line, like Word
  const applyParagraphAlignment = (alignValue: 'left' | 'center' | 'right') => {
    setTextAlign(alignValue);
    const el = editorRef.current;
    if (!el) return;

    const range = restoreSelection();
    if (!range) return;

    const childNodes = Array.from(el.childNodes);
    const hasOnlyInline = childNodes.some(
      n =>
        n.nodeType === Node.TEXT_NODE ||
        (n.nodeType === Node.ELEMENT_NODE &&
          !['DIV', 'P'].includes((n as HTMLElement).tagName))
    );
    if (hasOnlyInline) {
      let currentBlock: HTMLDivElement | null = null;
      childNodes.forEach(node => {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          ['DIV', 'P'].includes((node as HTMLElement).tagName)
        ) {
          currentBlock = null;
        } else if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).tagName === 'BR'
        ) {
          if (!currentBlock) {
            currentBlock = document.createElement('div');
            el.insertBefore(currentBlock, node);
            currentBlock.appendChild(node);
          }
          currentBlock = null;
        } else {
          if (!currentBlock) {
            currentBlock = document.createElement('div');
            el.insertBefore(currentBlock, node);
          }
          currentBlock.appendChild(node);
        }
      });
    }

    const blocks = Array.from(el.children).filter(c =>
      ['DIV', 'P'].includes(c.tagName)
    ) as HTMLElement[];

    let matchedAny = false;
    blocks.forEach(block => {
      if (
        range.intersectsNode(block) ||
        block.contains(range.startContainer) ||
        block.contains(range.endContainer)
      ) {
        block.style.textAlign = alignValue;
        matchedAny = true;
      }
    });

    if (!matchedAny) {
      if (blocks.length > 0) {
        blocks[blocks.length - 1].style.textAlign = alignValue;
      } else {
        const div = document.createElement('div');
        div.style.textAlign = alignValue;
        div.innerHTML = el.innerHTML || '<br>';
        el.innerHTML = '';
        el.appendChild(div);
      }
    }

    syncEditorState();
  };

  // Insert string (can be single symbol or multi-line template) at current cursor position in editor
  const insertAtCursor = (insertStr: string) => {
    const el = editorRef.current;
    if (!el || !insertStr) return;

    const range = restoreSelection();
    if (!range) return;

    range.deleteContents();

    const lines = insertStr.split('\n');
    const frag = document.createDocumentFragment();
    let lastInsertedNode: Node | null = null;

    lines.forEach((line, idx) => {
      if (idx > 0) {
        const br = document.createElement('br');
        frag.appendChild(br);
        lastInsertedNode = br;
      }
      if (line.length > 0) {
        const span = document.createElement('span');
        span.style.fontSize = fontSize;
        span.style.color = color;
        if (isBoldActive) span.style.fontWeight = 'bold';
        if (isItalicActive) span.style.fontStyle = 'italic';
        if (isUnderlineActive) span.style.textDecoration = 'underline';
        span.textContent = line;
        frag.appendChild(span);
        lastInsertedNode = span;
      }
    });

    range.insertNode(frag);

    if (lastInsertedNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastInsertedNode);
      nextRange.collapse(true);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(nextRange);
      }
      savedRangeRef.current = nextRange.cloneRange();
    }

    syncEditorState();
  };

  // Insert two full-width spaces at the start of the current paragraph/line
  const insertParagraphIndent = () => {
    const el = editorRef.current;
    if (!el) return;
    const range = restoreSelection();
    if (!range) return;

    let node: Node | null = range.startContainer;
    while (node && node.parentNode !== el && node !== el) {
      node = node.parentNode;
    }

    const indentSpan = document.createElement('span');
    indentSpan.style.fontSize = fontSize;
    indentSpan.style.color = color;
    indentSpan.textContent = '　　';

    if (node && node !== el && node.nodeType === Node.ELEMENT_NODE) {
      node.insertBefore(indentSpan, node.firstChild);
    } else {
      el.insertBefore(indentSpan, el.firstChild);
    }

    syncEditorState();
  };

  const persistTemplates = (nextList: StageNoteTemplate[]) => {
    setTemplates(nextList);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {
      console.error(e);
    }
  };

  // Add common template (supports multi-line)
  const handleAddTemplate = async (contentToAdd?: string) => {
    const rawVal = contentToAdd ?? newTemplateText;
    if (!rawVal.trim()) return;
    const val = rawVal.replace(/\r\n/g, '\n');
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

  // Save edited common template (supports multi-line)
  const handleSaveEditTemplate = async (id: string) => {
    if (!editingTemplateText.trim()) return;
    const val = editingTemplateText.replace(/\r\n/g, '\n');
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

  // Confirm and delete common template
  const confirmDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    const id = deletingTemplate.id;
    const nextList = templates.filter(t => t.id !== id);
    persistTemplates(nextList);
    setDeletingTemplate(null);
    try {
      await deleteDoc(doc(db, 'stage_note_templates', id));
    } catch {
      // localStorage already updated
    }
  };

  // Save note to ticket
  const handleSaveNote = async () => {
    const el = editorRef.current;
    const currentText = el ? (el.innerText || '').replace(/\u200B/g, '') : plainText;
    const currentHtml = el ? sanitizeRichHtml(el.innerHTML.replace(/\u200B/g, '')) : '';

    setIsSaving(true);
    try {
      const nextStageNotes: Record<string, StageNote> = { ...(ticket.stageNotes || {}) };
      if (currentText.trim()) {
        nextStageNotes[workflow.id] = {
          text: currentText.replace(/\r\n/g, '\n'),
          html: currentHtml,
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
      setSystemNotice('儲存備註失敗，請稍後再試。');
    } finally {
      setIsSaving(false);
    }
  };

  // Clear note (after confirmation)
  const handleClearNote = async () => {
    setIsSaving(true);
    try {
      const nextStageNotes: Record<string, StageNote> = { ...(ticket.stageNotes || {}) };
      delete nextStageNotes[workflow.id];
      await updateTicket(ticket.id, { stageNotes: nextStageNotes });
      setIsDeleteNoteConfirmOpen(false);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      setIsDeleteNoteConfirmOpen(false);
      setSystemNotice('刪除備註失敗，請稍後再試。');
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
          maxWidth: '800px',
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

        {/* 備註登打內容欄 + 緊貼於正上方的整合工具列 */}
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
                onMouseDown={e => e.preventDefault()}
                style={{
                  padding: '4px 14px',
                  fontSize: '0.92rem',
                  fontWeight: 'bold',
                  minHeight: 'auto',
                  backgroundColor: 'var(--crayon-blue)',
                  color: 'white'
                }}
                onClick={() => {
                  saveCurrentSelection();
                  setIsTemplateModalOpen(true);
                }}
              >
                📚 常用內容 ({templates.length})
              </button>
              {plainText.trim() && (
                <button
                  type="button"
                  className="doodle-button"
                  onMouseDown={e => e.preventDefault()}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.84rem',
                    fontWeight: 'bold',
                    minHeight: 'auto',
                    backgroundColor: 'var(--crayon-yellow)',
                    color: 'var(--crayon-dark)'
                  }}
                  onClick={() => {
                    saveCurrentSelection();
                    setIsSaveCommonConfirmOpen(true);
                  }}
                >
                  📌 存為常用
                </button>
              )}
            </div>

            <button
              type="button"
              className="doodle-button"
              onMouseDown={e => e.preventDefault()}
              style={{
                padding: '3px 10px',
                fontSize: '0.84rem',
                fontWeight: 'bold',
                minHeight: 'auto',
                backgroundColor: '#eee',
                color: 'var(--crayon-dark)'
              }}
              onClick={() => {
                if (editorRef.current) {
                  editorRef.current.innerHTML = `<div style="text-align: ${textAlign};"><br></div>`;
                }
                setPlainText('');
              }}
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
            {/* 工具列第 1 層：格式設定（字體大小、粗體/斜體/底線、段落位置、字體顏色 — 支援選取局部文字個別套用） */}
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
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
                    onMouseDown={() => saveCurrentSelection()}
                    onChange={e => {
                      const val = e.target.value;
                      setFontSize(val);
                      applyInlineStyle('fontSize', val);
                    }}
                  >
                    {FONT_SIZE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 粗體、斜體、底線 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    className="doodle-button"
                    onMouseDown={e => {
                      e.preventDefault();
                      saveCurrentSelection();
                    }}
                    onClick={() => toggleTextStyleCommand('bold')}
                    title="粗體 (僅針對選取文字或游標後續輸入套用)"
                    style={{
                      padding: '2px 10px',
                      fontSize: '0.84rem',
                      fontWeight: '900',
                      minHeight: 'auto',
                      backgroundColor: isBoldActive ? 'var(--crayon-purple)' : 'white',
                      color: isBoldActive ? 'white' : 'var(--crayon-dark)'
                    }}
                  >
                    B 粗體
                  </button>
                  <button
                    type="button"
                    className="doodle-button"
                    onMouseDown={e => {
                      e.preventDefault();
                      saveCurrentSelection();
                    }}
                    onClick={() => toggleTextStyleCommand('italic')}
                    title="斜體 (僅針對選取文字或游標後續輸入套用)"
                    style={{
                      padding: '2px 10px',
                      fontSize: '0.84rem',
                      fontWeight: 'bold',
                      fontStyle: 'italic',
                      minHeight: 'auto',
                      backgroundColor: isItalicActive ? 'var(--crayon-purple)' : 'white',
                      color: isItalicActive ? 'white' : 'var(--crayon-dark)'
                    }}
                  >
                    I 斜體
                  </button>
                  <button
                    type="button"
                    className="doodle-button"
                    onMouseDown={e => {
                      e.preventDefault();
                      saveCurrentSelection();
                    }}
                    onClick={() => toggleTextStyleCommand('underline')}
                    title="底線 (僅針對選取文字或游標後續輸入套用)"
                    style={{
                      padding: '2px 10px',
                      fontSize: '0.84rem',
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      minHeight: 'auto',
                      backgroundColor: isUnderlineActive ? 'var(--crayon-purple)' : 'white',
                      color: isUnderlineActive ? 'white' : 'var(--crayon-dark)'
                    }}
                  >
                    U 底線
                  </button>
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
                      onMouseDown={e => {
                        e.preventDefault();
                        saveCurrentSelection();
                      }}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        minHeight: 'auto',
                        backgroundColor: textAlign === opt.value ? 'var(--crayon-purple)' : 'white',
                        color: textAlign === opt.value ? 'white' : 'var(--crayon-dark)'
                      }}
                      onClick={() => applyParagraphAlignment(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="doodle-button"
                    onMouseDown={e => {
                      e.preventDefault();
                      saveCurrentSelection();
                    }}
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
                    onMouseDown={e => {
                      e.preventDefault();
                      saveCurrentSelection();
                    }}
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
                    onMouseDown={e => {
                      e.preventDefault();
                      saveCurrentSelection();
                    }}
                    onClick={() => {
                      setColor(c.value);
                      applyInlineStyle('color', c.value);
                    }}
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
                  onMouseDown={() => saveCurrentSelection()}
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
                    onChange={e => {
                      const val = e.target.value;
                      setColor(val);
                      applyInlineStyle('color', val);
                    }}
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
                    onMouseDown={e => e.preventDefault()}
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
                    onMouseDown={e => {
                      e.preventDefault();
                      saveCurrentSelection();
                    }}
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

            {/* 備註登打內容 Rich-Text 編輯區（Word 風格，可選取單字個別設定字體大小、粗體、斜體、底線、顏色、段落對齊） */}
            <div style={{ position: 'relative' }}>
              {!plainText && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '14px',
                    color: '#999',
                    fontSize: '0.98rem',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    userSelect: 'none'
                  }}
                >
                  請在此輸入此流程關卡的備註內容（可反白選取局部文字個別調整大小、粗體、斜體、底線與顏色）...
                </div>
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncEditorState}
                onMouseUp={() => {
                  saveCurrentSelection();
                  updateActiveFormats();
                }}
                onKeyUp={() => {
                  saveCurrentSelection();
                  updateActiveFormats();
                  syncEditorState();
                }}
                onBlur={saveCurrentSelection}
                style={{
                  minHeight: '140px',
                  maxHeight: '280px',
                  overflowY: 'auto',
                  width: '100%',
                  fontSize: '16px',
                  color: '#2c3e50',
                  lineHeight: '1.55',
                  padding: '12px 14px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  wordBreak: 'break-word'
                }}
              />
            </div>
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
              onClick={() => setIsDeleteNoteConfirmOpen(true)}
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
              maxWidth: '660px',
              maxHeight: '88vh',
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
                點擊任一常用內容即可直接帶入備註欄，亦可在下方新增、修改或刪除常用內容（支援多行輸入與原始格式保留）。
              </div>
            </div>

            {/* 新增常用內容列（支援多行輸入） */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                backgroundColor: '#e3f2fd',
                padding: '10px',
                borderRadius: '10px',
                border: '2px solid var(--crayon-dark)'
              }}
            >
              <textarea
                className="doodle-input"
                rows={3}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: '0.95rem',
                  backgroundColor: 'white',
                  resize: 'vertical',
                  lineHeight: '1.45',
                  fontFamily: 'inherit'
                }}
                placeholder="輸入要新增的常用內容（可按 Enter 換行輸入多行內容）..."
                value={newTemplateText}
                onChange={e => setNewTemplateText(e.target.value)}
              />
              <button
                type="button"
                className="doodle-button success"
                style={{
                  padding: '8px 16px',
                  fontSize: '0.92rem',
                  fontWeight: 'bold',
                  minHeight: 'auto',
                  alignSelf: 'center',
                  whiteSpace: 'nowrap'
                }}
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
                maxHeight: '46vh',
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
                      alignItems: editingTemplateId === tpl.id ? 'flex-start' : 'center',
                      gap: '8px',
                      backgroundColor: '#fafafa',
                      border: '2px solid var(--crayon-dark)',
                      borderRadius: '10px',
                      padding: '8px 10px'
                    }}
                  >
                    {editingTemplateId === tpl.id ? (
                      <>
                        <textarea
                          className="doodle-input"
                          rows={4}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            fontSize: '0.95rem',
                            backgroundColor: 'white',
                            resize: 'vertical',
                            lineHeight: '1.45',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'inherit'
                          }}
                          value={editingTemplateText}
                          onChange={e => setEditingTemplateText(e.target.value)}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button
                            type="button"
                            className="doodle-button success"
                            style={{ padding: '5px 12px', fontSize: '0.85rem', minHeight: 'auto', fontWeight: 'bold' }}
                            onClick={() => handleSaveEditTemplate(tpl.id)}
                          >
                            💾 儲存
                          </button>
                          <button
                            type="button"
                            className="doodle-button"
                            style={{
                              padding: '5px 12px',
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
                        </div>
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
                            fontWeight: 'bold',
                            alignSelf: 'flex-start',
                            marginTop: '3px'
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
                            fontSize: '0.96rem',
                            color: 'var(--crayon-dark)',
                            padding: '2px 4px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: '1.45'
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
                            minHeight: 'auto',
                            whiteSpace: 'nowrap'
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
                            color: 'var(--crayon-dark)',
                            whiteSpace: 'nowrap'
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
                            minHeight: 'auto',
                            whiteSpace: 'nowrap'
                          }}
                          onClick={() => setDeletingTemplate(tpl)}
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

      {/* 系統風格「刪除此關卡備註」確認視窗 */}
      {isDeleteNoteConfirmOpen && (
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
            zIndex: 1200,
            padding: '15px'
          }}
        >
          <div
            className="doodle-border"
            style={{
              padding: '28px',
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'white',
              textAlign: 'center',
              boxShadow: '6px 6px 0px rgba(0,0,0,0.25)'
            }}
          >
            <h3 style={{ color: 'var(--crayon-red)', fontSize: '1.8rem', marginTop: 0, marginBottom: '12px' }}>
              ⚠️ 刪除關卡備註確認
            </h3>
            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 12px 0' }}>
              您確定要刪除「關卡 {stageIndex + 1}：{workflow.name}」的備註嗎？<br />
              刪除後將無法復原！
            </p>
            <div
              style={{
                backgroundColor: '#fff5f5',
                border: '2px dashed var(--crayon-red)',
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: '0.95rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '140px',
                overflowY: 'auto',
                marginBottom: '20px'
              }}
            >
              {plainText.trim() || existingNote?.text || ''}
            </div>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                type="button"
                className="doodle-button danger"
                style={{ padding: '8px 20px', fontSize: '1rem', fontWeight: 'bold' }}
                disabled={isSaving}
                onClick={handleClearNote}
              >
                {isSaving ? '刪除中...' : '🗑️ 確認刪除'}
              </button>
              <button
                type="button"
                className="doodle-button"
                style={{
                  padding: '8px 20px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  backgroundColor: '#eee',
                  color: 'var(--crayon-dark)'
                }}
                disabled={isSaving}
                onClick={() => setIsDeleteNoteConfirmOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 系統風格「存為常用」確認與提示視窗 */}
      {isSaveCommonConfirmOpen && (
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
            zIndex: 1200,
            padding: '15px'
          }}
        >
          <div
            className="doodle-border"
            style={{
              padding: '28px',
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'white',
              textAlign: 'center',
              boxShadow: '6px 6px 0px rgba(0,0,0,0.25)'
            }}
          >
            <h3 style={{ color: 'var(--crayon-blue)', fontSize: '1.8rem', marginTop: 0, marginBottom: '12px' }}>
              📌 存為常用內容確認
            </h3>
            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 12px 0' }}>
              確定要將目前的備註內容加入「常用內容」嗎？
            </p>
            <div
              style={{
                backgroundColor: '#fffde7',
                border: '2px dashed var(--crayon-orange)',
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'left',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '140px',
                overflowY: 'auto',
                marginBottom: '20px'
              }}
            >
              {plainText.trim()}
            </div>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                type="button"
                className="doodle-button success"
                style={{ padding: '8px 20px', fontSize: '1rem', fontWeight: 'bold' }}
                onClick={async () => {
                  await handleAddTemplate(plainText.trim());
                  setIsSaveCommonConfirmOpen(false);
                  setSystemNotice('已成功將目前備註內容加入「常用內容」！');
                }}
              >
                ✅ 確認加入
              </button>
              <button
                type="button"
                className="doodle-button"
                style={{
                  padding: '8px 20px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  backgroundColor: '#eee',
                  color: 'var(--crayon-dark)'
                }}
                onClick={() => setIsSaveCommonConfirmOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 系統風格「刪除常用內容」確認視窗 */}
      {deletingTemplate && (
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
            zIndex: 1200,
            padding: '15px'
          }}
        >
          <div
            className="doodle-border"
            style={{
              padding: '28px',
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'white',
              textAlign: 'center',
              boxShadow: '6px 6px 0px rgba(0,0,0,0.25)'
            }}
          >
            <h3 style={{ color: 'var(--crayon-red)', fontSize: '1.8rem', marginTop: 0, marginBottom: '12px' }}>
              ⚠️ 刪除常用內容確認
            </h3>
            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 12px 0' }}>
              您確定要刪除此筆常用內容嗎？<br />
              刪除後將無法復原！
            </p>
            <div
              style={{
                backgroundColor: '#fff5f5',
                border: '2px dashed var(--crayon-red)',
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'left',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '140px',
                overflowY: 'auto',
                marginBottom: '20px'
              }}
            >
              {deletingTemplate.content}
            </div>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                type="button"
                className="doodle-button danger"
                style={{ padding: '8px 20px', fontSize: '1rem', fontWeight: 'bold' }}
                onClick={confirmDeleteTemplate}
              >
                🗑️ 確認刪除
              </button>
              <button
                type="button"
                className="doodle-button"
                style={{
                  padding: '8px 20px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  backgroundColor: '#eee',
                  color: 'var(--crayon-dark)'
                }}
                onClick={() => setDeletingTemplate(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 系統風格訊息提示視窗 */}
      {systemNotice && (
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
            zIndex: 1250,
            padding: '15px'
          }}
        >
          <div
            className="doodle-border"
            style={{
              padding: '28px',
              width: '100%',
              maxWidth: '400px',
              backgroundColor: 'white',
              textAlign: 'center',
              boxShadow: '6px 6px 0px rgba(0,0,0,0.25)'
            }}
          >
            <h3 style={{ color: 'var(--crayon-green)', fontSize: '1.8rem', marginTop: 0, marginBottom: '12px' }}>
              ✅ 系統提示
            </h3>
            <p style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: '0 0 20px 0' }}>
              {systemNotice}
            </p>
            <button
              type="button"
              className="doodle-button success"
              style={{ padding: '8px 28px', fontSize: '1rem', fontWeight: 'bold' }}
              onClick={() => setSystemNotice(null)}
            >
              確定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
