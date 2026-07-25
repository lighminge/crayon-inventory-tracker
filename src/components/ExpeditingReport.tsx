import { useState, useMemo, useRef } from 'react';
import type { InventoryTicket, Personnel, InventoryTask, Workflow } from '../types';
import CrayonDatePicker from './CrayonDatePicker';
import { calculateBusinessDays } from '../utils/dateUtils';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

interface ExpeditingReportProps {
  tickets: InventoryTicket[];
  personnel: Personnel[];
  tasks: InventoryTask[];
  workflows: Workflow[];
}

export default function ExpeditingReport({ tickets, personnel, tasks, workflows }: ExpeditingReportProps) {
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedDays, setSelectedDays] = useState('1'); // "1" ~ "7"
  const [sortBy, setSortBy] = useState('processingDays'); // 'id', 'stage', 'assignee', 'processingDays'
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Ref for image export
  const reportRef = useRef<HTMLDivElement>(null);

  const getFirstStageDate = (t: InventoryTicket) => {
    if (t.dispatchDate) return t.dispatchDate;
    if (Object.keys(t.stageDates).length === 0) return null;
    const timestamps = Object.values(t.stageDates);
    return Math.min(...timestamps);
  };

  // Process and filter data
  const processedTickets = useMemo(() => {
    const startMs = startDate ? new Date(startDate).getTime() : 0;
    const endMs = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
    const daysThreshold = parseInt(selectedDays, 10);

    const filtered = tickets.filter(t => {
      // Date range filter (using dispatchDate or firstStageDate)
      const firstDate = getFirstStageDate(t);
      const dateToUse = firstDate || (t.id ? new Date(2020, 0, 1).getTime() : 0); // fallback
      if (dateToUse < startMs || dateToUse > endMs) return false;
      
      // Task filter
      if (selectedTaskId && t.taskId !== selectedTaskId) return false;
      
      // Personnel filter
      if (selectedAssigneeId && t.assigneeId !== selectedAssigneeId) return false;
      
      return true;
    }).map(t => {
      const firstDate = getFirstStageDate(t);
      // Calculate processing days up to today if not closed
      const endDateForDays = t.closeDate || Date.now();
      const processingDays = firstDate ? calculateBusinessDays(firstDate, endDateForDays) : 0;
      
      // Find current stage
      let currentStage = '未開始';
      let currentStageAssigneeId = t.assigneeId;
      
      if (t.closeDate) {
        currentStage = '✅ 結案';
      } else {
        // Find highest index stage that is completed
        let highestCompletedIdx = -1;
        for (let i = 0; i < workflows.length; i++) {
          if (t.stageDates[workflows[i].id]) {
            highestCompletedIdx = i;
          }
        }
        if (highestCompletedIdx === workflows.length - 1) {
          currentStage = '等待結案核准';
        } else if (highestCompletedIdx >= 0 && highestCompletedIdx < workflows.length - 1) {
          const nextW = workflows[highestCompletedIdx + 1];
          currentStage = `進行中: ${nextW.name}`;
          currentStageAssigneeId = nextW.assigneeId === 'DYNAMIC_ASSIGNEE' ? t.assigneeId : (nextW.assigneeId || t.assigneeId);
        } else if (highestCompletedIdx === -1 && workflows.length > 0) {
          const firstW = workflows[0];
          currentStage = `準備進行: ${firstW.name}`;
          currentStageAssigneeId = firstW.assigneeId === 'DYNAMIC_ASSIGNEE' ? t.assigneeId : (firstW.assigneeId || t.assigneeId);
        }
      }
      
      return {
        ...t,
        processingDays,
        currentStage,
        currentStageAssigneeId
      };
    }).filter(t => {
      // Days filter
      if (daysThreshold === 7) {
        return t.processingDays >= 7;
      } else {
        return t.processingDays >= daysThreshold;
      }
    });
    
    // Sorting
    return filtered.sort((a, b) => {
      if (sortBy === 'id') {
        return a.id.localeCompare(b.id);
      } else if (sortBy === 'stage') {
        return a.currentStage.localeCompare(b.currentStage);
      } else if (sortBy === 'assignee') {
        const nameA = getAssigneeName(a.currentStageAssigneeId);
        const nameB = getAssigneeName(b.currentStageAssigneeId);
        return nameA.localeCompare(nameB);
      } else { // processingDays
        return b.processingDays - a.processingDays;
      }
    });
  }, [tickets, startDate, endDate, selectedTaskId, selectedAssigneeId, selectedDays, workflows, sortBy]);

  // Pagination logic
  const totalPages = Math.ceil(processedTickets.length / itemsPerPage);
  const currentData = processedTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // When filters change, reset page
  useMemo(() => setCurrentPage(1), [startDate, endDate, selectedTaskId, selectedAssigneeId, selectedDays]);

  const getRowColor = (days: number) => {
    if (days >= 7) return '#e1bee7'; // Purple
    if (days === 6) return '#ef9a9a'; // Darker red
    if (days === 5) return '#ffcdd2'; // Light red
    if (days === 4) return '#ffe0b2'; // Orange
    if (days === 3) return '#fff9c4'; // Yellow
    return 'transparent';
  };
  
  const getAssigneeName = (id: string) => {
    return personnel.find(p => p.id === id)?.name || id || '未知';
  };

  const getTaskName = (id?: string) => {
    return tasks.find(t => t.id === id)?.name || '-';
  };

  // Export Functions
  const exportToExcel = () => {
    const exportData = processedTickets.map(t => ({
      '單號': t.id,
      '標題/備註': t.title,
      '盤點任務': getTaskName(t.taskId),
      '目前狀態': t.currentStage,
      '負責人員': getAssigneeName(t.currentStageAssigneeId),
      '總處理天數': t.processingDays
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "稽催報表");
    XLSX.writeFile(wb, `稽催報表_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToText = () => {
    let content = `稽催報表 (${new Date().toISOString().split('T')[0]})\n`;
    content += `總筆數: ${processedTickets.length}\n`;
    content += `篩選條件: ${startDate} ~ ${endDate} | 天數 >= ${selectedDays}天\n`;
    content += `----------------------------------------------------------\n\n`;
    
    processedTickets.forEach(t => {
      content += `單號: ${t.id}\n`;
      content += `任務: ${getTaskName(t.taskId)}\n`;
      content += `狀態: ${t.currentStage}\n`;
      content += `負責人員: ${getAssigneeName(t.currentStageAssigneeId)}\n`;
      content += `處理天數: ${t.processingDays} 天\n`;
      content += `------------------------\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `稽催報表_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToImage = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `稽催報表_${new Date().toISOString().split('T')[0]}.png`;
      a.click();
    } catch (e) {
      console.error(e);
      alert('匯出圖片失敗');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="doodle-border" style={{ backgroundColor: 'white', padding: '20px' }}>
        <h2 style={{ marginTop: 0, color: 'var(--crayon-orange)' }}>🔍 稽催報表條件篩選</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>起始日期</label>
            <CrayonDatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>結束日期</label>
            <CrayonDatePicker value={endDate} onChange={setEndDate} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>盤點任務</label>
            <select className="doodle-input" value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value)}>
              <option value="">-- 全部任務 --</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>盤點人員</label>
            <select className="doodle-input" value={selectedAssigneeId} onChange={e => setSelectedAssigneeId(e.target.value)}>
              <option value="">-- 全部人員 --</option>
              {personnel.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>盤點單處理天數</label>
            <select className="doodle-input" value={selectedDays} onChange={e => setSelectedDays(e.target.value)}>
              <option value="1">1天 (含) 以上</option>
              <option value="2">2天 (含) 以上</option>
              <option value="3">3天 (含) 以上</option>
              <option value="4">4天 (含) 以上</option>
              <option value="5">5天 (含) 以上</option>
              <option value="6">6天 (含) 以上</option>
              <option value="7">7天以上</option>
            </select>
          </div>
        </div>
      </div>

      <div className="doodle-border" style={{ backgroundColor: 'white', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ margin: 0, color: 'var(--crayon-red)' }}>📄 符合條件清單 (共 {processedTickets.length} 筆)</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontWeight: 'bold' }}>分類排序:</label>
              <select className="doodle-input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '5px' }}>
                <option value="id">單號</option>
                <option value="stage">目前狀態</option>
                <option value="assignee">負責人</option>
                <option value="processingDays">處理天數 (大至小)</option>
              </select>
            </div>
            <button className="doodle-button success" onClick={exportToImage}>🖼️ 匯出圖檔</button>
            <button className="doodle-button success" onClick={exportToExcel}>📊 匯出 Excel</button>
            <button className="doodle-button success" onClick={exportToText}>📝 匯出文字檔</button>
          </div>
        </div>

        {/* Legend for colors (moved to top) */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', fontSize: '0.9rem', flexWrap: 'wrap', backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '5px', border: '2px dashed var(--crayon-dark)' }}>
          <strong style={{ marginRight: '10px' }}>顏色說明 (處理天數):</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ display: 'inline-block', width: '20px', height: '20px', backgroundColor: getRowColor(3), border: '1px solid #ccc', borderRadius: '4px' }}></span> 3天</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ display: 'inline-block', width: '20px', height: '20px', backgroundColor: getRowColor(4), border: '1px solid #ccc', borderRadius: '4px' }}></span> 4天</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ display: 'inline-block', width: '20px', height: '20px', backgroundColor: getRowColor(5), border: '1px solid #ccc', borderRadius: '4px' }}></span> 5天</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ display: 'inline-block', width: '20px', height: '20px', backgroundColor: getRowColor(6), border: '1px solid #ccc', borderRadius: '4px' }}></span> 6天</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ display: 'inline-block', width: '20px', height: '20px', backgroundColor: getRowColor(7), border: '1px solid #ccc', borderRadius: '4px' }}></span> 7天以上</div>
        </div>

        {/* Pagination (Top) */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <button 
              className="doodle-button" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              上一頁
            </button>
            <span style={{ fontWeight: 'bold' }}>{currentPage} / {totalPages}</span>
            <button 
              className="doodle-button" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              下一頁
            </button>
          </div>
        )}

        <div ref={reportRef} style={{ padding: '10px', backgroundColor: 'white' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Table Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1.5fr 2fr 1fr 1fr', gap: '10px', padding: '10px', borderBottom: '3px solid var(--crayon-dark)', fontWeight: 'bold', fontSize: '1.1rem', backgroundColor: '#e0f7fa', borderRadius: '5px' }}>
              <div style={{ textAlign: 'center' }}>序號</div>
              <div>單號</div>
              <div>盤點任務</div>
              <div>目前狀態</div>
              <div>負責人</div>
              <div style={{ textAlign: 'center' }}>處理天數</div>
            </div>
            
            {/* Table Body */}
            {currentData.length > 0 ? currentData.map((t, idx) => (
              <div 
                key={t.id} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '50px 1fr 1.5fr 2fr 1fr 1fr', 
                  gap: '10px', 
                  padding: '10px', 
                  backgroundColor: getRowColor(t.processingDays),
                  border: '2px solid var(--crayon-dark)',
                  alignItems: 'center',
                  borderRadius: '10px',
                  boxShadow: '2px 2px 0px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: 'white', padding: '5px', borderRadius: '5px', border: '1px solid #ccc' }}>
                  {(currentPage - 1) * itemsPerPage + idx + 1}
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--crayon-dark)', backgroundColor: 'rgba(255,255,255,0.7)', padding: '5px', borderRadius: '5px', border: '1px dashed #999' }}>{t.id}</div>
                <div style={{ color: 'var(--crayon-green)', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.7)', padding: '5px', borderRadius: '5px', border: '1px dashed #999' }}>{getTaskName(t.taskId)}</div>
                <div style={{ color: 'var(--crayon-blue)', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.7)', padding: '5px', borderRadius: '5px', border: '1px dashed #999' }}>{t.currentStage}</div>
                <div style={{ color: 'var(--crayon-purple)', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.7)', padding: '5px', borderRadius: '5px', border: '1px dashed #999' }}>{getAssigneeName(t.currentStageAssigneeId)}</div>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: t.processingDays >= 3 ? 'white' : 'var(--crayon-dark)', backgroundColor: t.processingDays >= 3 ? 'var(--crayon-red)' : 'rgba(255,255,255,0.7)', padding: '5px', borderRadius: '5px', border: '2px solid var(--crayon-dark)' }}>
                  {t.processingDays} 天
                </div>
              </div>
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>沒有符合條件的資料</div>
            )}
          </div>
        </div>
        
        {/* Pagination (Not exported in image) */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
            <button 
              className="doodle-button" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              上一頁
            </button>
            <span style={{ fontWeight: 'bold' }}>{currentPage} / {totalPages}</span>
            <button 
              className="doodle-button" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              下一頁
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
