import { useState, useEffect } from 'react';
import { getTickets, getAllItemDetails } from '../services/api';
import type { InventoryTicket, InventoryItemDetail } from '../types';
import CrayonDatePicker from '../components/CrayonDatePicker';

export default function ItemDetails() {
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

  const currentDetails = details.filter(d => d.ticketId === selectedTicketId).sort((a, b) => a.itemSeq.localeCompare(b.itemSeq));

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
                {currentDetails.map((d, index) => (
                  <tr key={d.id} style={{ borderBottom: '1px dashed var(--crayon-dark)', backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ padding: '10px', borderLeft: '1px solid var(--crayon-dark)', borderRight: '1px solid var(--crayon-dark)', fontWeight: 'bold' }}>{d.itemSeq}</td>
                    <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.date || '無'}</td>
                    <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.grossWeight} 公斤</td>
                    <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.containerType === 'T' ? '鐵桶' : d.containerType === 'P' ? '塑膠箱' : d.containerType === 'B' ? '紙箱' : d.containerType}</td>
                    <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.containerCount}</td>
                    <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.containerUnitWeight} 公斤</td>
                    <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.netWeight !== undefined ? `${d.netWeight} 公斤` : '無'}</td>
                    <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>{d.materialUnitWeight} 公克</td>
                    <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)', fontWeight: 'bold', color: 'var(--crayon-red)' }}>{d.totalItemCount} 項</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              const itemsImported = details.filter(d => d.ticketId === t.id).length;
              const totalItems = t.itemCount || 0;
              const isComplete = totalItems > 0 && itemsImported >= totalItems;
              
              return (
                <tr key={t.id} style={{ borderBottom: '1px dashed var(--crayon-dark)', backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
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
                    <span style={{ color: isComplete ? 'var(--crayon-green)' : itemsImported > 0 ? 'var(--crayon-blue)' : '#999', fontWeight: 'bold' }}>
                      {itemsImported} / {totalItems} 筆
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
