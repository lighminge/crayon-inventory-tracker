import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import type { InventoryTicket, Workflow } from '../types';

interface WorkflowGanttChartProps {
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

const DAY_MS = 24 * 60 * 60 * 1000;

const toDayStart = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const formatShortDate = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatFullDate = (ms: number): string => {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
};

export default function WorkflowGanttChart({
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
}: WorkflowGanttChartProps) {
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
        a.download = `盤點單流程甘特圖_${ticket.id}_${dateStr}.png`;
        a.click();
      } catch (err) {
        console.error(err);
        alert('列印甘特圖檔失敗');
      } finally {
        if (!cancelled) setIsPrinting(false);
      }
    };
    capture();
    return () => {
      cancelled = true;
    };
  }, [isPrinting, ticket.id]);

  // Build stage data
  const stageRows = workflows.map((w, wIndex) => {
    const doneTimestamp = ticket.stageDates ? ticket.stageDates[w.id] : undefined;
    const isDone = Boolean(doneTimestamp);
    const isCurrent = !isFinished && nextStage?.id === w.id;

    const previousDate =
      wIndex === 0
        ? ticket.dispatchDate
        : ticket.stageDates && ticket.stageDates[workflows[wIndex - 1].id];

    // Fallback reference date if previous stage date is missing
    let refPrevDate: number | null = previousDate || null;
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
    let spentDaysText = '';

    if (isDone && doneTimestamp) {
      endMs = doneTimestamp;
      startMs = refPrevDate ? Math.min(refPrevDate, endMs) : endMs;
      if (refPrevDate) {
        const days = calculateDays(refPrevDate, doneTimestamp);
        spentDays = days;
        spentDaysText = days === 0 ? '0天' : `${days}天`;
      } else {
        spentDaysText = '0天';
      }
    } else if (isCurrent) {
      startMs = refPrevDate || ticket.dispatchDate || nowMs;
      endMs = Math.max(startMs, nowMs);
      spentDays = calculateDays(startMs, endMs);
      spentDaysText = `${spentDays}天`;
    }

    const isWithinWorkingDays = spentDays <= (w.workingDays ?? 0);
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
      spentDaysText,
      isWithinWorkingDays,
      assigneeName
    };
  });

  // Determine overall timeline range
  const activeDayPoints: number[] = [];
  if (ticket.dispatchDate) {
    activeDayPoints.push(toDayStart(ticket.dispatchDate));
  }
  stageRows.forEach(r => {
    if (r.startMs) activeDayPoints.push(toDayStart(r.startMs));
    if (r.endMs) activeDayPoints.push(toDayStart(r.endMs));
  });

  const timelineStartDay =
    activeDayPoints.length > 0 ? Math.min(...activeDayPoints) : toDayStart(nowMs);
  const timelineEndDay =
    activeDayPoints.length > 0 ? Math.max(...activeDayPoints) : timelineStartDay;

  const totalDays = Math.max(
    1,
    Math.round((timelineEndDay - timelineStartDay) / DAY_MS) + 1
  );

  // Build header columns for the timeline
  const maxColumns = 10;
  const headerColumns: { label: string; fullLabel: string; dayIndex: number }[] = [];
  if (totalDays <= maxColumns) {
    for (let i = 0; i < totalDays; i++) {
      const dayTs = timelineStartDay + i * DAY_MS;
      headerColumns.push({
        label: totalDays <= 5 ? formatFullDate(dayTs) : formatShortDate(dayTs),
        fullLabel: formatFullDate(dayTs),
        dayIndex: i
      });
    }
  } else {
    const colCount = 8;
    for (let i = 0; i < colCount; i++) {
      const dayIdx = Math.round((i * (totalDays - 1)) / (colCount - 1));
      const dayTs = timelineStartDay + dayIdx * DAY_MS;
      headerColumns.push({
        label: formatShortDate(dayTs),
        fullLabel: formatFullDate(dayTs),
        dayIndex: dayIdx
      });
    }
  }

  const renderGanttTable = (forPrint = false) => {
    const gridCols = forPrint
      ? '190px 100px 195px 1fr'
      : '180px 95px 175px 1fr';

    return (
      <div style={{ minWidth: forPrint ? '100%' : '680px' }}>
        {/* Column Header Row */}
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
              padding: '10px 6px',
              textAlign: 'center',
              borderRight: '1px solid rgba(255,255,255,0.25)'
            }}
          >
            狀態
          </div>
          <div
            style={{
              padding: '10px 8px',
              textAlign: 'center',
              borderRight: '1px solid rgba(255,255,255,0.25)'
            }}
          >
            流程日期 / 耗時
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0' }}>
            {headerColumns.map((col, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: forPrint ? '0.85rem' : '0.8rem',
                  borderRight:
                    idx < headerColumns.length - 1
                      ? '1px dashed rgba(255,255,255,0.3)'
                      : 'none'
                }}
              >
                {col.label}
              </div>
            ))}
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
            endMs,
            doneTimestamp,
            spentDaysText,
            isWithinWorkingDays,
            assigneeName
          } = row;

          let leftPct = 0;
          let widthPct = 0;
          if (startMs !== null && endMs !== null) {
            const startDayIdx = Math.max(
              0,
              Math.round((toDayStart(startMs) - timelineStartDay) / DAY_MS)
            );
            const endDayIdx = Math.max(
              startDayIdx,
              Math.round((toDayStart(endMs) - timelineStartDay) / DAY_MS)
            );
            const rawLeft = (startDayIdx / totalDays) * 100;
            const rawWidth = ((endDayIdx - startDayIdx + 1) / totalDays) * 100;
            widthPct = Math.min(100, Math.max(rawWidth, 8));
            leftPct = Math.max(0, Math.min(rawLeft, 100 - widthPct));
          }

          const rowBg = isCurrent
            ? '#fff8e1'
            : isDone
            ? isWithinWorkingDays
              ? '#f9fbe7'
              : '#fff5f5'
            : '#fafafa';

          const isSameDay =
            startMs !== null &&
            endMs !== null &&
            toDayStart(startMs) === toDayStart(endMs);

          const barDateLabel =
            startMs !== null && endMs !== null
              ? isDone
                ? isSameDay
                  ? `${formatFullDate(endMs)}${spentDaysText ? ` (${spentDaysText})` : ''}`
                  : `${formatFullDate(startMs)} ~ ${formatFullDate(endMs)}${
                      spentDaysText ? ` (${spentDaysText})` : ''
                    }`
                : `${formatFullDate(startMs)} ~ ${formatFullDate(endMs)} (處理中 ${spentDaysText})`
              : '';

          // Decide whether the label sits inside the bar or in an unclipped pill beside/over the bar
          const canFitInsideBar = isSameDay ? widthPct >= 34 : widthPct >= 52;

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
                minHeight: forPrint ? '68px' : '62px'
              }}
            >
              {/* Col 1: Stage Name & Assignee */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRight: '2px dashed #ccc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
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
                  <span
                    style={{
                      fontWeight: 'bold',
                      fontSize: forPrint ? '1.05rem' : '0.98rem',
                      color: 'var(--crayon-dark)'
                    }}
                  >
                    {w.name}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: forPrint ? '0.88rem' : '0.82rem',
                    color: 'var(--crayon-blue)',
                    fontWeight: 'bold'
                  }}
                >
                  👤 負責：{assigneeName}
                </div>
                {!forPrint && (onOpenStageNote || onViewStageNote) && (
                  <div style={{ marginTop: '4px' }}>
                    {ticket.stageNotes?.[w.id]?.text ? (
                      <button
                        type="button"
                        onClick={() =>
                          onViewStageNote
                            ? onViewStageNote(w, wIndex)
                            : onOpenStageNote && onOpenStageNote(w, wIndex)
                        }
                        title="點擊查看此關卡備註內容"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--crayon-yellow)',
                          border: '2px solid var(--crayon-dark)',
                          boxShadow: '2px 2px 0px rgba(0,0,0,0.22)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '1.05rem',
                          padding: 0,
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.12)')}
                        onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        📝
                      </button>
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

              {/* Col 2: Status Badge */}
              <div
                style={{
                  padding: '6px',
                  textAlign: 'center',
                  borderRight: '2px dashed #ccc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '4px',
                  height: '100%'
                }}
              >
                {isDone ? (
                  isWithinWorkingDays ? (
                    <span
                      style={{
                        backgroundColor: '#e8f5e9',
                        color: '#1b5e20',
                        border: '2px solid var(--crayon-green)',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: forPrint ? '0.88rem' : '0.82rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ✅ 已完成
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: '#ffcdd2',
                        color: '#b71c1c',
                        border: '2px solid var(--crayon-red)',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: forPrint ? '0.88rem' : '0.82rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ⚠️ 耗時超標
                    </span>
                  )
                ) : isCurrent ? (
                  <>
                    <span
                      style={{
                        backgroundColor: 'var(--crayon-orange)',
                        color: 'white',
                        border: '2px dashed var(--crayon-dark)',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: forPrint ? '0.88rem' : '0.82rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      📍 處理中
                    </span>
                    {!isWithinWorkingDays && (
                      <span
                        style={{
                          backgroundColor: '#ffcdd2',
                          color: '#b71c1c',
                          border: '2px solid var(--crayon-red)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: forPrint ? '0.82rem' : '0.76rem',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        ⚠️ 耗時超標
                      </span>
                    )}
                  </>
                ) : (
                  <span
                    style={{
                      backgroundColor: '#eeeeee',
                      color: '#777',
                      border: '2px solid #ccc',
                      padding: '3px 9px',
                      borderRadius: '12px',
                      fontSize: forPrint ? '0.88rem' : '0.82rem',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ⏳ 待處理
                  </span>
                )}
              </div>

              {/* Col 3: Explicit Date Details & Spent Days */}
              <div
                style={{
                  padding: '6px 10px',
                  textAlign: 'left',
                  borderRight: '2px dashed #ccc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '3px'
                }}
              >
                {isDone && doneTimestamp ? (
                  <>
                    {startMs && !isSameDay ? (
                      <>
                        <div style={{ fontSize: forPrint ? '0.88rem' : '0.82rem', fontWeight: 'bold', color: '#444' }}>
                          起：{formatFullDate(startMs)}
                        </div>
                        <div style={{ fontSize: forPrint ? '0.92rem' : '0.86rem', fontWeight: 'bold', color: '#000' }}>
                          迄：{formatFullDate(doneTimestamp)}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: forPrint ? '0.92rem' : '0.86rem', fontWeight: 'bold', color: '#000' }}>
                        完成：{formatFullDate(doneTimestamp)}
                      </div>
                    )}
                    {spentDaysText && (
                      <div>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: forPrint ? '0.82rem' : '0.78rem',
                            fontWeight: 'bold',
                            color: 'var(--crayon-dark)',
                            backgroundColor: isWithinWorkingDays ? '#c8e6c9' : '#ffcdd2',
                            padding: '1px 8px',
                            borderRadius: '6px',
                            border: '1.5px solid var(--crayon-dark)'
                          }}
                        >
                          耗時: {spentDaysText}
                        </span>
                      </div>
                    )}
                  </>
                ) : isCurrent && startMs ? (
                  <>
                    <div style={{ fontSize: forPrint ? '0.88rem' : '0.82rem', fontWeight: 'bold', color: '#444' }}>
                      起：{formatFullDate(startMs)}
                    </div>
                    <div style={{ fontSize: forPrint ? '0.88rem' : '0.82rem', fontWeight: 'bold', color: '#e65100' }}>
                      迄：{formatFullDate(endMs || nowMs)} (至今)
                    </div>
                    {spentDaysText && (
                      <div>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: forPrint ? '0.82rem' : '0.78rem',
                            fontWeight: 'bold',
                            color: '#e65100',
                            backgroundColor: '#ffe0b2',
                            padding: '1px 8px',
                            borderRadius: '6px',
                            border: '1.5px dashed #e65100'
                          }}
                        >
                          已進行: {spentDaysText}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: forPrint ? '0.9rem' : '0.85rem',
                      fontWeight: 'bold',
                      color: '#888'
                    }}
                  >
                    尚未開始 (-)
                  </div>
                )}
              </div>

              {/* Col 4: Gantt Bar Track with Unclipped Date Label */}
              <div
                style={{
                  position: 'relative',
                  height: forPrint ? '46px' : '42px',
                  margin: '0 10px',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1.5px solid #ccc',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {/* Background Grid Columns */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    pointerEvents: 'none'
                  }}
                >
                  {headerColumns.map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        borderRight:
                          idx < headerColumns.length - 1
                            ? '1px dashed #e0e0e0'
                            : 'none'
                      }}
                    />
                  ))}
                </div>

                {/* Gantt Bar & Unclipped Date Pill */}
                {(isDone || isCurrent) && startMs !== null && endMs !== null ? (
                  <>
                    <div
                      title={`${w.name} (${formatFullDate(startMs)} ~ ${formatFullDate(endMs)})`}
                      style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: forPrint ? '32px' : '28px',
                        borderRadius: '6px',
                        backgroundColor: isDone
                          ? isWithinWorkingDays
                            ? 'var(--crayon-green)'
                            : '#ef5350'
                          : 'var(--crayon-orange)',
                        backgroundImage: isCurrent
                          ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 8px, transparent 8px, transparent 16px)'
                          : 'none',
                        border: '2px solid var(--crayon-dark)',
                        boxShadow: '2px 2px 0px rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 6px',
                        color: 'white',
                        fontSize: forPrint ? '0.86rem' : '0.8rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        zIndex: 2
                      }}
                    >
                      {canFitInsideBar ? barDateLabel : ''}
                    </div>

                    {!canFitInsideBar && (
                      <div
                        style={{
                          position: 'absolute',
                          ...(leftPct + widthPct <= 55
                            ? { left: `calc(${leftPct + widthPct}% + 6px)` }
                            : leftPct >= 45
                            ? { right: `calc(${100 - leftPct}% + 6px)` }
                            : {
                                left: `${leftPct + widthPct / 2}%`,
                                transform: 'translateX(-50%)'
                              }),
                          backgroundColor: 'rgba(255, 253, 231, 0.96)',
                          color: 'var(--crayon-dark)',
                          border: '1.5px solid var(--crayon-dark)',
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: forPrint ? '0.84rem' : '0.78rem',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap',
                          boxShadow: '1px 1px 0px rgba(0,0,0,0.2)',
                          zIndex: 3
                        }}
                      >
                        {barDateLabel}
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      fontSize: forPrint ? '0.86rem' : '0.8rem',
                      color: '#999',
                      fontWeight: 'bold',
                      zIndex: 1
                    }}
                  >
                    尚未開始
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
          marginBottom: '12px',
          paddingBottom: '10px',
          borderBottom: '2px dashed var(--crayon-dark)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontWeight: 'bold',
              fontSize: '1.05rem',
              color: 'var(--crayon-dark)',
              marginRight: '6px'
            }}
          >
            📊 流程甘特圖表
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              backgroundColor: '#e8f5e9',
              border: '2px solid var(--crayon-green)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            ✅ 已完成
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              backgroundColor: '#fff3e0',
              border: '2px solid var(--crayon-orange)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            📍 處理中
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              backgroundColor: '#f5f5f5',
              border: '2px solid #bbb',
              color: '#666',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            ⏳ 待處理
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              backgroundColor: '#ffcdd2',
              border: '2px solid var(--crayon-red)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            ⚠️ 耗時超標
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              color: 'var(--crayon-blue)',
              backgroundColor: '#e3f2fd',
              padding: '4px 10px',
              borderRadius: '8px',
              border: '1px dashed var(--crayon-blue)'
            }}
          >
            📅 時間範圍：{formatFullDate(timelineStartDay)} ~ {formatFullDate(timelineEndDay)}（共 {totalDays} 天）
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
      </div>

      {/* On-screen Gantt Table */}
      <div style={{ overflowX: 'auto' }}>
        {renderGanttTable(false)}
      </div>

      {/* Off-screen Full Printable Gantt Report */}
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
            {/* Printable Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '3px dashed var(--crayon-dark)',
                paddingBottom: '14px',
                marginBottom: '16px'
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', color: 'var(--crayon-dark)' }}>
                  📊 盤點單流程甘特圖表 — 單號：{ticket.id}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      backgroundColor:
                        ticket.ticketType === 'TKW' ? 'var(--crayon-purple)' : 'var(--crayon-blue)',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '1rem'
                    }}
                  >
                    類型：{ticket.ticketType || '未指定'}
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--crayon-yellow)',
                      color: 'var(--crayon-dark)',
                      padding: '4px 14px',
                      borderRadius: '16px',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      border: '2px dashed var(--crayon-dark)'
                    }}
                  >
                    👤 盤點人員：{getAssigneeName(ticket.assigneeId)}
                  </span>
                  {ticket.itemCount !== undefined && ticket.itemCount !== null && (
                    <span
                      style={{
                        backgroundColor: '#e1bee7',
                        color: 'var(--crayon-dark)',
                        padding: '4px 14px',
                        borderRadius: '16px',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        border: '2px dashed var(--crayon-dark)'
                      }}
                    >
                      📦 項目數量：{ticket.itemCount} 項
                    </span>
                  )}
                  {taskName && (
                    <span
                      style={{
                        backgroundColor: '#b2dfdb',
                        color: 'var(--crayon-dark)',
                        padding: '4px 14px',
                        borderRadius: '16px',
                        fontWeight: 'bold',
                        fontSize: '1rem',
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
                        color: 'var(--crayon-dark)',
                        padding: '4px 14px',
                        borderRadius: '16px',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        border: '2px solid var(--crayon-dark)'
                      }}
                    >
                      ⏱️ 總處理天數：{totalProcessingDays} 天
                    </span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.98rem', color: '#333' }}>
                <div>列印日期：{formatFullDate(nowMs)}</div>
                <div style={{ marginTop: '6px', color: 'var(--crayon-blue)' }}>
                  流程期間：{formatFullDate(timelineStartDay)} ~ {formatFullDate(timelineEndDay)}（共 {totalDays} 天）
                </div>
                {isFinished && (
                  <div style={{ marginTop: '6px', color: '#2e7d32' }}>
                    ✓ 已結案（主管：{ticket.managerName || '-'}）
                  </div>
                )}
              </div>
            </div>

            {/* Legend Row in Print */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>狀態圖例：</span>
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  backgroundColor: '#e8f5e9',
                  border: '2px solid var(--crayon-green)',
                  padding: '2px 10px',
                  borderRadius: '12px'
                }}
              >
                ✅ 已完成（符合工作日數）
              </span>
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  backgroundColor: '#ffcdd2',
                  border: '2px solid var(--crayon-red)',
                  padding: '2px 10px',
                  borderRadius: '12px'
                }}
              >
                ⚠️ 已完成（耗時超標）
              </span>
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  backgroundColor: '#fff3e0',
                  border: '2px solid var(--crayon-orange)',
                  padding: '2px 10px',
                  borderRadius: '12px'
                }}
              >
                📍 處理中
              </span>
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  backgroundColor: '#f5f5f5',
                  border: '2px solid #bbb',
                  color: '#666',
                  padding: '2px 10px',
                  borderRadius: '12px'
                }}
              >
                ⏳ 待處理
              </span>
            </div>

            {/* Full-Width Gantt Table */}
            {renderGanttTable(true)}
          </div>
        </div>
      )}
    </div>
  );
}
