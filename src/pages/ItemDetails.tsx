import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTickets, getAllItemDetails, deleteItemDetail, saveItemDetail } from '../services/api';
import type { InventoryTicket, InventoryItemDetail } from '../types';
import CrayonDatePicker from '../components/CrayonDatePicker';

export default function ItemDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [details, setDetails] = useState<InventoryItemDetail[]>([]);
  
  // Filter state
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterTicketId, setFilterTicketId] = useState('');
  const [filterTicketType, setFilterTicketType] = useState('all');

  // View State
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<InventoryItemDetail>>({});

  // Pagination & Sort state
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortMethod, setSortMethod] = useState<'id' | 'date'>('id');

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStartDate, filterEndDate, filterTicketId, filterTicketType, sortMethod, itemsPerPage]);

  const loadData = async () => {
    try {
      const t = await getTickets();
      setTickets(t.sort((a, b) => (b.dispatchDate || 0) - (a.dispatchDate || 0)));
      const d = await getAllItemDetails();
      setDetails(d);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    if (location.state && location.state.openTicketId) {
      setSelectedTicketId(location.state.openTicketId);
      setViewMode('detail');
      
      // Clear state so it doesn't trigger again on normal navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Listen for inventory updates from the FloatingCalculator
  useEffect(() => {
    const handleUpdate = () => loadData();
    window.addEventListener('inventory_updated', handleUpdate);
    return () => window.removeEventListener('inventory_updated', handleUpdate);
  }, []);

  const filteredTickets = tickets.filter(t => {
    if (filterTicketId && !t.id.includes(filterTicketId)) return false;
    if (filterTicketType !== 'all' && t.ticketType !== filterTicketType) return false;
    
    if (t.dispatchDate) {
      const start = new Date(filterStartDate).getTime();
      // add 1 day to end date to include the whole day
      const end = new Date(filterEndDate).getTime() + 86400000;
      if (t.dispatchDate < start || t.dispatchDate > end) return false;
    }
    
    return true;
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (sortMethod === 'date') {
      return (b.dispatchDate || 0) - (a.dispatchDate || 0);
    }
    return a.id.localeCompare(b.id);
  });

  const totalPages = Math.ceil(sortedTickets.length / itemsPerPage);
  const currentTickets = sortedTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const currentDetails = details.filter(d => d.ticketId === selectedTicketId).sort((a, b) => {
    const seqDiff = a.itemSeq.localeCompare(b.itemSeq);
    if (seqDiff !== 0) return seqDiff;
    return (a.subItemSeq || '').localeCompare(b.subItemSeq || '');
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteItemDetail(id);
      loadData();
      setDeleteConfirmId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (d: InventoryItemDetail) => {
    setEditingId(d.id);
    setEditData({ ...d });
  };

  const handleEditChange = (field: keyof InventoryItemDetail, value: any) => {
    setEditData(prev => {
      const newData = { ...prev, [field]: value };
      if (['grossWeight', 'containerCount', 'containerUnitWeight', 'materialUnitWeight'].includes(field as string)) {
        const gW = Number(newData.grossWeight || 0);
        const cC = Number(newData.containerCount || 0);
        const cUW = Number(newData.containerUnitWeight || 0);
        const mUW = Number(newData.materialUnitWeight || 0);
        newData.netWeight = Number((gW - (cC * cUW)).toFixed(2));
        if (mUW > 0) {
          newData.totalItemCount = Math.floor((newData.netWeight * 1000) / mUW);
        } else {
          newData.totalItemCount = 0;
        }
      }
      return newData;
    });
  };

  const saveEdit = async () => {
    if (editingId && editData) {
      try {
        await saveItemDetail(editData as any, editingId);
        setEditingId(null);
        loadData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const mapContainerType = (type: string) => type === 'T' ? '鐵桶' : type === 'P' ? '塑膠箱' : type === 'B' ? '紙箱' : type;

  // Group by itemSeq for subtotals
  const groupedDetails: { [key: string]: InventoryItemDetail[] } = {};
  currentDetails.forEach(d => {
    if (!groupedDetails[d.itemSeq]) groupedDetails[d.itemSeq] = [];
    groupedDetails[d.itemSeq].push(d);
  });

  if (viewMode === 'detail') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>📋 單號 {selectedTicketId} - 項目明細</h2>
          <button className="doodle-button" onClick={() => { setViewMode('list'); setSelectedTicketId(null); loadData(); }}>
            🔙 返回清單
          </button>
        </div>
        
        {currentDetails.length === 0 ? (
          <div className="doodle-border" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            目前沒有任何明細資料。
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--crayon-dark)', color: 'white' }}>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)', width: '120px', textAlign: 'center' }}>功能</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>序號</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>日期</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>物料總重量</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>容器類型</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>容器數量</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>容器單重</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>淨重</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>物料單重</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>物料總數</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedDetails).map(itemSeq => {
                  const group = groupedDetails[itemSeq];
                  const totalGross = group.reduce((sum, d) => sum + d.grossWeight, 0);
                  const totalItemCount = group.reduce((sum, d) => sum + d.totalItemCount, 0);
                  
                  // Subtotal by container type
                  const byType: { [type: string]: { count: number, netWeight: number, unitWeight: number, grossWeight: number } } = {};
                  group.forEach(d => {
                    const t = mapContainerType(d.containerType);
                    if (!byType[t]) byType[t] = { count: 0, netWeight: 0, unitWeight: 0, grossWeight: 0 };
                    byType[t].count += d.containerCount;
                    byType[t].netWeight += (d.netWeight || 0);
                    byType[t].grossWeight += d.grossWeight;
                    byType[t].unitWeight += d.containerUnitWeight; // sum up unit weights as requested
                  });
                  const types = Object.keys(byType);
                  const typeStr = types.join(', ');
                  const grossWtStr = types.map(t => `${t}: ${byType[t].grossWeight.toFixed(2)}`).join(' | ');
                  const countStr = types.map(t => `${t}: ${byType[t].count}`).join(' | ');
                  const netWtStr = types.map(t => `${t}: ${byType[t].netWeight.toFixed(2)}`).join(' | ');
                  const unitWtStr = types.map(t => `${t}: ${byType[t].unitWeight.toFixed(2)}`).join(' | ');

                  return (
                    <React.Fragment key={itemSeq}>
                      {group.map((d, index) => {
                        if (editingId === d.id) {
                          return (
                            <tr key={d.id} style={{ backgroundColor: '#fffbe6', borderBottom: '2px solid var(--crayon-blue)' }}>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                  <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto', backgroundColor: 'var(--crayon-green)', color: 'white' }} onClick={saveEdit}>儲存</button>
                                  <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto' }} onClick={() => setEditingId(null)}>取消</button>
                                </div>
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)', fontWeight: 'bold' }}>
                                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                  <input type="text" className="doodle-input" style={{ width: '40px', padding: '2px', textAlign: 'center' }} value={editData.itemSeq || ''} onChange={e => handleEditChange('itemSeq', e.target.value)} />
                                  -
                                  <input type="text" className="doodle-input" style={{ width: '30px', padding: '2px', textAlign: 'center' }} value={editData.subItemSeq || ''} onChange={e => handleEditChange('subItemSeq', e.target.value)} />
                                </div>
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <input type="date" className="doodle-input" style={{ width: '100px', padding: '2px' }} value={editData.date || ''} onChange={e => handleEditChange('date', e.target.value)} />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={editData.grossWeight || ''} onChange={e => handleEditChange('grossWeight', Number(e.target.value))} />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <select className="doodle-input" style={{ width: '80px', padding: '2px' }} value={editData.containerType || 'T'} onChange={e => handleEditChange('containerType', e.target.value)}>
                                  <option value="T">鐵桶</option>
                                  <option value="P">塑膠箱</option>
                                  <option value="B">紙箱</option>
                                  <option value={editData.containerType || ''}>{editData.containerType}</option>
                                </select>
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <input type="number" className="doodle-input" style={{ width: '50px', padding: '2px' }} value={editData.containerCount || ''} onChange={e => handleEditChange('containerCount', Number(e.target.value))} />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={editData.containerUnitWeight || ''} onChange={e => handleEditChange('containerUnitWeight', Number(e.target.value))} />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={editData.netWeight || ''} onChange={e => handleEditChange('netWeight', Number(e.target.value))} />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={editData.materialUnitWeight || ''} onChange={e => handleEditChange('materialUnitWeight', Number(e.target.value))} />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={editData.totalItemCount || ''} onChange={e => handleEditChange('totalItemCount', Number(e.target.value))} />
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={d.id} style={{ borderBottom: '1px dashed var(--crayon-dark)', backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                            <td style={{ padding: '10px', borderLeft: '1px solid var(--crayon-dark)', borderRight: '1px solid var(--crayon-dark)', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '0.8rem', backgroundColor: 'var(--crayon-purple)', color: 'white', minHeight: 'auto' }} onClick={() => startEdit(d)}>修改</button>
                                <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '0.8rem', backgroundColor: 'var(--crayon-red)', color: 'white', minHeight: 'auto' }} onClick={() => setDeleteConfirmId(d.id)}>刪除</button>
                              </div>
                            </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)', fontWeight: 'bold' }}>
                            {d.itemSeq} {d.subItemSeq ? `- ${d.subItemSeq}` : ''}
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.date || '無'}</td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.grossWeight} 公斤</td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{mapContainerType(d.containerType)}</td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.containerCount}</td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.containerUnitWeight} 公斤</td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.netWeight !== undefined ? `${d.netWeight} 公斤` : '無'}</td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.materialUnitWeight} 公克</td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)', fontWeight: 'bold', color: 'var(--crayon-red)' }}>{d.totalItemCount} 項</td>
                        </tr>
                        );
                      })}
                      {/* Subtotal row */}
                        <tr style={{ backgroundColor: '#fff0f5', border: '3px solid var(--crayon-purple)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)' }}></td>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)', fontSize: '1.2rem', fontWeight: '900', color: 'var(--crayon-purple)' }}>小計 ({itemSeq})</td>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)' }}></td>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)', fontSize: '1.0rem', fontWeight: 'bold' }}>
                            <div style={{ color: 'var(--crayon-red)', marginBottom: '5px' }}>總計: {totalGross.toFixed(2)} 公斤</div>
                            {grossWtStr}
                          </td>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)', fontSize: '1.0rem', fontWeight: 'bold' }}>{typeStr}</td>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)', fontSize: '1.0rem', fontWeight: 'bold' }}>{countStr}</td>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)', fontSize: '1.0rem', fontWeight: 'bold' }}>{unitWtStr}</td>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)', fontSize: '1.0rem', fontWeight: 'bold' }}>{netWtStr}</td>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)', fontSize: '1.0rem', fontWeight: 'bold' }}>
                            <div style={{ color: 'var(--crayon-red)' }}>單重: {Array.from(new Set(group.map(d => d.materialUnitWeight))).filter(w => w > 0).sort((a,b)=>a-b).join(', ')} 公克</div>
                          </td>
                          <td style={{ padding: '15px 10px', fontSize: '1.2rem', fontWeight: '900', color: 'var(--crayon-red)' }}>{totalItemCount} 項</td>
                        </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {deleteConfirmId && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10001
          }}>
            <div className="doodle-border" style={{ backgroundColor: 'white', padding: '30px', maxWidth: '350px', textAlign: 'center' }}>
              <h3 style={{ color: 'var(--crayon-red)', marginTop: 0 }}>⚠️ 確定要刪除嗎？</h3>
              <p style={{ fontSize: '1.1rem', marginBottom: '20px' }}>刪除後將無法復原此筆明細資料。</p>
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                <button className="doodle-button" onClick={() => setDeleteConfirmId(null)}>取消</button>
                <button className="doodle-button" style={{ backgroundColor: 'var(--crayon-red)', color: 'white' }} onClick={() => handleDelete(deleteConfirmId)}>確定刪除</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📝 盤點項目明細</h2>
      </div>

      <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>🔍 查詢功能區</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ width: '150px' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>派送日期起：</label>
            <CrayonDatePicker value={filterStartDate} onChange={setFilterStartDate} />
          </div>
          <div style={{ width: '150px' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>派送日期迄：</label>
            <CrayonDatePicker value={filterEndDate} onChange={setFilterEndDate} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>盤點單號：</label>
            <input className="doodle-input" style={{ width: '150px' }} value={filterTicketId} onChange={e => setFilterTicketId(e.target.value)} placeholder="輸入單號" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>盤點類型：</label>
            <select className="doodle-input" value={filterTicketType} onChange={e => setFilterTicketType(e.target.value)}>
              <option value="all">全部</option>
              <option value="夾鉗">夾鉗</option>
              <option value="TKW">TKW</option>
            </select>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button className="doodle-button" style={{ height: '42px' }} onClick={() => {
              setFilterTicketId(''); setFilterTicketType('all');
              const d = new Date();
              setFilterEndDate(d.toISOString().split('T')[0]);
              d.setMonth(d.getMonth() - 1);
              setFilterStartDate(d.toISOString().split('T')[0]);
            }}>清除</button>
            <button className="doodle-button" style={{ height: '42px', marginLeft: '10px', backgroundColor: 'var(--crayon-blue)', color: 'white' }} onClick={loadData}>重新整理</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)' }}>
          👉 目前符合條件共 {sortedTickets.length} 筆資料
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontWeight: 'bold' }}>排序：</label>
            <select className="doodle-input" style={{ width: 'auto', padding: '5px' }} value={sortMethod} onChange={e => setSortMethod(e.target.value as any)}>
              <option value="id">單號排序</option>
              <option value="date">日期排序</option>
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>每頁筆數：</label>
            <select className="doodle-input" style={{ width: 'auto', padding: '5px' }} value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="doodle-button" style={{ padding: '5px 15px', minHeight: 'auto' }} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一頁</button>
              <div style={{ padding: '5px 15px', fontWeight: 'bold' }}>{currentPage} / {totalPages}</div>
              <button className="doodle-button" style={{ padding: '5px 15px', minHeight: 'auto' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一頁</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--crayon-dark)', color: 'white' }}>
              <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)', width: '100px' }}>功能</th>
              <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)', width: '60px' }}>序號</th>
              <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>盤點單號</th>
              <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>盤點類型</th>
              <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>項目數 (已匯入)</th>
            </tr>
          </thead>
          <tbody>
            {currentTickets.map((t, index) => {
              const seqNum = (currentPage - 1) * itemsPerPage + index + 1;
              const uniqueItemsImported = new Set(details.filter(d => d.ticketId === t.id).map(d => d.itemSeq)).size;
              const totalItems = t.itemCount || 0;
              const isComplete = totalItems > 0 && uniqueItemsImported >= totalItems;
              
              const rowBgColor = isComplete 
                ? '#e8f5e9' 
                : uniqueItemsImported > 0 
                  ? '#fff9c4' 
                  : (index % 2 === 0 ? '#fff' : '#f9f9f9');
              
              return (
                <tr key={t.id} style={{ borderBottom: '1px dashed var(--crayon-dark)', backgroundColor: rowBgColor }}>
                  <td style={{ padding: '10px', borderLeft: '1px solid var(--crayon-dark)', borderRight: '1px solid var(--crayon-dark)', textAlign: 'center' }}>
                    <button className="doodle-button" style={{ padding: '5px 10px', minHeight: 'auto', fontSize: '0.85rem' }} onClick={() => {
                      setSelectedTicketId(t.id);
                      setViewMode('detail');
                    }}>項目明細</button>
                  </td>
                  <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{seqNum}</td>
                  <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)', fontWeight: 'bold' }}>{t.id}</td>
                  <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{t.ticketType || '無'}</td>
                  <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                    <span style={{ color: isComplete ? 'var(--crayon-green)' : uniqueItemsImported > 0 ? 'var(--crayon-blue)' : '#999', fontWeight: 'bold' }}>
                      {uniqueItemsImported} / {totalItems} 筆
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {currentTickets.length === 0 && (
          <div className="doodle-border" style={{ padding: '40px', textAlign: 'center', color: '#666', borderTop: 'none' }}>
            沒有符合條件的盤點單。
          </div>
        )}
      </div>
    </div>
  );
}
