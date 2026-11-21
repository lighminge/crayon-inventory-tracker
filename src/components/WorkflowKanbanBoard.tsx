import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import type { InventoryTicket, Workflow } from '../types';

interface WorkflowKanbanBoardProps {
  tickets: InventoryTicket[];
  workflows: Workflow[];
  tasks: any[];
  canEdit: boolean;
  showClosedColumn?: boolean;
  getAssigneeName: (id: string) => string;
  calculateDays: (startMs: number, endMs: number) => number;
  getNextStage: (ticket: InventoryTicket) => Workflow | null;
  onAdvanceStage: (ticket: InventoryTicket, stage: Workflow) => void;
  onApproveClose: (ticket: InventoryTicket) => void;
  onOpenStageNote: (ticket: InventoryTicket, workflow: Workflow, stageIndex: number) => void;
  onViewStageNote: (ticket: InventoryTicket, workflow: Workflow, stageIndex: number) => void;
}

const formatFullDate = (ms: number): string => {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
};

export default function WorkflowKanbanBoard({
  tickets,
  workflows,
  tasks,
  canEdit,
  showClosedColumn = false,
  getAssigneeName,
  calculateDays,
  getNextStage,
  onAdvanceStage,
  onApproveClose,
  onOpenStageNote,
  onViewStageNote
}: WorkflowKanbanBoardProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const nowMs = Date.now();

  useEffect(() => {
    if (!isPrinting || !boardRef.current) return;
    let cancelled = false;
    const capture = async () => {
      await new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      if (cancelled || !boardRef.current) return;
      try {
        const canvas = await html2canvas(boardRef.current, {
          scale: 2,
          backgroundColor: '#f4f8fb'
        });
        const url = canvas.toDataURL('image/png');
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = `盤點單關卡看板控管圖_${dateStr}.png`;
        a.click();
      } catch (err) {
        console.error(err);
        alert('列印看板圖檔失敗');
      } finally {
        if (!cancelled) setIsPrinting(false);
      }
    };
    capture();
    return () => {
      cancelled = true;
    };
  }, [isPrinting]);

  const getFirstStageDate = (t: InventoryTicket) => {
    if (t.stageDates && Object.keys(t.stageDates).length > 0) {
      return Math.min(...Object.values(t.stageDates));
    }
    return t.dispatchDate;
  };

  // Compute current stage elapsed days for an active ticket at stage wIndex
  const getStageElapsedInfo = (t: InventoryTicket, wIndex: number) => {
    const w = workflows[wIndex];
    if (!w) return { startMs: nowMs, spentDays: 0, standardDays: 0, isOverdue: false, diffDays: 0 };

    let refPrevDate: number | null =
      wIndex === 0
        ? t.dispatchDate || null
        : (t.stageDates && t.stageDates[workflows[wIndex - 1].id]) || null;

    if (!refPrevDate && wIndex > 0) {
      for (let i = wIndex - 1; i >= 0; i--) {
        const d = t.stageDates?.[workflows[i].id];
        if (d) {
          refPrevDate = d;
          break;
        }
      }
      if (!refPrevDate) refPrevDate = t.dispatchDate || null;
    }

    const startMs = refPrevDate || t.dispatchDate || nowMs;
    const spentDays = calculateDays(startMs, Math.max(startMs, nowMs));
    const standardDays = w.workingDays ?? 0;
    const isOverdue = spentDays > standardDays;
    const diffDays = spentDays - standardDays;

    return { startMs, spentDays, standardDays, isOverdue, diffDays };
  };

  // Build swimlane columns for each workflow stage
  const stageColumns = workflows.map((w, wIndex) => {
    const colTickets = tickets
      .filter(t => {
        if (t.closeDate) return false;
        const next = getNextStage(t);
        if (next) return next.id === w.id;
        // If all stages done but not closed yet (pending approval), place in last stage
        return wIndex === workflows.length - 1;
      })
      .map(t => {
        const info = getStageElapsedInfo(t, wIndex);
        const firstDate = getFirstStageDate(t) || nowMs;
        const totalDays = calculateDays(firstDate, nowMs);
        return { ticket: t, ...info, totalDays };
      })
      .sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return b.spentDays - a.spentDays;
      });

    const totalItems = colTickets.reduce((sum, item) => sum + (item.ticket.itemCount || 0), 0);
    const overdueCount = colTickets.filter(item => item.isOverdue).length;

    return {
      workflow: w,
      stageIndex: wIndex,
      items: colTickets,
      totalItems,
      overdueCount
    };
  });

  const closedTickets = showClosedColumn
    ? tickets.filter(t => Boolean(t.closeDate))
    : [];
  const closedTotalItems = closedTickets.reduce((s, t) => s + (t.itemCount || 0), 0);

  const totalActiveTickets = stageColumns.reduce((s, c) => s + c.items.length, 0);
  const totalOverdueTickets = stageColumns.reduce((s, c) => s + c.overdueCount, 0);

  return (
    <div
      ref={boardRef}
      className="doodle-border"
      style={{
        padding: '18px',
        backgroundColor: '#f4f8fb',
        marginBottom: '20px'
      }}
    >
      {/* Kanban Top Summary Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '12px',
          marginBottom: '16px',
          borderBottom: '3px dashed var(--crayon-dark)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--crayon-dark)' }}>
            📋 流程關卡控管看板（Kanban 泳道圖）
          </h3>
          <span
            style={{
              backgroundColor: '#e3f2fd',
              color: 'var(--crayon-blue)',
              border: '2px solid var(--crayon-blue)',
              padding: '3px 12px',
              borderRadius: '14px',
              fontWeight: 'bold',
              fontSize: '0.95rem'
            }}
          >
            🏃 進行中單據：{totalActiveTickets} 單
          </span>
          <span
            style={{
              backgroundColor: totalOverdueTickets > 0 ? '#ffcdd2' : '#e8f5e9',
              color: totalOverdueTickets > 0 ? '#b71c1c' : '#1b5e20',
              border: `2px solid ${totalOverdueTickets > 0 ? 'var(--crayon-red)' : 'var(--crayon-green)'}`,
              padding: '3px 12px',
              borderRadius: '14px',
              fontWeight: 'bold',
              fontSize: '0.95rem'
            }}
          >
            {totalOverdueTickets > 0
              ? `🚨 本關耗時超標：${totalOverdueTickets} 單（已自動置頂警示）`
              : '✅ 目前所有進行中單據皆在標準工時內'}
          </span>
        </div>

        <button
          type="button"
          className="doodle-button success"
          style={{
            padding: '5px 14px',
            fontSize: '0.92rem',
            fontWeight: 'bold',
            minHeight: 'auto'
          }}
          disabled={isPrinting}
          onClick={() => setIsPrinting(true)}
        >
          {isPrinting ? '⏳ 匯出看板圖檔中...' : '🖨️ 匯出看板圖檔'}
        </button>
      </div>

      {/* Kanban Swimlane Columns (上下分區網格排版，每排 3 欄，不超出畫面) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '16px',
          width: '100%',
          boxSizing: 'border-box',
          alignItems: 'stretch'
        }}
      >
        {stageColumns.map(col => {
          const { workflow: w, stageIndex: wIndex, items, totalItems, overdueCount } = col;

          return (
            <div
              key={w.id}
              style={{
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                border: '3px solid var(--crayon-dark)',
                borderRadius: '12px',
                boxShadow: '4px 4px 0px rgba(0,0,0,0.12)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Swimlane Header */}
              <div
                style={{
                  backgroundColor: overdueCount > 0 ? '#ffebee' : '#e3f2fd',
                  borderBottom: '2.5px solid var(--crayon-dark)',
                  padding: '12px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '6px'
                  }}
                >
                  <span
                    style={{
                      backgroundColor: 'var(--crayon-red)',
                      color: 'white',
                      padding: '2px 9px',
                      borderRadius: '12px',
                      fontSize: '0.82rem',
                      fontWeight: 'bold',
                      border: '1.5px solid var(--crayon-dark)'
                    }}
                  >
                    關卡 {wIndex + 1}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      color: '#444',
                      backgroundColor: 'white',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: '1px dashed var(--crayon-dark)'
                    }}
                  >
                    標準工時：{w.workingDays ?? 0} 天
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '1.18rem',
                    fontWeight: 'bold',
                    color: 'var(--crayon-dark)',
                    marginBottom: '8px'
                  }}
                >
                  {w.name}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      backgroundColor: 'var(--crayon-yellow)',
                      color: 'var(--crayon-dark)',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '0.88rem',
                      border: '1.5px solid var(--crayon-dark)'
                    }}
                  >
                    📦 {items.length} 單 / {totalItems} 項
                  </span>
                  {overdueCount > 0 && (
                    <span
                      style={{
                        backgroundColor: 'var(--crayon-red)',
                        color: 'white',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        fontSize: '0.82rem',
                        border: '1.5px solid var(--crayon-dark)'
                      }}
                    >
                      🚨 超標 {overdueCount} 單
                    </span>
                  )}
                </div>
              </div>

              {/* Swimlane Cards Body */}
              <div
                style={{
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  backgroundColor: '#fafafa',
                  flex: 1
                }}
              >
                {items.length === 0 ? (
                  <div
                    style={{
                      padding: '28px 10px',
                      textAlign: 'center',
                      color: '#999',
                      fontWeight: 'bold',
                      fontSize: '0.92rem'
                    }}
                  >
                    目前無單據停留於此關卡 ✨
                  </div>
                ) : (
                  items.map(({ ticket: t, startMs, spentDays, standardDays, isOverdue, diffDays, totalDays }) => {
                    const nextStage = getNextStage(t);
                    const isPendingApproval = !nextStage && !t.closeDate;
                    const stageNote = t.stageNotes?.[w.id];
                    const taskName = t.taskId
                      ? tasks.find(tk => tk.id === t.taskId)?.name || ''
                      : '';
                    const stageOwner = getAssigneeName(
                      w.assigneeId === 'DYNAMIC_ASSIGNEE' ? t.assigneeId : w.assigneeId || ''
                    );

                    const cIdx = nextStage ? workflows.findIndex(wf => wf.id === nextStage.id) : -1;
                    const nNext = cIdx !== -1 && cIdx + 1 < workflows.length ? workflows[cIdx + 1] : null;
                    const btnText = nNext ? `推進至 ${nNext.name}` : '結案';

                    return (
                      <div
                        key={t.id}
                        style={{
                          backgroundColor: isOverdue ? '#fff5f5' : '#ffffff',
                          border: `2.5px solid ${isOverdue ? 'var(--crayon-red)' : 'var(--crayon-dark)'}`,
                          borderRadius: '10px',
                          padding: '10px 12px',
                          boxShadow: isOverdue
                            ? '3px 3px 0px rgba(211,47,47,0.28)'
                            : '2px 2px 0px rgba(0,0,0,0.12)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '7px'
                        }}
                      >
                        {/* Card Top Row: Ticket ID & Type */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1.15rem', color: 'var(--crayon-dark)' }}>
                            #{t.id}
                          </span>
                          <span
                            style={{
                              backgroundColor:
                                t.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 'bold'
                            }}
                          >
                            {t.ticketType || '未指定'}
                          </span>
                        </div>

                        {/* Personnel & Items */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          <span
                            style={{
                              backgroundColor: '#fff3e0',
                              border: '1.5px dashed var(--crayon-orange)',
                              color: '#e65100',
                              padding: '2px 8px',
                              borderRadius: '8px',
                              fontSize: '0.84rem',
                              fontWeight: 'bold'
                            }}
                          >
                            👤 盤點：{getAssigneeName(t.assigneeId)}
                          </span>
                          <span
                            style={{
                              backgroundColor: '#f3e5f5',
                              border: '1.5px dashed var(--crayon-purple)',
                              color: 'var(--crayon-purple)',
                              padding: '2px 8px',
                              borderRadius: '8px',
                              fontSize: '0.84rem',
                              fontWeight: 'bold'
                            }}
                          >
                            📦 {t.itemCount || 0} 項
                          </span>
                        </div>

                        {taskName && (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              color: '#2e7d32',
                              backgroundColor: '#e8f5e9',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px dashed #2e7d32'
                            }}
                          >
                            🎯 任務：{taskName}
                          </div>
                        )}

                        <div style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>
                          本關負責：<span style={{ color: 'var(--crayon-blue)' }}>{stageOwner}</span> ｜ 進站日：{formatFullDate(startMs)}
                        </div>

                        {/* SLA Alert Pill */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            backgroundColor: isOverdue ? '#ffcdd2' : '#e8f5e9',
                            border: `1.5px solid ${isOverdue ? 'var(--crayon-red)' : 'var(--crayon-green)'}`,
                            fontWeight: 'bold',
                            fontSize: '0.82rem',
                            color: isOverdue ? '#b71c1c' : '#1b5e20'
                          }}
                        >
                          <span>
                            {isOverdue
                              ? `⚠️ 本關停留 ${spentDays}天 (超標 +${diffDays}天)`
                              : `⏱️ 本關停留 ${spentDays}天 / 標準 ${standardDays}天`}
                          </span>
                          <span style={{ fontSize: '0.76rem', color: '#444' }}>
                            總計 {totalDays}天
                          </span>
                        </div>

                        {/* Bottom Action Row: Note Icon + Advance Button */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '2px',
                            paddingTop: '6px',
                            borderTop: '1px dashed #ccc'
                          }}
                        >
                          {stageNote?.text ? (
                            <div
                              onClick={() => onViewStageNote(t, w, wIndex)}
                              title="點擊查看此關卡備註內容"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <span
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--crayon-yellow)',
                                  border: '2px solid var(--crayon-dark)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.92rem'
                                }}
                              >
                                📝
                              </span>
                              <span
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  color: 'var(--crayon-red)',
                                  backgroundColor: '#fffde7',
                                  padding: '1px 6px',
                                  borderRadius: '8px',
                                  border: '1.5px dashed var(--crayon-orange)'
                                }}
                              >
                                有備註
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="doodle-button"
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.76rem',
                                fontWeight: 'bold',
                                minHeight: 'auto',
                                backgroundColor: 'white',
                                color: 'var(--crayon-dark)',
                                border: '1.5px solid var(--crayon-dark)'
                              }}
                              onClick={() => onOpenStageNote(t, w, wIndex)}
                            >
                              ➕ 新增備註
                            </button>
                          )}

                          {canEdit && nextStage && (
                            <button
                              type="button"
                              className="doodle-button success"
                              style={{
                                padding: '3px 10px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                minHeight: 'auto'
                              }}
                              onClick={() => onAdvanceStage(t, nextStage)}
                            >
                              {btnText}
                            </button>
                          )}
                          {canEdit && isPendingApproval && (
                            <button
                              type="button"
                              className="doodle-button"
                              style={{
                                padding: '3px 10px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                minHeight: 'auto',
                                backgroundColor: 'var(--crayon-orange)'
                              }}
                              onClick={() => onApproveClose(t)}
                            >
                              主管核准結案
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        {/* Optional Closed Tickets Column (for InventoryTickets page) */}
        {showClosedColumn && (
          <div
            style={{
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#ffffff',
              border: '3px solid var(--crayon-dark)',
              borderRadius: '12px',
              boxShadow: '4px 4px 0px rgba(0,0,0,0.12)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                backgroundColor: '#e8f5e9',
                borderBottom: '2.5px solid var(--crayon-dark)',
                padding: '12px'
              }}
            >
              <div style={{ marginBottom: '6px' }}>
                <span
                  style={{
                    backgroundColor: 'var(--crayon-green)',
                    color: 'var(--crayon-dark)',
                    padding: '2px 9px',
                    borderRadius: '12px',
                    fontSize: '0.82rem',
                    fontWeight: 'bold',
                    border: '1.5px solid var(--crayon-dark)'
                  }}
                >
                  ✅ 完成結案
                </span>
              </div>
              <div style={{ fontSize: '1.18rem', fontWeight: 'bold', color: 'var(--crayon-dark)', marginBottom: '8px' }}>
                已結案單據
              </div>
              <span
                style={{
                  backgroundColor: 'white',
                  color: '#2e7d32',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '0.88rem',
                  border: '1.5px solid var(--crayon-dark)'
                }}
              >
                📦 {closedTickets.length} 單 / {closedTotalItems} 項
              </span>
            </div>

            <div
              style={{
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: '#fafafa',
                flex: 1
              }}
            >
              {closedTickets.length === 0 ? (
                <div style={{ padding: '28px 10px', textAlign: 'center', color: '#999', fontWeight: 'bold', fontSize: '0.92rem' }}>
                  無已結案單據
                </div>
              ) : (
                closedTickets.map(t => {
                  const firstDate = getFirstStageDate(t);
                  const totalDays =
                    firstDate && t.closeDate ? calculateDays(firstDate, t.closeDate) : 0;

                  return (
                    <div
                      key={t.id}
                      style={{
                        backgroundColor: '#f9fbe7',
                        border: '2px solid var(--crayon-green)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--crayon-dark)' }}>
                          #{t.id}
                        </span>
                        <span
                          style={{
                            backgroundColor:
                              t.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 'bold'
                          }}
                        >
                          {t.ticketType || '未指定'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 'bold', color: '#444' }}>
                        👤 {getAssigneeName(t.assigneeId)} ｜ 📦 {t.itemCount || 0} 項
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#2e7d32' }}>
                        ✓ 結案日：{t.closeDate ? formatFullDate(t.closeDate) : '-'}（總耗時 {totalDays} 天）
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
