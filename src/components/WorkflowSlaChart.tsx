import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import type { InventoryTicket, Workflow } from '../types';

interface WorkflowSlaChartProps {
  ticket: InventoryTicket;
  workflows: Workflow[];
  nextStage: Workflow | null;
  isFinished: boolean;
  getAssigneeName: (id: string) => string;
  calculateDays: (startMs: number, endMs: number) => number;
  taskName?: string;
  totalProcessingDays?: number;
  onOpenStageNote?: (workflow: Workflow, stageIndex: number) => void;
  onViewStageNote?: (workflow: Workflow, stageIndex: number) => void;
}

const formatFullDate = (ms: number): string => {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
};

export default function WorkflowSlaChart({
  ticket,
  workflows,
  nextStage,
  isFinished,
  getAssigneeName,
  calculateDays,
  taskName,
  totalProcessingDays,
  onOpenStageNote,
  onViewStageNote
}: WorkflowSlaChartProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const nowMs = Date.now();

  useEffect(() => {
    if (!isPrinting || !printRef.current) return;
    let cancelled = false;
    const capture = async () => {
      await new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      if (cancelled || !printRef.current) return;
      try {
        const canvas = await html2canvas(printRef.current, {
          scale: 2,
          backgroundColor: '#ffffff'
        });
        const url = canvas.toDataURL('image/png');
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = `盤點單工時預警對比圖_${ticket.id}_${dateStr}.png`;
        a.click();
      } catch (err) {
        console.error(err);
        alert('列印圖檔失敗');
      } finally {
        if (!cancelled) setIsPrinting(false);
      }
    };
    capture();
    return () => {
      cancelled = true;
    };
  }, [isPrinting, ticket.id]);

  const stageRows = workflows.map((w, wIndex) => {
    const doneTimestamp = ticket.stageDates ? ticket.stageDates[w.id] : undefined;
    const isDone = Boolean(doneTimestamp);
    const isCurrent = !isFinished && nextStage?.id === w.id;

    let refPrevDate: number | null =
      wIndex === 0
        ? ticket.dispatchDate || null
        : (ticket.stageDates && ticket.stageDates[workflows[wIndex - 1].id]) || null;

    if (!refPrevDate && wIndex > 0) {
      for (let i = wIndex - 1; i >= 0; i--) {
        const d = ticket.stageDates?.[workflows[i].id];
        if (d) {
          refPrevDate = d;
          break;
        }
      }
      if (!refPrevDate) refPrevDate = ticket.dispatchDate || null;
    }

    let startMs: number | null = null;
    let endMs: number | null = null;
    let spentDays = 0;

    if (isDone && doneTimestamp) {
      endMs = doneTimestamp;
      startMs = refPrevDate ? Math.min(refPrevDate, endMs) : endMs;
      spentDays = refPrevDate ? calculateDays(refPrevDate, doneTimestamp) : 0;
    } else if (isCurrent) {
      startMs = refPrevDate || ticket.dispatchDate || nowMs;
      endMs = Math.max(startMs, nowMs);
      spentDays = calculateDays(startMs, endMs);
    }

    const standardDays = w.workingDays ?? 0;
    const isWithinWorkingDays = spentDays <= standardDays;
    const diffDays = spentDays - standardDays;
    const assigneeName = getAssigneeName(
      w.assigneeId === 'DYNAMIC_ASSIGNEE' ? ticket.assigneeId : w.assigneeId || ''
    );

    return {
      workflow: w,
      index: wIndex,
      isDone,
      isCurrent,
      isPending: !isDone && !isCurrent,
      startMs,
      endMs,
      doneTimestamp,
      spentDays,
      standardDays,
      diffDays,
      isWithinWorkingDays,
      assigneeName
    };
  });

  const maxScaleDays = Math.max(
    4,
    ...stageRows.map(r => Math.max(r.standardDays, r.spentDays, 1))
  );

  const overdueCount = stageRows.filter(
    r => (r.isDone || r.isCurrent) && !r.isWithinWorkingDays
  ).length;
  const normalDoneCount = stageRows.filter(
    r => r.isDone && r.isWithinWorkingDays
  ).length;

  const renderSlaTable = (forPrint = false) => {
    const gridCols = forPrint
      ? '195px 185px 1fr'
      : '185px 175px 1fr';

    return (
      <div style={{ minWidth: forPrint ? '100%' : '680px' }}>
        {/* Header Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            backgroundColor: 'var(--crayon-dark)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: forPrint ? '0.95rem' : '0.9rem',
            borderRadius: '8px 8px 0 0',
            border: '2px solid var(--crayon-dark)'
          }}
        >
          <div style={{ padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>
            關卡 / 負責人
          </div>
          <div
            style={{
              padding: '10px 10px',
              textAlign: 'center',
              borderRight: '1px solid rgba(255,255,255,0.25)'
            }}
          >
            工時數據 / 預警狀態
          </div>
          <div style={{ padding: '10px 14px' }}>
            標準工時 vs. 實際耗時對比圖（最大刻度：{maxScaleDays} 天）
          </div>
        </div>

        {/* Stage Rows */}
        {stageRows.map(row => {
          const {
            workflow: w,
            index: wIndex,
            isDone,
            isCurrent,
            startMs,
            doneTimestamp,
            spentDays,
            standardDays,
            diffDays,
            isWithinWorkingDays,
            assigneeName
          } = row;

          const stdWidthPct = Math.min(100, Math.max((standardDays / maxScaleDays) * 100, 4));
          const actWidthPct = Math.min(100, Math.max((spentDays / maxScaleDays) * 100, 4));

          const rowBg = isCurrent
            ? '#fff8e1'
            : isDone
            ? isWithinWorkingDays
              ? '#f9fbe7'
              : '#fff5f5'
            : '#fafafa';

          return (
            <div
              key={w.id}
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                backgroundColor: rowBg,
                borderLeft: '2px solid var(--crayon-dark)',
                borderRight: '2px solid var(--crayon-dark)',
                borderBottom: '2px solid var(--crayon-dark)',
                alignItems: 'center',
                minHeight: forPrint ? '76px' : '72px'
              }}
            >
              {/* Col 1: Stage & Assignee & Note Icon */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRight: '2px dashed #ccc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  height: '100%',
                  justifyContent: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      backgroundColor: 'var(--crayon-red)',
                      color: 'white',
                      padding: '1px 8px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      border: '1px solid var(--crayon-dark)'
                    }}
                  >
                    關卡 {wIndex + 1}
                  </span>
                  <span style={{ fontWeight: 'bold', fontSize: '0.98rem', color: 'var(--crayon-dark)' }}>
                    {w.name}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>
                  👤 負責：{assigneeName}
                </div>
                {!forPrint && (onOpenStageNote || onViewStageNote) && (
                  <div style={{ marginTop: '2px' }}>
                    {ticket.stageNotes?.[w.id]?.text ? (
                      <div
                        onClick={() =>
                          onViewStageNote
                            ? onViewStageNote(w, wIndex)
                            : onOpenStageNote && onOpenStageNote(w, wIndex)
                        }
                        title="點擊查看此關卡備註內容"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
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
                            boxShadow: '2px 2px 0px rgba(0,0,0,0.22)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.95rem',
                            flexShrink: 0
                          }}
                        >
                          📝
                        </span>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 'bold',
                            color: 'var(--crayon-red)',
                            backgroundColor: '#fffde7',
                            padding: '1px 7px',
                            borderRadius: '10px',
                            border: '1.5px dashed var(--crayon-orange)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          有備註
                        </span>
                      </div>
                    ) : (
                      onOpenStageNote && (
                        <button
                          type="button"
                          className="doodle-button"
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.78rem',
                            fontWeight: 'bold',
                            minHeight: 'auto',
                            backgroundColor: 'white',
                            color: 'var(--crayon-dark)',
                            border: '1.5px solid var(--crayon-dark)'
                          }}
                          onClick={() => onOpenStageNote(w, wIndex)}
                        >
                          ➕ 新增備註
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Col 2: Standard vs Actual Days & Alert Badge */}
              <div
                style={{
                  padding: '8px 10px',
                  borderRight: '2px dashed #ccc',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  height: '100%'
                }}
              >
                <div style={{ fontSize: '0.84rem', fontWeight: 'bold', color: '#444' }}>
                  標準：<span style={{ color: 'var(--crayon-blue)' }}>{standardDays} 天</span> ｜ 實際：
                  <span
                    style={{
                      color:
                        isDone || isCurrent
                          ? isWithinWorkingDays
                            ? '#2e7d32'
                            : '#d32f2f'
                          : '#888'
                    }}
                  >
                    {isDone || isCurrent ? `${spentDays} 天` : '-'}
                  </span>
                </div>

                {isDone ? (
                  isWithinWorkingDays ? (
                    <span
                      style={{
                        backgroundColor: '#e8f5e9',
                        color: '#1b5e20',
                        border: '2px solid var(--crayon-green)',
                        padding: '2px 9px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ✅ 符合標準{diffDays < 0 ? ` (節省 ${Math.abs(diffDays)} 天)` : ''}
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: '#ffcdd2',
                        color: '#b71c1c',
                        border: '2px solid var(--crayon-red)',
                        padding: '2px 9px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ⚠️ 超標 +{diffDays} 天
                    </span>
                  )
                ) : isCurrent ? (
                  isWithinWorkingDays ? (
                    <span
                      style={{
                        backgroundColor: 'var(--crayon-orange)',
                        color: 'white',
                        border: '2px dashed var(--crayon-dark)',
                        padding: '2px 9px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      📍 處理中 (剩餘 {Math.max(0, standardDays - spentDays)} 天)
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: '#ffcdd2',
                        color: '#b71c1c',
                        border: '2px solid var(--crayon-red)',
                        padding: '2px 9px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      🚨 處理中超標 +{diffDays} 天
                    </span>
                  )
                ) : (
                  <span
                    style={{
                      backgroundColor: '#eeeeee',
                      color: '#777',
                      border: '2px solid #ccc',
                      padding: '2px 9px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ⏳ 待處理
                  </span>
                )}
              </div>

              {/* Col 3: Dual Horizontal Comparison Bars */}
              <div
                style={{
                  padding: '8px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  justifyContent: 'center'
                }}
              >
                {/* Bar 1: Standard Working Days Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '42px',
                      fontSize: '0.76rem',
                      fontWeight: 'bold',
                      color: '#1976d2',
                      textAlign: 'right',
                      flexShrink: 0
                    }}
                  >
                    標準
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: '18px',
                      backgroundColor: '#f0f4f8',
                      borderRadius: '6px',
                      border: '1px dashed #90caf9',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: `${stdWidthPct}%`,
                        height: '100%',
                        backgroundColor: '#bbdefb',
                        border: '1.5px solid #1976d2',
                        borderRadius: '5px',
                        transition: 'width 0.3s'
                      }}
                    />
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '0.76rem',
                        fontWeight: 'bold',
                        color: '#0d47a1',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      標準 {standardDays} 天
                    </span>
                  </div>
                </div>

                {/* Bar 2: Actual Spent Days Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '42px',
                      fontSize: '0.76rem',
                      fontWeight: 'bold',
                      color:
                        isDone || isCurrent
                          ? isWithinWorkingDays
                            ? '#2e7d32'
                            : '#c62828'
                          : '#888',
                      textAlign: 'right',
                      flexShrink: 0
                    }}
                  >
                    實際
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: '22px',
                      backgroundColor: '#ffffff',
                      borderRadius: '6px',
                      border: '1.5px solid #ccc',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {isDone || isCurrent ? (
                      <>
                        <div
                          style={{
                            width: `${actWidthPct}%`,
                            height: '100%',
                            backgroundColor: isWithinWorkingDays
                              ? isDone
                                ? 'var(--crayon-green)'
                                : 'var(--crayon-orange)'
                              : '#ef5350',
                            backgroundImage: isCurrent
                              ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.25) 0px, rgba(255,255,255,0.25) 8px, transparent 8px, transparent 16px)'
                              : 'none',
                            border: '2px solid var(--crayon-dark)',
                            borderRadius: '5px',
                            transition: 'width 0.3s'
                          }}
                        />
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            color: 'var(--crayon-dark)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {isDone && doneTimestamp
                            ? `實際 ${spentDays} 天（完成日：${formatFullDate(doneTimestamp)}）`
                            : `已進行 ${spentDays} 天（起：${formatFullDate(startMs || nowMs)} ~ 至今）`}
                        </span>
                      </>
                    ) : (
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 'bold',
                          color: '#999'
                        }}
                      >
                        尚未開始 (-)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Print-only Stage Note Row */}
              {forPrint && ticket.stageNotes?.[w.id]?.text && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    margin: '4px 10px 8px 10px',
                    padding: '8px 12px',
                    backgroundColor: '#fffde7',
                    border: '2px dashed var(--crayon-orange)',
                    borderRadius: '8px'
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 'bold',
                      color: '#e65100',
                      marginBottom: '4px',
                      textAlign: 'left'
                    }}
                  >
                    📝 關卡備註：
                  </div>
                  {ticket.stageNotes[w.id].html ? (
                    <div
                      style={{
                        fontSize: ticket.stageNotes[w.id].fontSize || '16px',
                        color: ticket.stageNotes[w.id].color || '#2c3e50',
                        textAlign: ticket.stageNotes[w.id].textAlign || 'left',
                        wordBreak: 'break-word',
                        lineHeight: '1.45'
                      }}
                      dangerouslySetInnerHTML={{ __html: ticket.stageNotes[w.id].html! }}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: ticket.stageNotes[w.id].fontSize || '16px',
                        color: ticket.stageNotes[w.id].color || '#2c3e50',
                        textAlign: ticket.stageNotes[w.id].textAlign || 'left',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: '1.45'
                      }}
                    >
                      {ticket.stageNotes[w.id].text}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        marginTop: '15px',
        padding: '15px',
        backgroundColor: '#fffdf7',
        border: '3px solid var(--crayon-dark)',
        borderRadius: '12px',
        boxShadow: '3px 3px 0px rgba(0,0,0,0.12)'
      }}
    >
      {/* Header & Summary & Print Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '12px',
          paddingBottom: '10px',
          borderBottom: '2px dashed var(--crayon-dark)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--crayon-dark)', marginRight: '4px' }}>
            ⚖️ 工時預警對比圖（標準 vs. 實際）
          </span>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 'bold',
              backgroundColor: '#e8f5e9',
              border: '2px solid var(--crayon-green)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            ✅ 符合標準：{normalDoneCount} 關
          </span>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 'bold',
              backgroundColor: '#ffcdd2',
              border: '2px solid var(--crayon-red)',
              color: '#b71c1c',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            ⚠️ 耗時超標：{overdueCount} 關
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
          {isPrinting ? '⏳ 產生圖檔中...' : '🖨️ 列印圖檔'}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>{renderSlaTable(false)}</div>

      {isPrinting && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
          <div
            ref={printRef}
            className="doodle-border"
            style={{
              width: '1120px',
              padding: '24px',
              backgroundColor: '#ffffff',
              border: '3px solid var(--crayon-dark)',
              borderRadius: '14px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '3px dashed var(--crayon-dark)',
                paddingBottom: '14px',
                marginBottom: '16px'
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', color: 'var(--crayon-dark)' }}>
                  ⚖️ 盤點單工時預警對比圖 — 單號：{ticket.id}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      backgroundColor:
                        ticket.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontWeight: 'bold'
                    }}
                  >
                    類型：{ticket.ticketType || '未指定'}
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--crayon-yellow)',
                      padding: '4px 14px',
                      borderRadius: '16px',
                      fontWeight: 'bold',
                      border: '2px dashed var(--crayon-dark)'
                    }}
                  >
                    👤 盤點人員：{getAssigneeName(ticket.assigneeId)}
                  </span>
                  {taskName && (
                    <span
                      style={{
                        backgroundColor: '#b2dfdb',
                        padding: '4px 14px',
                        borderRadius: '16px',
                        fontWeight: 'bold',
                        border: '2px dashed var(--crayon-dark)'
                      }}
                    >
                      🎯 任務：{taskName}
                    </span>
                  )}
                  {totalProcessingDays !== undefined && (
                    <span
                      style={{
                        backgroundColor: isFinished ? '#c8e6c9' : '#ffe0b2',
                        padding: '4px 14px',
                        borderRadius: '16px',
                        fontWeight: 'bold',
                        border: '2px solid var(--crayon-dark)'
                      }}
                    >
                      ⏱️ 總處理天數：{totalProcessingDays} 天
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                <div>列印日期：{formatFullDate(nowMs)}</div>
              </div>
            </div>
            {renderSlaTable(true)}
          </div>
        </div>
      )}
    </div>
  );
}
