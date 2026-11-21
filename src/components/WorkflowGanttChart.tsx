import type { InventoryTicket, Workflow } from '../types';

interface WorkflowGanttChartProps {
  ticket: InventoryTicket;
  workflows: Workflow[];
  nextStage: Workflow | null;
  isFinished: boolean;
  getAssigneeName: (id: string) => string;
  calculateDays: (startMs: number, endMs: number) => number;
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
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export default function WorkflowGanttChart({
  ticket,
  workflows,
  nextStage,
  isFinished,
  getAssigneeName,
  calculateDays
}: WorkflowGanttChartProps) {
  const nowMs = Date.now();

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
      if (previousDate) {
        const days = calculateDays(previousDate, doneTimestamp);
        spentDays = days;
        spentDaysText = days === 0 ? '0天' : `${days}天`;
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
  const maxColumns = 12;
  const headerColumns: { label: string; dayIndex: number }[] = [];
  if (totalDays <= maxColumns) {
    for (let i = 0; i < totalDays; i++) {
      headerColumns.push({
        label: formatShortDate(timelineStartDay + i * DAY_MS),
        dayIndex: i
      });
    }
  } else {
    const colCount = 8;
    for (let i = 0; i < colCount; i++) {
      const dayIdx = Math.round((i * (totalDays - 1)) / (colCount - 1));
      headerColumns.push({
        label: formatShortDate(timelineStartDay + dayIdx * DAY_MS),
        dayIndex: dayIdx
      });
    }
  }

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
      {/* Top Header & Legend */}
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
      </div>

      {/* Gantt Table Structure */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '640px' }}>
          {/* Column Header Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 95px 130px 1fr',
              backgroundColor: 'var(--crayon-dark)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              borderRadius: '8px 8px 0 0',
              border: '2px solid var(--crayon-dark)'
            }}
          >
            <div style={{ padding: '8px 10px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>
              關卡 / 負責人
            </div>
            <div
              style={{
                padding: '8px 6px',
                textAlign: 'center',
                borderRight: '1px solid rgba(255,255,255,0.25)'
              }}
            >
              狀態
            </div>
            <div
              style={{
                padding: '8px 6px',
                textAlign: 'center',
                borderRight: '1px solid rgba(255,255,255,0.25)'
              }}
            >
              完成日 / 耗時
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
              {headerColumns.map((col, idx) => (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    borderRight:
                      idx < headerColumns.length - 1
                        ? '1px dashed rgba(255,255,255,0.25)'
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
              widthPct = Math.min(100, Math.max(rawWidth, 6));
              leftPct = Math.max(0, Math.min(rawLeft, 100 - widthPct));
            }

            const rowBg = isCurrent
              ? '#fff8e1'
              : isDone
              ? '#f9fbe7'
              : '#fafafa';

            return (
              <div
                key={w.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 95px 130px 1fr',
                  backgroundColor: rowBg,
                  borderLeft: '2px solid var(--crayon-dark)',
                  borderRight: '2px solid var(--crayon-dark)',
                  borderBottom: '2px solid var(--crayon-dark)',
                  alignItems: 'center',
                  minHeight: '54px'
                }}
              >
                {/* Col 1: Stage Name & Assignee */}
                <div
                  style={{
                    padding: '8px 10px',
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
                        padding: '1px 7px',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        fontWeight: 'bold',
                        border: '1px solid var(--crayon-dark)'
                      }}
                    >
                      關卡 {wIndex + 1}
                    </span>
                    <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--crayon-dark)' }}>
                      {w.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--crayon-blue)',
                      fontWeight: 'bold'
                    }}
                  >
                    👤 負責：{assigneeName}
                  </div>
                </div>

                {/* Col 2: Status Badge */}
                <div
                  style={{
                    padding: '6px',
                    textAlign: 'center',
                    borderRight: '2px dashed #ccc',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%'
                  }}
                >
                  {isDone ? (
                    <span
                      style={{
                        backgroundColor: '#e8f5e9',
                        color: '#1b5e20',
                        border: '2px solid var(--crayon-green)',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.82rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ✅ 已完成
                    </span>
                  ) : isCurrent ? (
                    <span
                      style={{
                        backgroundColor: 'var(--crayon-orange)',
                        color: 'white',
                        border: '2px dashed var(--crayon-dark)',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.82rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      📍 處理中
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: '#eeeeee',
                        color: '#777',
                        border: '2px solid #ccc',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.82rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ⏳ 待處理
                    </span>
                  )}
                </div>

                {/* Col 3: Date & Spent Days */}
                <div
                  style={{
                    padding: '6px 8px',
                    textAlign: 'center',
                    borderRight: '2px dashed #ccc',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isDone ? '#000' : '#777' }}>
                    {isDone && doneTimestamp
                      ? new Date(doneTimestamp).toLocaleDateString()
                      : isCurrent && startMs
                      ? `${formatShortDate(startMs)} ~ 至今`
                      : '-'}
                  </div>
                  {isDone && spentDaysText && (
                    <span
                      style={{
                        fontSize: '0.78rem',
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
                  )}
                  {isCurrent && spentDaysText && (
                    <span
                      style={{
                        fontSize: '0.78rem',
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
                  )}
                </div>

                {/* Col 4: Gantt Bar Track */}
                <div
                  style={{
                    position: 'relative',
                    height: '38px',
                    margin: '0 8px',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1.5px solid #ddd',
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

                  {/* Gantt Bar for Done or Current Stage */}
                  {(isDone || isCurrent) && startMs !== null && endMs !== null ? (
                    <div
                      title={`${w.name} (${formatFullDate(startMs)} ~ ${formatFullDate(endMs)})`}
                      style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: '26px',
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
                        fontSize: '0.78rem',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        zIndex: 2,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {startMs && endMs && toDayStart(startMs) !== toDayStart(endMs)
                        ? `${formatShortDate(startMs)}~${formatShortDate(endMs)}`
                        : formatShortDate(endMs)}
                      {spentDaysText ? ` (${spentDaysText})` : ''}
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        fontSize: '0.8rem',
                        color: '#aaa',
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
      </div>
    </div>
  );
}
