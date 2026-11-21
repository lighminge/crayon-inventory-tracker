import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import type { InventoryTicket, Workflow } from '../types';

interface WorkflowMetroChartProps {
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

export default function WorkflowMetroChart({
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
}: WorkflowMetroChartProps) {
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
        a.download = `盤點單捷運里程碑_${ticket.id}_${dateStr}.png`;
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
      isWithinWorkingDays,
      assigneeName
    };
  });

  const renderMetroContent = (forPrint = false) => {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '0',
          padding: '18px 8px 10px 8px',
          minWidth: forPrint ? '100%' : `${Math.max(660, stageRows.length * 185)}px`
        }}
      >
        {stageRows.map((row, idx) => {
          const {
            workflow: w,
            index: wIndex,
            isDone,
            isCurrent,
            startMs,
            doneTimestamp,
            spentDays,
            standardDays,
            isWithinWorkingDays,
            assigneeName
          } = row;

          const stationColor = isDone
            ? isWithinWorkingDays
              ? 'var(--crayon-green)'
              : 'var(--crayon-red)'
            : isCurrent
            ? 'var(--crayon-orange)'
            : '#ccc';

          const nextRow = idx < stageRows.length - 1 ? stageRows[idx + 1] : null;
          const lineDone = nextRow ? nextRow.isDone : false;
          const lineCurrent = nextRow ? nextRow.isCurrent : false;
          const lineColor = lineDone
            ? nextRow?.isWithinWorkingDays
              ? 'var(--crayon-green)'
              : 'var(--crayon-red)'
            : lineCurrent
            ? 'var(--crayon-orange)'
            : '#ccc';

          return (
            <div
              key={w.id}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                padding: '0 6px'
              }}
            >
              {/* Connecting Metro Track to Next Station */}
              {idx < stageRows.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '23px',
                    left: '50%',
                    width: '100%',
                    height: '8px',
                    backgroundColor: lineDone ? lineColor : 'transparent',
                    borderTop: !lineDone ? `5px dashed ${lineColor}` : 'none',
                    borderBottom: lineDone ? '2px solid var(--crayon-dark)' : 'none',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {nextRow && (nextRow.isDone || nextRow.isCurrent) && (
                    <span
                      style={{
                        backgroundColor: nextRow.isWithinWorkingDays
                          ? nextRow.isDone
                            ? '#c8e6c9'
                            : '#ffe0b2'
                          : '#ffcdd2',
                        color: 'var(--crayon-dark)',
                        border: '1.5px solid var(--crayon-dark)',
                        borderRadius: '10px',
                        padding: '1px 7px',
                        fontSize: '0.74rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        transform: 'translateY(-16px)',
                        boxShadow: '1px 1px 0px rgba(0,0,0,0.2)'
                      }}
                    >
                      {nextRow.isDone
                        ? `耗時 ${nextRow.spentDays}天`
                        : `進行中 ${nextRow.spentDays}天`}
                    </span>
                  )}
                </div>
              )}

              {/* Circular Metro Station Badge */}
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: stationColor,
                  border: '3.5px solid var(--crayon-dark)',
                  boxShadow: isCurrent
                    ? '0 0 0 5px rgba(255,152,0,0.28), 2px 2px 0px rgba(0,0,0,0.25)'
                    : '2px 2px 0px rgba(0,0,0,0.22)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDone || isCurrent ? 'white' : '#555',
                  fontWeight: 'bold',
                  zIndex: 2,
                  marginBottom: '12px'
                }}
              >
                <span style={{ fontSize: '0.72rem', lineHeight: 1 }}>第{wIndex + 1}站</span>
                <span style={{ fontSize: '1.1rem', lineHeight: 1.1 }}>
                  {isDone ? (isWithinWorkingDays ? '✓' : '⚠️') : isCurrent ? '🚇' : '⏳'}
                </span>
              </div>

              {/* Station Details Card */}
              <div
                style={{
                  width: '100%',
                  backgroundColor: isCurrent
                    ? '#fff8e1'
                    : isDone
                    ? isWithinWorkingDays
                      ? '#e8f5e9'
                      : '#fff5f5'
                    : '#f5f5f5',
                  border: `2.5px solid ${stationColor}`,
                  borderRadius: '12px',
                  padding: '10px 8px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '2px 2px 0px rgba(0,0,0,0.12)',
                  flex: 1
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.98rem', color: 'var(--crayon-dark)' }}>
                  {w.name}
                </div>

                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: 'var(--crayon-blue)',
                    backgroundColor: 'white',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    border: '1px dashed var(--crayon-blue)'
                  }}
                >
                  👤 負責：{assigneeName}
                </div>

                {/* Status & SLA Pill */}
                {isDone ? (
                  isWithinWorkingDays ? (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 'bold',
                        backgroundColor: '#c8e6c9',
                        color: '#1b5e20',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--crayon-dark)'
                      }}
                    >
                      ✅ 已過站（耗時 {spentDays}天 / 標準 {standardDays}天）
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 'bold',
                        backgroundColor: '#ffcdd2',
                        color: '#b71c1c',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--crayon-red)'
                      }}
                    >
                      ⚠️ 超標 +{spentDays - standardDays}天（耗時 {spentDays}天）
                    </span>
                  )
                ) : isCurrent ? (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      backgroundColor: isWithinWorkingDays ? 'var(--crayon-orange)' : '#ffcdd2',
                      color: isWithinWorkingDays ? 'white' : '#b71c1c',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: '1.5px dashed var(--crayon-dark)'
                    }}
                  >
                    🚇 停靠處理中（已停留 {spentDays}天 / 標準 {standardDays}天）
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      backgroundColor: '#eeeeee',
                      color: '#777',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: '1px solid #ccc'
                    }}
                  >
                    ⏳ 尚未到站（標準 {standardDays}天）
                  </span>
                )}

                {/* Dates */}
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#333', marginTop: '2px' }}>
                  {isDone && doneTimestamp ? (
                    startMs && formatFullDate(startMs) !== formatFullDate(doneTimestamp) ? (
                      <>
                        <div>進站：{formatFullDate(startMs)}</div>
                        <div>出站：{formatFullDate(doneTimestamp)}</div>
                      </>
                    ) : (
                      <div>完成日：{formatFullDate(doneTimestamp)}</div>
                    )
                  ) : isCurrent && startMs ? (
                    <>
                      <div>進站：{formatFullDate(startMs)}</div>
                      <div style={{ color: '#e65100' }}>目前停留本站</div>
                    </>
                  ) : (
                    <div style={{ color: '#999' }}>日期：-</div>
                  )}
                </div>

                {/* Note Icon / Add Note Button */}
                {!forPrint && (onOpenStageNote || onViewStageNote) && (
                  <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
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
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--crayon-yellow)',
                            border: '2px solid var(--crayon-dark)',
                            boxShadow: '2px 2px 0px rgba(0,0,0,0.22)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem',
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

                {/* Print-only Note Content */}
                {forPrint && ticket.stageNotes?.[w.id]?.text && (
                  <div
                    style={{
                      marginTop: '6px',
                      width: '100%',
                      padding: '6px 8px',
                      backgroundColor: '#fffde7',
                      border: '1.5px dashed var(--crayon-orange)',
                      borderRadius: '8px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontSize: '0.76rem', fontWeight: 'bold', color: '#e65100' }}>
                      📝 備註：
                    </div>
                    {ticket.stageNotes[w.id].html ? (
                      <div
                        style={{
                          fontSize: ticket.stageNotes[w.id].fontSize || '14px',
                          color: ticket.stageNotes[w.id].color || '#2c3e50',
                          textAlign: ticket.stageNotes[w.id].textAlign || 'left',
                          wordBreak: 'break-word'
                        }}
                        dangerouslySetInnerHTML={{ __html: ticket.stageNotes[w.id].html! }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: ticket.stageNotes[w.id].fontSize || '14px',
                          color: ticket.stageNotes[w.id].color || '#2c3e50',
                          textAlign: ticket.stageNotes[w.id].textAlign || 'left',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {ticket.stageNotes[w.id].text}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
      {/* Top Header & Legend & Print Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '8px',
          paddingBottom: '10px',
          borderBottom: '2px dashed var(--crayon-dark)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--crayon-dark)', marginRight: '4px' }}>
            🚇 捷運站點式「流程里程碑時間軸」
          </span>
          <span
            style={{
              fontSize: '0.84rem',
              fontWeight: 'bold',
              backgroundColor: '#e8f5e9',
              border: '2px solid var(--crayon-green)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            ✓ 已過站（正常）
          </span>
          <span
            style={{
              fontSize: '0.84rem',
              fontWeight: 'bold',
              backgroundColor: '#ffcdd2',
              border: '2px solid var(--crayon-red)',
              color: '#b71c1c',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            ⚠️ 已過站（超標）
          </span>
          <span
            style={{
              fontSize: '0.84rem',
              fontWeight: 'bold',
              backgroundColor: '#fff3e0',
              border: '2px solid var(--crayon-orange)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            🚇 目前停靠站
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

      <div style={{ overflowX: 'auto' }}>{renderMetroContent(false)}</div>

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
                marginBottom: '12px'
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', color: 'var(--crayon-dark)' }}>
                  🚇 盤點單流程捷運里程碑 — 單號：{ticket.id}
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
            {renderMetroContent(true)}
          </div>
        </div>
      )}
    </div>
  );
}
