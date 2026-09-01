import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { useAuth } from '../contexts/AuthContext';
import { getTickets, addTicket, deleteTicket, updateTicket, getPersonnel } from '../services/api';
import type { InventoryTicket, Personnel } from '../types';
import CrayonDatePicker from '../components/CrayonDatePicker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, LabelList } from 'recharts';

export default function AdditionalTickets() {
  const { hasPermission } = useAuth();
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemAlert, setSystemAlert] = useState<{ message: string, onConfirm?: () => void } | null>(null);

  // Search/Filter State
  const [searchStartDate, setSearchStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [searchEndDate, setSearchEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchAssignee, setSearchAssignee] = useState('');
  const [searchTicketId, setSearchTicketId] = useState('');
  const [searchSubType, setSearchSubType] = useState('');
  const [searchTicketType, setSearchTicketType] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'id_asc' | 'id_desc' | 'person' | 'date_desc' | 'date_asc'>('id_asc');

  // Dispatch Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [targetPerson, setTargetPerson] = useState<Personnel | null>(null);
  const [newId, setNewId] = useState('');
  const [itemCount, setItemCount] = useState<string>('');
  const [completionDate, setCompletionDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [subType, setSubType] = useState<'低點表' | '領料單' | ''>('');
  const [ticketType, setTicketType] = useState<'夾鉗' | 'TKW' | ''>('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'composed'>('bar');
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');

  const loadData = async () => {
    try {
      const [ticketsData, personnelData] = await Promise.all([
        getTickets(),
        getPersonnel()
      ]);
      setTickets(ticketsData.filter(t => t.isAdditional).sort((a, b) => (b.dispatchDate || 0) - (a.dispatchDate || 0)));
      setPersonnel(personnelData);
    } catch (e) {
      console.error(e);
      setSystemAlert({ message: '讀取失敗' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (p: Personnel) => {
    setTargetPerson(p);
    setEditingTicketId(null);
    setNewId('');
    setItemCount('');
    setSubType('');
    setTicketType('');
    setCompletionDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: InventoryTicket) => {
    const p = personnel.find(x => x.id === t.assigneeId) || null;
    setTargetPerson(p);
    setEditingTicketId(t.id);
    setNewId(t.id);
    setItemCount(String(t.itemCount || ''));
    setSubType(t.subType as any || '');
    setTicketType(t.ticketType as any || '');
    setCompletionDate(t.closeDate ? new Date(t.closeDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!targetPerson) return;
    if (!newId.trim() || !itemCount || !completionDate) {
      return setSystemAlert({ message: '請填寫完整資訊' });
    }

    if (!editingTicketId && tickets.some(t => t.id === newId.trim())) {
      return setSystemAlert({ message: '此單號已存在' });
    }

    const timestamp = new Date(completionDate).getTime();
    const count = parseInt(itemCount, 10);
    if (isNaN(count) || count <= 0) {
      return setSystemAlert({ message: '項目數必須是大於0的整數' });
    }

    try {
      if (editingTicketId) {
        await updateTicket(editingTicketId, {
          assigneeId: targetPerson.id,
          itemCount: count,
          subType: subType as any || undefined,
          ticketType: ticketType as any || '追加',
          closeDate: timestamp,
          dispatchDate: timestamp
        });
      } else {
        const ticket: InventoryTicket = {
          id: newId.trim(),
          title: newId.trim(),
          subType: subType as any || undefined,
          ticketType: ticketType as any || '追加',
          isAdditional: true,
          assigneeId: targetPerson.id,
          dispatchDate: timestamp,
          closeDate: timestamp,
          stageDates: {},
          totalProcessingDays: 0,
          itemCount: count,
        };
        await addTicket(ticket);
      }
      setIsModalOpen(false);
      setTargetPerson(null);
      setEditingTicketId(null);
      loadData();
    } catch (err) {
      console.error(err);
      setSystemAlert({ message: '儲存失敗' });
    }
  };

  const handleDeletePrompt = (id: string) => {
    setSystemAlert({
      message: `確定要刪除追加單 ${id} 嗎？`,
      onConfirm: async () => {
        try {
          await deleteTicket(id);
          setSystemAlert(null);
          loadData();
        } catch (err) {
          console.error(err);
          setSystemAlert({ message: '刪除失敗' });
        }
      }
    });
  };

  if (loading) return <div className="doodle-border" style={{ padding: '20px' }}>載入中...</div>;

  const canEdit = hasPermission('tickets', 'edit');
  const assigneeOptions = personnel.filter(p => (p.roles || []).includes('盤點'));

  // Filtering Logic
  const filteredTickets = tickets.filter(t => {
    if (searchAssignee && t.assigneeId !== searchAssignee) return false;
    if (searchTicketId && !t.id.includes(searchTicketId)) return false;
    if (searchSubType && t.subType !== searchSubType) return false;
    if (searchTicketType && t.ticketType !== searchTicketType) return false;
    
    if (searchStartDate || searchEndDate) {
      const d = t.closeDate;
      if (!d) return false;
      
      if (searchStartDate) {
        const startTs = new Date(searchStartDate).getTime();
        if (d < startTs) return false;
      }
      
      if (searchEndDate) {
        // Add 24h to include the end date fully
        const endTs = new Date(searchEndDate).getTime() + 86400000;
        if (d >= endTs) return false;
      }
    }
    return true;
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (sortBy.startsWith('id')) {
      const cmp = a.id.localeCompare(b.id);
      return sortBy === 'id_asc' ? cmp : -cmp;
    }
    if (sortBy === 'person') {
      const nameA = personnel.find(p => p.id === a.assigneeId)?.name || '';
      const nameB = personnel.find(p => p.id === b.assigneeId)?.name || '';
      return nameA.localeCompare(nameB);
    }
    if (sortBy.startsWith('date')) {
      const dateA = a.closeDate || 0;
      const dateB = b.closeDate || 0;
      return sortBy === 'date_asc' ? dateA - dateB : dateB - dateA;
    }
    return 0;
  });

  // Chart Data
  const chartData = assigneeOptions.map(p => {
    const personTickets = filteredTickets.filter(t => t.assigneeId === p.id);
    const personItems = personTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
    return {
      name: p.name,
      '追加件數': personTickets.length,
      '項目數': personItems
    };
  }).filter(d => d['追加件數'] > 0);

  // Pagination Logic
  const totalItemsCount = filteredTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const paginatedTickets = sortedTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  const handleExportExcel = () => {
    const exportData = sortedTickets.map((t, idx) => ({
      '序號': idx + 1,
      '單號': t.id,
      '盤點類型': t.ticketType !== '追加' ? t.ticketType : '',
      '單據種類': t.subType || '',
      '負責人員': personnel.find(p => p.id === t.assigneeId)?.name || '未知人員',
      '項目數': t.itemCount || 0,
      '完成日期': t.closeDate ? new Date(t.closeDate).toISOString().split('T')[0] : ''
    }));

    if (exportData.length === 0) {
      alert('沒有資料可匯出');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '追加盤點清單');
    XLSX.writeFile(wb, `追加盤點清單_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportImage = async () => {
    const el = document.getElementById('additional-tickets-chart');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2 });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `追加盤點統計圖_${new Date().toISOString().split('T')[0]}.png`;
      a.click();
    } catch (e) {
      console.error(e);
      alert('匯出圖片失敗');
    }
  };

  return (

    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '2.5rem', color: 'var(--crayon-blue)' }}>
        ➕ 追加盤點
      </h2>

      {/* System Alert Modal */}
      {systemAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'white', textAlign: 'center' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{systemAlert.message}</p>
            <div style={{ marginTop: '25px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
              {systemAlert.onConfirm && (
                <button className="doodle-button danger" onClick={systemAlert.onConfirm}>確認</button>
              )}
              <button className="doodle-button" onClick={() => setSystemAlert(null)}>
                {systemAlert.onConfirm ? '取消' : '確定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {isModalOpen && (() => {
        const duplicateTicket = newId.trim() && !editingTicketId ? tickets.find(t => t.id === newId.trim()) : null;
        const duplicateAssigneeName = duplicateTicket ? personnel.find(p => p.id === duplicateTicket.assigneeId)?.name : '';
        return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 900, overflowY: 'auto', paddingTop: '10vh', paddingBottom: '10vh' }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', backgroundColor: '#e3f2fd', minHeight: '400px', overflow: 'visible' }}>
            <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>{editingTicketId ? '修改追加盤點單' : `指派追加單給 ${targetPerson?.name}`}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {editingTicketId && (
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>盤點人員：</label>
                  <select
                    className="doodle-input"
                    value={targetPerson?.id || ''}
                    onChange={e => setTargetPerson(personnel.find(p => p.id === e.target.value) || null)}
                    style={{ width: '100%' }}
                  >
                    {assigneeOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>追加單號：</label>
                <input 
                  type="text" 
                  className="doodle-input" 
                  value={newId}
                  onChange={e => setNewId(e.target.value)}
                  placeholder="例如: 260801"
                  style={{ width: '100%', borderColor: duplicateTicket ? 'var(--crayon-red)' : undefined }}
                  disabled={!!editingTicketId}
                />
                {duplicateTicket && (
                  <div style={{ color: 'var(--crayon-red)', marginTop: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    ⚠️ 此單號已派送給：{duplicateAssigneeName || '未知人員'}
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>盤點類型：</label>
                <select
                  className="doodle-input"
                  value={ticketType}
                  onChange={e => setTicketType(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="">- 請選擇 -</option>
                  <option value="夾鉗">夾鉗</option>
                  <option value="TKW">TKW</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>單據種類：</label>
                <select
                  className="doodle-input"
                  value={subType}
                  onChange={e => setSubType(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="">- 請選擇 -</option>
                  <option value="低點表">低點表</option>
                  <option value="領料單">領料單</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>項目數：</label>
                <input 
                  type="number" 
                  className="doodle-input" 
                  value={itemCount}
                  onChange={e => setItemCount(e.target.value)}
                  placeholder="例如: 15"
                  min="1"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>完成日期：</label>
                <CrayonDatePicker 
                  value={completionDate}
                  onChange={setCompletionDate}
                  placeholder="選擇日期"
                />
              </div>
              
              <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                <button className="doodle-button" style={{ flex: 1, opacity: duplicateTicket ? 0.5 : 1 }} disabled={!!duplicateTicket} onClick={handleSave}>{editingTicketId ? '儲存修改' : '確定新增'}</button>
                <button className="doodle-button danger" style={{ flex: 1 }} onClick={() => { setIsModalOpen(false); setTargetPerson(null); setEditingTicketId(null); }}>取消</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Personnel Cards for Dispatch */}
      {canEdit && (
        <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#f3e5f5' }}>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--crayon-dark)' }}>👥 點選人員派送追加單</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
            {assigneeOptions.map(p => {
              // Now computed based on filteredTickets so it respects search conditions
              const personTickets = filteredTickets.filter(t => t.assigneeId === p.id);
              const personItems = personTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
              return (
                <div key={p.id} className="doodle-border" style={{ padding: '15px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--crayon-purple)' }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                    <span style={{ border: '2px solid var(--crayon-blue)', padding: '2px 8px', borderRadius: '5px', fontWeight: 'bold', color: 'var(--crayon-blue)', backgroundColor: '#e3f2fd' }}>
                      {personTickets.length} 單
                    </span>
                    <span style={{ border: '2px solid var(--crayon-orange)', padding: '2px 8px', borderRadius: '5px', fontWeight: 'bold', color: 'var(--crayon-orange)', backgroundColor: '#fff3e0' }}>
                      {personItems} 項
                    </span>
                  </div>
                  <button 
                    className="doodle-button"
                    style={{ marginTop: 'auto' }}
                    onClick={() => handleOpenModal(p)}
                  >
                    ➕ 追加派送
                  </button>
                </div>
              );
            })}
            {assigneeOptions.length === 0 && (
              <p style={{ color: '#888', gridColumn: '1 / -1' }}>目前沒有具備「盤點」權限的人員。</p>
            )}
          </div>
        </div>
      )}

      {/* Search Filters */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#e8f5e9' }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--crayon-dark)' }}>🔍 查詢條件</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ width: '160px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>完成日期 (起)</label>
              <CrayonDatePicker value={searchStartDate} onChange={setSearchStartDate} placeholder="起日" />
            </div>
            <span style={{ paddingBottom: '10px', fontWeight: 'bold' }}>~</span>
            <div style={{ width: '160px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>完成日期 (迄)</label>
              <CrayonDatePicker value={searchEndDate} onChange={setSearchEndDate} placeholder="迄日" />
            </div>
          </div>
          
          <div style={{ width: '150px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>追加單號</label>
            <input 
              type="text"
              className="doodle-input" 
              value={searchTicketId}
              onChange={e => setSearchTicketId(e.target.value)}
              placeholder="搜尋單號"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ width: '150px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>盤點類型</label>
            <select 
              className="doodle-input" 
              value={searchTicketType}
              onChange={e => setSearchTicketType(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">- 所有 -</option>
              <option value="夾鉗">夾鉗</option>
              <option value="TKW">TKW</option>
            </select>
          </div>
          <div style={{ width: '150px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>單據種類</label>
            <select 
              className="doodle-input" 
              value={searchSubType}
              onChange={e => setSearchSubType(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">- 所有 -</option>
              <option value="低點表">低點表</option>
              <option value="領料單">領料單</option>
            </select>
          </div>
          <div style={{ width: '180px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>盤點人員</label>
            <select 
              className="doodle-input" 
              value={searchAssignee}
              onChange={e => setSearchAssignee(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">- 所有人員 -</option>
              {assigneeOptions.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <button 
            className="doodle-button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 30);
              setSearchStartDate(d.toISOString().split('T')[0]);
              setSearchEndDate(new Date().toISOString().split('T')[0]);
              setSearchAssignee('');
              setSearchTicketId('');
              setSearchSubType('');
              setSearchTicketType('');
              setCurrentPage(1);
            }}
          >
            清除條件
          </button>
        </div>
      </div>

      {/* Statistics and Pagination Controls */}
      <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', backgroundColor: '#fff9c4', padding: '15px', borderRadius: '10px', border: '2px dashed var(--crayon-orange)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '1.1rem' }}>
            <strong style={{ color: 'var(--crayon-orange)' }}>查詢結果：</strong>
            <span style={{ margin: '0 15px' }}>共 {filteredTickets.length} 單</span>
            <span>共 {totalItemsCount} 項</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              className="doodle-button"
              style={{ backgroundColor: viewMode === 'list' ? 'var(--crayon-blue)' : 'white', color: viewMode === 'list' ? 'white' : 'var(--crayon-blue)', padding: '5px 15px', fontSize: '1rem' }}
              onClick={() => setViewMode('list')}
            >
              📋 清單
            </button>
            <button 
              className="doodle-button"
              style={{ backgroundColor: viewMode === 'chart' ? 'var(--crayon-blue)' : 'white', color: viewMode === 'chart' ? 'white' : 'var(--crayon-blue)', padding: '5px 15px', fontSize: '1rem' }}
              onClick={() => setViewMode('chart')}
            >
              📊 圖表
            </button>
          </div>
          {viewMode === 'list' && (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>排序：</label>
            <select 
              className="doodle-input"
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              style={{ padding: '5px', width: 'auto' }}
            >
              <option value="date_desc">依完成日期 (新到舊)</option>
              <option value="date_asc">依完成日期 (舊到新)</option>
              <option value="id_asc">依單號 (小到大)</option>
              <option value="id_desc">依單號 (大到小)</option>
              <option value="person">依盤點人員</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>每頁顯示：</label>
          <select 
            className="doodle-input"
            value={itemsPerPage}
            onChange={e => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{ padding: '5px', width: '80px' }}
          >
            {[10, 20, 30, 40, 50].map(num => (
              <option key={num} value={num}>{num} 筆</option>
            ))}
          </select>
        </div>
          </>
          )}
      </div>
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
      <>
      {/* Top Pagination Nav */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button 
              className="doodle-button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              上一頁
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              第 {currentPage} / {totalPages} 頁
            </div>
            <button 
              className="doodle-button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              下一頁
            </button>
          </div>
        )}
        <button 
          className="doodle-button"
          onClick={handleExportExcel}
          style={{ backgroundColor: '#2e7d32', color: 'white', padding: '5px 15px' }}
        >
          📊 匯出Excel檔
        </button>
      </div>
      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
        {paginatedTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontStyle: 'italic', border: '2px dashed #ccc', borderRadius: '10px' }}>
            目前沒有符合條件的追加盤點紀錄
          </div>
        ) : (
          paginatedTickets.map((t, idx) => {
            const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
            const assigneeName = personnel.find(p => p.id === t.assigneeId)?.name || '未知人員';
            const dateStr = t.closeDate ? new Date(t.closeDate).toISOString().split('T')[0] : '';
            return (
              <div key={t.id} className="doodle-border" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', backgroundColor: 'white', gap: '15px' }}>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    <button 
                      onClick={() => handleOpenEditModal(t)} 
                      className="doodle-button"
                      title="修改"
                      style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                    >
                      ✏️ 修改
                    </button>
                    <button 
                      onClick={() => handleDeletePrompt(t.id)} 
                      className="doodle-button danger"
                      title="刪除"
                      style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                    >
                      🗑️ 刪除
                    </button>
                  </div>
                )}
                
                <div style={{ 
                  backgroundColor: 'var(--crayon-purple)', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '35px', 
                  height: '35px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  flexShrink: 0
                }}>
                  {actualIndex}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    <span style={{ 
                      fontSize: '1.4rem', 
                      fontWeight: 'bold', 
                      color: '#d32f2f', 
                      border: '3px solid #d32f2f', 
                      padding: '4px 15px', 
                      borderRadius: '12px',
                      backgroundColor: '#ffebee',
                      display: 'inline-block'
                    }}>
                      單號：{t.id}
                    </span>
                    {t.ticketType && t.ticketType !== '追加' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1.1rem' }}>
                        <strong style={{ color: '#00695c' }}>盤點類型:</strong> 
                        <span style={{ border: '2px solid #00695c', padding: '2px 10px', borderRadius: '8px', fontWeight: 'bold', color: '#00695c', backgroundColor: '#e0f2f1' }}>{t.ticketType}</span>
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1.1rem' }}>
                      <strong style={{ color: 'var(--crayon-orange)' }}>項目數:</strong> 
                      <span style={{ border: '2px solid var(--crayon-orange)', padding: '2px 10px', borderRadius: '8px', fontWeight: 'bold', color: 'var(--crayon-orange)', backgroundColor: '#fff3e0' }}>{t.itemCount} 項</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', color: '#555', flexWrap: 'wrap', fontSize: '1rem', alignItems: 'center' }}>
                    {t.subType && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <strong style={{ color: 'var(--crayon-purple)' }}>單據種類:</strong> 
                        <span style={{ border: '2px solid var(--crayon-purple)', padding: '2px 10px', borderRadius: '8px', fontWeight: 'bold', color: 'var(--crayon-purple)', backgroundColor: '#f3e5f5' }}>{t.subType}</span>
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <strong style={{ color: 'var(--crayon-blue)' }}>負責人員:</strong> 
                      <span style={{ border: '2px solid var(--crayon-blue)', padding: '2px 10px', borderRadius: '8px', fontWeight: 'bold', color: 'var(--crayon-blue)', backgroundColor: '#e3f2fd' }}>{assigneeName}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <strong style={{ color: '#2e7d32' }}>完成日期:</strong> 
                      <span style={{ border: '2px solid #2e7d32', padding: '2px 10px', borderRadius: '8px', fontWeight: 'bold', color: '#2e7d32', backgroundColor: '#e8f5e9' }}>{dateStr}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Nav */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '40px' }}>
          <button 
            className="doodle-button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            上一頁
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            第 {currentPage} / {totalPages} 頁
          </div>
          <button 
            className="doodle-button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            下一頁
          </button>
        </div>
      )}

      </>
      ) : (
      <div className="doodle-border" style={{ padding: '20px', backgroundColor: 'white', marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
          <h3 style={{ margin: 0, color: 'var(--crayon-dark)' }}>📊 人員追加盤點統計</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              className="doodle-button" 
              onClick={handleExportImage} 
              style={{ backgroundColor: '#ff9800', color: 'white', padding: '5px 15px' }}
            >
              🖼️ 匯出圖檔
            </button>
            <label style={{ fontWeight: 'bold' }}>圖表類型：</label>
            <select className="doodle-input" style={{ width: 'auto' }} value={chartType} onChange={e => setChartType(e.target.value as 'bar' | 'line' | 'composed')}>
              <option value="bar">長條圖</option>
              <option value="line">折線圖</option>
              <option value="composed">二者並存</option>
            </select>
          </div>
        </div>
        {chartData.length > 0 ? (
          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="var(--crayon-blue)" />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--crayon-orange)" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="追加件數" fill="var(--crayon-blue)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="追加件數" position="top" fill="var(--crayon-blue)" fontWeight="bold" />
                  </Bar>
                  <Bar yAxisId="right" dataKey="項目數" fill="var(--crayon-orange)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="項目數" position="top" fill="var(--crayon-orange)" fontWeight="bold" />
                  </Bar>
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="var(--crayon-blue)" />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--crayon-orange)" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="追加件數" stroke="var(--crayon-blue)" strokeWidth={3} activeDot={{ r: 8 }}>
                    <LabelList dataKey="追加件數" position="top" fill="var(--crayon-blue)" fontWeight="bold" />
                  </Line>
                  <Line yAxisId="right" type="monotone" dataKey="項目數" stroke="var(--crayon-orange)" strokeWidth={3} activeDot={{ r: 8 }}>
                    <LabelList dataKey="項目數" position="top" fill="var(--crayon-orange)" fontWeight="bold" />
                  </Line>
                </LineChart>
              ) : (
                <ComposedChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="var(--crayon-blue)" />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--crayon-orange)" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="追加件數" fill="var(--crayon-blue)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="追加件數" position="top" fill="var(--crayon-blue)" fontWeight="bold" />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="項目數" stroke="var(--crayon-orange)" strokeWidth={3} activeDot={{ r: 8 }}>
                    <LabelList dataKey="項目數" position="top" fill="var(--crayon-orange)" fontWeight="bold" />
                  </Line>
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>
            無符合條件的數據
          </div>
        )}
      </div>
      )}
      </div>
    </div>
  );
}