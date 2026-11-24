import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTickets, getAllItemDetails, deleteItemDetail, saveItemDetail, getMaterials } from '../services/api';
import type { InventoryTicket, InventoryItemDetail, MaterialItem } from '../types';
import CrayonDatePicker from '../components/CrayonDatePicker';
import { useAuth } from '../contexts/AuthContext';

export default function ItemDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('itemDetails', 'edit');
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  const [details, setDetails] = useState<InventoryItemDetail[]>([]);
  const [materialList, setMaterialList] = useState<MaterialItem[]>([]);
  
  // Filter state
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterTicketId, setFilterTicketId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'全部' | '一般' | '追加'>('一般');
  const [filterTicketType, setFilterTicketType] = useState('all');
  const [useDateFilter, setUseDateFilter] = useState(true);
  const [useTicketIdFilter, setUseTicketIdFilter] = useState(true);
  const [filterTicketStatus, setFilterTicketStatus] = useState('all');

  // View State
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<InventoryItemDetail>>({});

  // Add New State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newData, setNewData] = useState<Partial<InventoryItemDetail>>({});

  // Quick Manual Add (物料品號 & 數量) Modal State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddRows, setQuickAddRows] = useState<Array<{
    itemSeq: string;
    subItemSeq: string;
    date: string;
    materialCode: string;
    totalItemCount: number | '';
  }>>([]);
  
  // Custom Modals
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<Partial<InventoryItemDetail> | null>(null);

  // Pagination & Sort state
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortMethod, setSortMethod] = useState<'id' | 'date'>('id');
  
  // Detail Pagination State
  const [detailItemsPerPage, setDetailItemsPerPage] = useState(10);
  const [detailCurrentPage, setDetailCurrentPage] = useState(1);
  const [filterItemSeq, setFilterItemSeq] = useState('all');
  const [detailSortMethod, setDetailSortMethod] = useState<'seq' | 'containerType'>('seq');
  
  // Reset page when switching tickets
  useEffect(() => {
    setDetailCurrentPage(1);
    setFilterItemSeq('all');
    setIsAddingNew(false);
  }, [selectedTicketId, detailItemsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStartDate, filterEndDate, filterTicketId, categoryFilter, filterTicketType, filterTicketStatus, sortMethod, itemsPerPage, useDateFilter, useTicketIdFilter]);

  const loadData = async () => {
    try {
      const [t, d, mats] = await Promise.all([
        getTickets(),
        getAllItemDetails(),
        getMaterials().catch(() => [] as MaterialItem[])
      ]);
      setTickets(t.sort((a, b) => (b.dispatchDate || 0) - (a.dispatchDate || 0)));
      setDetails(d);
      setMaterialList(mats);
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
    if (categoryFilter === '一般' && t.isAdditional) return false;
    if (categoryFilter === '追加' && !t.isAdditional) return false;
    if (useTicketIdFilter && filterTicketId && !t.id.includes(filterTicketId)) return false;
    if (filterTicketType !== 'all' && t.ticketType !== filterTicketType) return false;
    
    if (useDateFilter && t.dispatchDate) {
      const start = new Date(filterStartDate).getTime();
      // add 1 day to end date to include the whole day
      const end = new Date(filterEndDate).getTime() + 86400000;
      if (t.dispatchDate < start || t.dispatchDate > end) return false;
    }
    
    if (filterTicketStatus !== 'all') {
      const isComplete = !!t.closeDate;
      
      if (filterTicketStatus === 'completed' && !isComplete) return false;
      if (filterTicketStatus === 'uncompleted' && isComplete) return false;
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

  const baseDetails = details.filter(d => d.ticketId === selectedTicketId).sort((a, b) => {
    const seqDiff = a.itemSeq.localeCompare(b.itemSeq);
    if (seqDiff !== 0) return seqDiff;
    return (a.subItemSeq || '').localeCompare(b.subItemSeq || '');
  });
  
  const currentTicket = tickets.find(t => t.id === selectedTicketId);
  const ticketDefinedSeqs = currentTicket?.itemCount
    ? Array.from({ length: currentTicket.itemCount }, (_, i) => (i + 1).toString().padStart(3, '0'))
    : [];
  const detailDefinedSeqs = Array.from(new Set(baseDetails.map(d => d.itemSeq)));
  const mergedSeqs = Array.from(new Set([...ticketDefinedSeqs, ...detailDefinedSeqs])).sort();
  const allTicketItemSeqs = mergedSeqs.length > 0
    ? mergedSeqs
    : Array.from({ length: 10 }, (_, i) => (i + 1).toString().padStart(3, '0'));
  
  const currentDetails = baseDetails.filter(d => filterItemSeq === 'all' || d.itemSeq === filterItemSeq);

  const getNextSubSeqForSeq = (seq: string, extraRows: Array<{ itemSeq: string; subItemSeq: string }> = []) => {
    const existingSubSeqs = [
      ...baseDetails.filter(d => d.itemSeq === seq).map(d => parseInt(d.subItemSeq || '', 10)),
      ...extraRows.filter(r => r.itemSeq === seq).map(r => parseInt(r.subItemSeq || '', 10))
    ].filter(n => !isNaN(n));
    return (existingSubSeqs.length > 0 ? Math.max(...existingSubSeqs) + 1 : 1).toString();
  };

  const getExistingMaterialCodeForSeq = (seq: string) => {
    const found = baseDetails.find(d => d.itemSeq === seq && d.materialCode && d.materialCode.trim());
    return found?.materialCode || '';
  };

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
      const data = { ...prev, [field]: value };
      if (['grossWeight', 'containerCount', 'containerUnitWeight', 'materialUnitWeight'].includes(field as string)) {
        const gW = Number(data.grossWeight || 0);
        const cC = Number(data.containerCount || 0);
        const cUW = Number(data.containerUnitWeight || 0);
        const mUW = Number(data.materialUnitWeight || 0);
        data.netWeight = Number((gW - (cC * cUW)).toFixed(2));
        if (mUW > 0) {
          data.totalItemCount = Math.floor((data.netWeight * 1000) / mUW);
        }
      }
      return data;
    });
  };

  const startAddNew = () => {
    const initialItemSeq = filterItemSeq !== 'all' ? filterItemSeq : (allTicketItemSeqs[0] || '001');
    const nextSubSeq = getNextSubSeqForSeq(initialItemSeq);

    setIsAddingNew(true);
    setNewData({ 
      ticketId: selectedTicketId!,
      itemSeq: initialItemSeq,
      subItemSeq: nextSubSeq,
      materialCode: getExistingMaterialCodeForSeq(initialItemSeq),
      date: new Date().toISOString().split('T')[0],
      containerType: 'T',
      grossWeight: 0,
      containerCount: 0,
      containerUnitWeight: 0,
      materialUnitWeight: 0,
      netWeight: 0,
      totalItemCount: 0
    });
  };

  const handleNewChange = (field: keyof InventoryItemDetail, value: any) => {
    setNewData(prev => {
      const data = { ...prev, [field]: value };
      
      if (field === 'itemSeq') {
        data.subItemSeq = getNextSubSeqForSeq(value);
        if (!data.materialCode) {
          data.materialCode = getExistingMaterialCodeForSeq(value);
        }
      }

      if (['grossWeight', 'containerCount', 'containerUnitWeight', 'materialUnitWeight'].includes(field as string)) {
        const gW = Number(data.grossWeight || 0);
        const cC = Number(data.containerCount || 0);
        const cUW = Number(data.containerUnitWeight || 0);
        const mUW = Number(data.materialUnitWeight || 0);
        data.netWeight = Number((gW - (cC * cUW)).toFixed(2));
        if (mUW > 0) {
          data.totalItemCount = Math.floor((data.netWeight * 1000) / mUW);
        }
      }
      return data;
    });
  };

  const startQuickAdd = () => {
    const initialItemSeq = filterItemSeq !== 'all' ? filterItemSeq : (allTicketItemSeqs[0] || '001');
    const todayStr = new Date().toISOString().split('T')[0];
    setQuickAddRows([
      {
        itemSeq: initialItemSeq,
        subItemSeq: getNextSubSeqForSeq(initialItemSeq),
        date: todayStr,
        materialCode: getExistingMaterialCodeForSeq(initialItemSeq),
        totalItemCount: ''
      }
    ]);
    setIsQuickAddOpen(true);
  };

  const addQuickAddRow = () => {
    setQuickAddRows(prev => {
      const lastRow = prev[prev.length - 1];
      const lastSeqNum = lastRow ? parseInt(lastRow.itemSeq, 10) : 1;
      const nextSeqCandidate = !isNaN(lastSeqNum)
        ? (lastSeqNum + 1).toString().padStart(3, '0')
        : (allTicketItemSeqs[0] || '001');
      const targetSeq = allTicketItemSeqs.includes(nextSeqCandidate)
        ? nextSeqCandidate
        : (lastRow?.itemSeq || allTicketItemSeqs[0] || '001');
      const todayStr = lastRow?.date || new Date().toISOString().split('T')[0];
      return [
        ...prev,
        {
          itemSeq: targetSeq,
          subItemSeq: getNextSubSeqForSeq(targetSeq, prev),
          date: todayStr,
          materialCode: getExistingMaterialCodeForSeq(targetSeq),
          totalItemCount: ''
        }
      ];
    });
  };

  const updateQuickAddRow = (index: number, field: string, value: any) => {
    setQuickAddRows(prev => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      if (field === 'itemSeq') {
        const otherRows = next.filter((_, idx) => idx !== index);
        updated.subItemSeq = getNextSubSeqForSeq(value, otherRows);
        if (!updated.materialCode) {
          updated.materialCode = getExistingMaterialCodeForSeq(value);
        }
      }
      next[index] = updated;
      return next;
    });
  };

  const removeQuickAddRow = (index: number) => {
    setQuickAddRows(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const saveQuickAdd = async () => {
    for (let i = 0; i < quickAddRows.length; i++) {
      const row = quickAddRows[i];
      if (!row.itemSeq.trim()) {
        setAlertMessage(`第 ${i + 1} 筆請填寫項目序號`);
        return;
      }
      if (row.totalItemCount === '' || Number(row.totalItemCount) <= 0) {
        setAlertMessage(`第 ${i + 1} 筆請填寫大於 0 的數量`);
        return;
      }
    }

    try {
      const nowTs = new Date().getTime();
      for (let i = 0; i < quickAddRows.length; i++) {
        const row = quickAddRows[i];
        const detailToSave: Omit<InventoryItemDetail, 'id'> = {
          ticketId: selectedTicketId!,
          itemSeq: row.itemSeq.trim(),
          subItemSeq: (row.subItemSeq || '1').trim(),
          materialCode: (row.materialCode || '').trim(),
          date: row.date || new Date().toISOString().split('T')[0],
          grossWeight: 0,
          containerType: '',
          containerCount: 0,
          containerUnitWeight: 0,
          materialUnitWeight: 0,
          netWeight: 0,
          totalItemCount: Number(row.totalItemCount),
          createdAt: nowTs + i
        };
        await saveItemDetail(detailToSave);
      }
      setIsQuickAddOpen(false);
      loadData();
    } catch (e) {
      console.error(e);
      setAlertMessage('新增失敗');
    }
  };

  const saveNew = async () => {
    if (!newData.itemSeq) {
      setAlertMessage('請填寫項目序號');
      return;
    }
    if (!newData.totalItemCount || newData.totalItemCount <= 0) {
      setAlertMessage('請填寫物料總數');
      return;
    }
    
    const isDuplicate = currentDetails.some(d => d.itemSeq === newData.itemSeq && d.subItemSeq === newData.subItemSeq);
    if (isDuplicate) {
      setDuplicateConfirm(newData);
    } else {
      executeSaveNew(newData);
    }
  };

  const executeSaveNew = async (data: Partial<InventoryItemDetail>) => {
    try {
      const detailToSave = {
        ...data,
        ticketId: selectedTicketId!,
        createdAt: new Date().getTime(),
      };
      await saveItemDetail(detailToSave as any);
      setIsAddingNew(false);
      setDuplicateConfirm(null);
      loadData();
    } catch (e) {
      console.error(e);
      setAlertMessage('新增失敗');
    }
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

  const mapContainerType = (type: string) => type || '無';

  // Group by itemSeq for subtotals
  const groupedDetails: { [key: string]: InventoryItemDetail[] } = {};
  currentDetails.forEach(d => {
    if (!groupedDetails[d.itemSeq]) groupedDetails[d.itemSeq] = [];
    groupedDetails[d.itemSeq].push(d);
  });

  const itemSeqList = Object.keys(groupedDetails).sort();
  const detailTotalPages = Math.ceil(itemSeqList.length / detailItemsPerPage) || 1;
  const currentSeqList = itemSeqList.slice((detailCurrentPage - 1) * detailItemsPerPage, detailCurrentPage * detailItemsPerPage);

  const containerSummary = currentDetails.reduce((acc, d) => {
    const type = mapContainerType(d.containerType);
    acc[type] = (acc[type] || 0) + d.containerCount;
    return acc;
  }, {} as Record<string, number>);

  const netWeightSummary = currentDetails.reduce((acc, d) => {
    const type = mapContainerType(d.containerType);
    acc[type] = (acc[type] || 0) + (d.netWeight || 0);
    return acc;
  }, {} as Record<string, number>);

  const materialUnitWeights = Array.from(new Set(currentDetails.map(d => d.materialUnitWeight))).filter(w => w > 0).sort((a,b) => a - b);

  if (viewMode === 'detail') {
    return (
      <div>
        <datalist id="item-details-material-codes">
          {materialList.map(m => (
            <option key={m.id || m.name} value={m.name}>
              {m.partName ? `${m.name} (${m.partName})` : m.name}
            </option>
          ))}
        </datalist>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ margin: 0, fontFamily: 'Caveat, cursive', fontSize: '2.5rem', color: 'var(--crayon-blue)' }}>📋 單號 {selectedTicketId} - 項目明細</h2>
          <button className="doodle-button" onClick={() => { setViewMode('list'); setSelectedTicketId(null); loadData(); }}>
            🔙 返回清單
          </button>
        </div>
        
        {baseDetails.length === 0 && !isAddingNew ? (
          <div className="doodle-border" style={{ padding: '40px', textAlign: 'center', color: '#666', backgroundColor: 'white' }}>
            <div style={{ fontSize: '1.15rem', marginBottom: canEdit ? '20px' : '0' }}>目前沒有任何明細資料。</div>
            {canEdit && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className="doodle-button"
                  style={{ backgroundColor: 'var(--crayon-orange)', color: 'white' }}
                  onClick={startQuickAdd}
                >
                  📦 手動新增品號與數量
                </button>
                <button
                  className="doodle-button"
                  style={{ backgroundColor: 'var(--crayon-purple)', color: 'white' }}
                  onClick={startAddNew}
                >
                  ＋ 手動新增明細
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontWeight: 'bold', color: 'var(--crayon-purple)' }}>🔍 篩選單一項目：</label>
              <select className="doodle-input" style={{ width: 'auto', padding: '5px' }} value={filterItemSeq} onChange={e => setFilterItemSeq(e.target.value)}>
                <option value="all">顯示全部項目 ({allTicketItemSeqs.length} 項)</option>
                {allTicketItemSeqs.map(seq => (
                  <option key={seq} value={seq}>項目 {seq}</option>
                ))}
              </select>
            </div>
            <div className="doodle-border" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f8ff' }}>
              <h3 style={{ marginTop: 0, color: 'var(--crayon-blue)' }}>📊 盤點單統計摘要</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', lineHeight: '1.8' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'var(--crayon-orange)', color: 'white', padding: '2px 8px', borderRadius: '15px', fontWeight: 'bold', marginRight: '8px', border: '2px solid var(--crayon-dark)' }}>總項目數</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                      <span style={{ position: 'relative', backgroundColor: 'white', border: '2px dashed var(--crayon-orange)', padding: '6px 14px', borderRadius: '10px', fontSize: '1rem', color: 'var(--crayon-orange)', fontWeight: '900', display: 'inline-flex', alignItems: 'center', margin: '12px 12px 8px 12px' }}>
                        <span style={{ position: 'absolute', top: '-15px', left: '-15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--crayon-orange)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1.2rem', fontWeight: '900', border: '3px solid white', boxShadow: '2px 2px 0px rgba(0,0,0,0.3)', transform: 'rotate(-5deg)', zIndex: 1 }}>1</span>
                        {itemSeqList.length} 項
                      </span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'var(--crayon-green)', color: 'white', padding: '2px 8px', borderRadius: '15px', fontWeight: 'bold', marginRight: '8px', border: '2px solid var(--crayon-dark)' }}>各項目子項數量</span><br/>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                      {itemSeqList.map((seq, index) => (
                        <span key={seq} style={{ position: 'relative', backgroundColor: 'white', border: '2px dashed var(--crayon-dark)', padding: '6px 14px', borderRadius: '10px', fontSize: '1rem', color: 'var(--crayon-dark)', fontWeight: '900', display: 'inline-flex', alignItems: 'center', margin: '12px 12px 8px 12px' }}>
                          <span style={{ position: 'absolute', top: '-15px', left: '-15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--crayon-dark)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1.2rem', fontWeight: '900', border: '3px solid white', boxShadow: '2px 2px 0px rgba(0,0,0,0.3)', transform: 'rotate(-5deg)', zIndex: 1 }}>{index + 1}</span>
                          項目 {seq} ({groupedDetails[seq].length} 筆)
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'var(--crayon-purple)', color: 'white', padding: '2px 8px', borderRadius: '15px', fontWeight: 'bold', marginRight: '8px', border: '2px solid var(--crayon-dark)' }}>總容器數量</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                      {Object.entries(containerSummary).length > 0 ? Object.entries(containerSummary).map(([type, count], index) => (
                        <span key={type} style={{ position: 'relative', backgroundColor: 'white', border: '2px dashed var(--crayon-purple)', padding: '6px 14px', borderRadius: '10px', fontSize: '1rem', color: 'var(--crayon-purple)', fontWeight: '900', display: 'inline-flex', alignItems: 'center', margin: '12px 12px 8px 12px' }}>
                          <span style={{ position: 'absolute', top: '-15px', left: '-15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--crayon-purple)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1.2rem', fontWeight: '900', border: '3px solid white', boxShadow: '2px 2px 0px rgba(0,0,0,0.3)', transform: 'rotate(-5deg)', zIndex: 1 }}>{index + 1}</span>
                          {type}: {count} 個
                        </span>
                      )) : <span style={{ color: '#666' }}>無</span>}
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'var(--crayon-red)', color: 'white', padding: '2px 8px', borderRadius: '15px', fontWeight: 'bold', marginRight: '8px', border: '2px solid var(--crayon-dark)' }}>總淨重統計</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                      {Object.entries(netWeightSummary).length > 0 ? Object.entries(netWeightSummary).map(([type, weight], index) => (
                        <span key={type} style={{ position: 'relative', backgroundColor: 'white', border: '2px dashed var(--crayon-red)', padding: '6px 14px', borderRadius: '10px', fontSize: '1rem', color: 'var(--crayon-red)', fontWeight: '900', display: 'inline-flex', alignItems: 'center', margin: '12px 12px 8px 12px' }}>
                          <span style={{ position: 'absolute', top: '-15px', left: '-15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--crayon-red)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1.2rem', fontWeight: '900', border: '3px solid white', boxShadow: '2px 2px 0px rgba(0,0,0,0.3)', transform: 'rotate(-5deg)', zIndex: 1 }}>{index + 1}</span>
                          {type}: {weight.toFixed(2)} 公斤
                        </span>
                      )) : <span style={{ color: '#666' }}>無</span>}
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ display: 'inline-block', backgroundColor: '#20b2aa', color: 'white', padding: '2px 8px', borderRadius: '15px', fontWeight: 'bold', marginRight: '8px', border: '2px solid var(--crayon-dark)' }}>物料單重</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                      {materialUnitWeights.length > 0 ? materialUnitWeights.map((wt, index) => (
                        <span key={wt} style={{ position: 'relative', backgroundColor: 'white', border: '2px dashed #20b2aa', padding: '6px 14px', borderRadius: '10px', fontSize: '1rem', color: '#20b2aa', fontWeight: '900', display: 'inline-flex', alignItems: 'center', margin: '12px 12px 8px 12px' }}>
                          <span style={{ position: 'absolute', top: '-15px', left: '-15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#20b2aa', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1.2rem', fontWeight: '900', border: '3px solid white', boxShadow: '2px 2px 0px rgba(0,0,0,0.3)', transform: 'rotate(-5deg)', zIndex: 1 }}>{index + 1}</span>
                          {wt} 公克
                        </span>
                      )) : <span style={{ color: '#666' }}>無</span>}
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ display: 'inline-block', backgroundColor: '#ff69b4', color: 'white', padding: '2px 8px', borderRadius: '15px', fontWeight: 'bold', marginRight: '8px', border: '2px solid var(--crayon-dark)' }}>各項目物料總數</span><br/>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                      {itemSeqList.map((seq, index) => {
                        const sum = groupedDetails[seq].reduce((acc, d) => acc + (d.totalItemCount || 0), 0);
                        const codes = Array.from(new Set(groupedDetails[seq].map(d => (d.materialCode || '').trim()).filter(Boolean))).join(', ');
                        return (
                          <span key={seq} style={{ position: 'relative', backgroundColor: 'white', border: '2px dashed #ff69b4', padding: '6px 14px', borderRadius: '10px', fontSize: '1rem', color: '#ff69b4', fontWeight: '900', display: 'inline-flex', alignItems: 'center', margin: '12px 12px 8px 12px' }}>
                            <span style={{ position: 'absolute', top: '-15px', left: '-15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff69b4', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1.2rem', fontWeight: '900', border: '3px solid white', boxShadow: '2px 2px 0px rgba(0,0,0,0.3)', transform: 'rotate(-5deg)', zIndex: 1 }}>{index + 1}</span>
                            項目 {seq}{codes ? ` (${codes})` : ''}: {sum} 個
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontWeight: 'bold', color: 'var(--crayon-purple)' }}>🔀 子項排序方式：</label>
                <select className="doodle-input" style={{ width: 'auto', padding: '5px' }} value={detailSortMethod} onChange={e => setDetailSortMethod(e.target.value as any)}>
                  <option value="seq">依序號排序</option>
                  <option value="containerType">依容器種類排序</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div>
                <label style={{ fontWeight: 'bold' }}>每頁筆數：</label>
                <select className="doodle-input" style={{ width: 'auto', padding: '5px' }} value={detailItemsPerPage} onChange={e => setDetailItemsPerPage(Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              </div>
              
              {detailTotalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button className="doodle-button" style={{ padding: '5px 15px', minHeight: 'auto' }} disabled={detailCurrentPage === 1} onClick={() => setDetailCurrentPage(p => p - 1)}>上一頁</button>
                  <div style={{ padding: '5px 15px', fontWeight: 'bold' }}>{detailCurrentPage} / {detailTotalPages}</div>
                  <button className="doodle-button" style={{ padding: '5px 15px', minHeight: 'auto' }} disabled={detailCurrentPage === detailTotalPages} onClick={() => setDetailCurrentPage(p => p + 1)}>下一頁</button>
                </div>
              )}
              {canEdit && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    className="doodle-button"
                    style={{ backgroundColor: 'var(--crayon-orange)', color: 'white' }}
                    onClick={startQuickAdd}
                  >
                    📦 手動新增品號與數量
                  </button>
                  <button
                    className="doodle-button"
                    style={{ backgroundColor: 'var(--crayon-purple)', color: 'white' }}
                    onClick={startAddNew}
                  >
                    ＋ 手動新增明細
                  </button>
                </div>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--crayon-dark)', color: 'white' }}>
                  {canEdit && <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)', width: '120px', textAlign: 'center' }}>功能</th>}
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>序號</th>
                  <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>物料品號</th>
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
                {isAddingNew && (
                  <tr style={{ backgroundColor: '#e8f5e9', borderBottom: '2px solid var(--crayon-green)' }}>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto', backgroundColor: 'var(--crayon-green)', color: 'white' }} onClick={saveNew}>儲存</button>
                        <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto' }} onClick={() => setIsAddingNew(false)}>取消</button>
                      </div>
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)', fontWeight: 'bold' }}>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <select className="doodle-input" style={{ width: '60px', padding: '2px', textAlign: 'center' }} value={newData.itemSeq || ''} onChange={e => handleNewChange('itemSeq', e.target.value)}>
                          {allTicketItemSeqs.map(seq => (
                            <option key={seq} value={seq}>{seq}</option>
                          ))}
                        </select>
                        -
                        <input type="text" className="doodle-input" style={{ width: '30px', padding: '2px', textAlign: 'center' }} placeholder="子項" value={newData.subItemSeq || ''} onChange={e => handleNewChange('subItemSeq', e.target.value)} />
                      </div>
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                      <input
                        type="text"
                        list="item-details-material-codes"
                        className="doodle-input"
                        style={{ width: '120px', padding: '2px 6px' }}
                        placeholder="選填品號"
                        value={newData.materialCode || ''}
                        onChange={e => handleNewChange('materialCode', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                      <div style={{ width: '130px' }}>
                        <CrayonDatePicker value={newData.date || ''} onChange={val => handleNewChange('date', val)} />
                      </div>
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                      <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={newData.grossWeight || ''} onChange={e => handleNewChange('grossWeight', Number(e.target.value))} />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                      <select className="doodle-input" style={{ width: '90px', padding: '2px' }} value={newData.containerType || ''} onChange={e => handleNewChange('containerType', e.target.value)}>
                        <option value="">無</option>
                        <option value="T">鐵桶 (T)</option>
                        <option value="P">塑膠箱 (P)</option>
                        <option value="B">紙箱 (B)</option>
                        <option value="L">摺疊籠 (L)</option>
                        <option value="J">鐵架 (J)</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                      <input type="number" className="doodle-input" style={{ width: '50px', padding: '2px' }} value={newData.containerCount || ''} onChange={e => handleNewChange('containerCount', Number(e.target.value))} />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                      <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={newData.containerUnitWeight || ''} onChange={e => handleNewChange('containerUnitWeight', Number(e.target.value))} />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                      <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={newData.netWeight || ''} onChange={e => handleNewChange('netWeight', Number(e.target.value))} />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                      <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={newData.materialUnitWeight || ''} onChange={e => handleNewChange('materialUnitWeight', Number(e.target.value))} />
                    </td>
                    <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                      <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={newData.totalItemCount || ''} onChange={e => handleNewChange('totalItemCount', Number(e.target.value))} />
                    </td>
                  </tr>
                )}
                {currentSeqList.map(itemSeq => {
                  const group = groupedDetails[itemSeq];
                  const sortedGroup = [...group].sort((a, b) => {
                    if (detailSortMethod === 'containerType') {
                      const typeA = mapContainerType(a.containerType);
                      const typeB = mapContainerType(b.containerType);
                      const typeDiff = typeA.localeCompare(typeB);
                      if (typeDiff !== 0) return typeDiff;
                    }
                    return (a.subItemSeq || '').localeCompare(b.subItemSeq || '');
                  });

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
                  const groupMaterialCodes = Array.from(new Set(group.map(d => (d.materialCode || '').trim()).filter(Boolean))).join(', ');

                  return (
                    <React.Fragment key={itemSeq}>
                      {sortedGroup.map((d, index) => {
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
                                <input
                                  type="text"
                                  list="item-details-material-codes"
                                  className="doodle-input"
                                  style={{ width: '120px', padding: '2px 6px' }}
                                  placeholder="選填品號"
                                  value={editData.materialCode || ''}
                                  onChange={e => handleEditChange('materialCode', e.target.value)}
                                />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <div style={{ width: '130px' }}>
                                  <CrayonDatePicker value={editData.date || ''} onChange={val => handleEditChange('date', val)} />
                                </div>
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <input type="number" className="doodle-input" style={{ width: '60px', padding: '2px' }} value={editData.grossWeight || ''} onChange={e => handleEditChange('grossWeight', Number(e.target.value))} />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>
                                <select className="doodle-input" style={{ width: '90px', padding: '2px' }} value={editData.containerType || ''} onChange={e => handleEditChange('containerType', e.target.value)}>
                                  <option value="">無</option>
                                  <option value="T">鐵桶 (T)</option>
                                  <option value="P">塑膠箱 (P)</option>
                                  <option value="B">紙箱 (B)</option>
                                  <option value="L">摺疊籠 (L)</option>
                                  <option value="J">鐵架 (J)</option>
                                  {editData.containerType && !['', 'T', 'P', 'B', 'L', 'J'].includes(editData.containerType) && (
                                    <option value={editData.containerType}>{editData.containerType}</option>
                                  )}
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
                            {canEdit && (
                              <td style={{ padding: '10px', borderLeft: '1px solid var(--crayon-dark)', borderRight: '1px solid var(--crayon-dark)', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                  <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '0.8rem', backgroundColor: 'var(--crayon-purple)', color: 'white', minHeight: 'auto' }} onClick={() => startEdit(d)}>修改</button>
                                  <button className="doodle-button" style={{ padding: '2px 8px', fontSize: '0.8rem', backgroundColor: 'var(--crayon-red)', color: 'white', minHeight: 'auto' }} onClick={() => setDeleteConfirmId(d.id)}>刪除</button>
                                </div>
                              </td>
                            )}
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-green)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-dark)', fontWeight: 'bold' }}>
                              {d.itemSeq} {d.subItemSeq ? `- ${d.subItemSeq}` : ''}
                            </span>
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            {d.materialCode ? (
                              <span style={{ display: 'inline-block', backgroundColor: '#fff8e1', border: '1px dashed var(--crayon-orange)', padding: '2px 8px', borderRadius: '10px', color: '#e65100', fontWeight: 'bold' }}>
                                {d.materialCode}
                              </span>
                            ) : (
                              <span style={{ color: '#999', fontSize: '0.9rem' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-blue)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>
                              {d.date || '無'}
                            </span>
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-dark)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-dark)', fontWeight: 'bold' }}>
                              {d.grossWeight} 公斤
                            </span>
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-purple)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-purple)', fontWeight: 'bold' }}>
                              {mapContainerType(d.containerType)}
                            </span>
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-purple)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-purple)', fontWeight: 'bold' }}>
                              {d.containerCount}
                            </span>
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-purple)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-purple)', fontWeight: 'bold' }}>
                              {d.containerUnitWeight} 公斤
                            </span>
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-red)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-red)', fontWeight: 'bold' }}>
                              {d.netWeight !== undefined ? `${d.netWeight} 公斤` : '無'}
                            </span>
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed #20b2aa', padding: '2px 8px', borderRadius: '10px', color: '#20b2aa', fontWeight: 'bold' }}>
                              {d.materialUnitWeight} 公克
                            </span>
                          </td>
                          <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                            <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed #ff69b4', padding: '2px 8px', borderRadius: '10px', color: '#ff69b4', fontWeight: 'bold' }}>
                              {d.totalItemCount} 個 (PCS)
                            </span>
                          </td>
                        </tr>
                        );
                      })}
                      {/* Subtotal row */}
                        <tr style={{ backgroundColor: '#fff0f5', border: '3px solid var(--crayon-purple)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
                          {canEdit && <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)' }}></td>}
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)', fontSize: '1.2rem', fontWeight: '900', color: 'var(--crayon-purple)' }}>
                            小計 ({itemSeq})
                            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>共 {group.length} 項</div>
                          </td>
                          <td style={{ padding: '15px 10px', borderRight: '2px dashed var(--crayon-purple)', fontSize: '0.95rem', fontWeight: 'bold', color: '#e65100' }}>
                            {groupMaterialCodes || '-'}
                          </td>
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
                          <td style={{ padding: '15px 10px', fontSize: '1.2rem', fontWeight: '900', color: 'var(--crayon-red)' }}>{totalItemCount} 個 (PCS)</td>
                        </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* 手動新增物料品號與數量 Modal */}
        {isQuickAddOpen && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            padding: '15px'
          }}>
            <div className="doodle-border" style={{ backgroundColor: 'white', padding: '25px', width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: 'var(--crayon-orange)', fontSize: '1.5rem' }}>
                  📦 手動新增物料品號與數量（單號：{selectedTicketId}）
                </h3>
                <button
                  onClick={() => setIsQuickAddOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: 'var(--crayon-red)', fontWeight: 'bold' }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '12px', fontSize: '0.95rem', color: '#555', fontWeight: 'bold' }}>
                💡 可直接輸入或選取「物料品號」（選填）與「數量」（必填），系統將自動帶入對應項目序號與子項。
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
                {quickAddRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="doodle-border"
                    style={{
                      padding: '12px 15px',
                      backgroundColor: '#fffdf7',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'flex-end'
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>項目序號</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <select
                          className="doodle-input"
                          style={{ width: '75px', padding: '5px', backgroundColor: 'white', textAlign: 'center' }}
                          value={row.itemSeq}
                          onChange={e => updateQuickAddRow(idx, 'itemSeq', e.target.value)}
                        >
                          {allTicketItemSeqs.map(seq => (
                            <option key={seq} value={seq}>{seq}</option>
                          ))}
                        </select>
                        <span style={{ fontWeight: 'bold' }}>-</span>
                        <input
                          type="text"
                          className="doodle-input"
                          style={{ width: '48px', padding: '5px', textAlign: 'center' }}
                          placeholder="子項"
                          value={row.subItemSeq}
                          onChange={e => updateQuickAddRow(idx, 'subItemSeq', e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ width: '140px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>日期</label>
                      <CrayonDatePicker value={row.date} onChange={val => updateQuickAddRow(idx, 'date', val)} />
                    </div>

                    <div style={{ flex: '1 1 180px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>
                        物料品號 <span style={{ color: '#888', fontWeight: 'normal' }}>(選填)</span>
                      </label>
                      <input
                        type="text"
                        list="item-details-material-codes"
                        className="doodle-input"
                        style={{ width: '100%', padding: '6px 10px' }}
                        placeholder="輸入或選擇物料品號"
                        value={row.materialCode}
                        onChange={e => updateQuickAddRow(idx, 'materialCode', e.target.value)}
                      />
                    </div>

                    <div style={{ width: '140px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px', color: 'var(--crayon-red)' }}>
                        數量 (PCS) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="doodle-input"
                        style={{ width: '100%', padding: '6px 10px' }}
                        placeholder="輸入數量"
                        value={row.totalItemCount}
                        onChange={e => updateQuickAddRow(idx, 'totalItemCount', e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </div>

                    {quickAddRows.length > 1 && (
                      <button
                        type="button"
                        className="doodle-button"
                        style={{ backgroundColor: 'var(--crayon-red)', color: 'white', padding: '6px 12px', minHeight: 'auto' }}
                        onClick={() => removeQuickAddRow(idx)}
                      >
                        刪除
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  className="doodle-button"
                  style={{ backgroundColor: 'var(--crayon-blue)', color: 'white' }}
                  onClick={addQuickAddRow}
                >
                  ＋ 再新增一列
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="doodle-button" onClick={() => setIsQuickAddOpen(false)}>
                    取消
                  </button>
                  <button
                    type="button"
                    className="doodle-button"
                    style={{ backgroundColor: 'var(--crayon-green)', color: 'white' }}
                    onClick={saveQuickAdd}
                  >
                    💾 確認新增 ({quickAddRows.length} 筆)
                  </button>
                </div>
              </div>
            </div>
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

        {duplicateConfirm && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10001
          }}>
            <div className="doodle-border" style={{ backgroundColor: 'white', padding: '30px', maxWidth: '400px', textAlign: 'center' }}>
              <h3 style={{ color: 'var(--crayon-orange)', marginTop: 0 }}>⚠️ 序號已存在</h3>
              <p style={{ fontSize: '1.1rem', marginBottom: '20px' }}>
                項目序號 {duplicateConfirm.itemSeq} - {duplicateConfirm.subItemSeq} 已經存在於本盤點單。您確定要繼續新增嗎？
              </p>
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                <button className="doodle-button" onClick={() => setDuplicateConfirm(null)}>取消</button>
                <button className="doodle-button" style={{ backgroundColor: 'var(--crayon-orange)', color: 'white' }} onClick={() => executeSaveNew(duplicateConfirm)}>確定新增</button>
              </div>
            </div>
          </div>
        )}

        {alertMessage && (
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
              <h3 style={{ color: 'var(--crayon-purple)', marginTop: 0 }}>提示</h3>
              <p style={{ fontSize: '1.1rem', marginBottom: '20px' }}>{alertMessage}</p>
              <button className="doodle-button" style={{ width: '100%' }} onClick={() => setAlertMessage(null)}>確定</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontFamily: 'Caveat, cursive', fontSize: '2.5rem', color: 'var(--crayon-blue)' }}>📝 盤點項目明細</h2>
      </div>

      <div className="doodle-border" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>🔍 查詢功能區</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ width: '150px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', marginBottom: '5px', cursor: 'pointer' }}>
              <input type="checkbox" checked={useDateFilter} onChange={e => setUseDateFilter(e.target.checked)} />
              啟用日期篩選 (起)
            </label>
            <div style={{ pointerEvents: useDateFilter ? 'auto' : 'none', opacity: useDateFilter ? 1 : 0.4 }}>
              <CrayonDatePicker value={filterStartDate} onChange={setFilterStartDate} />
            </div>
          </div>
          <div style={{ width: '150px' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px', opacity: useDateFilter ? 1 : 0.4 }}>派送日期迄：</label>
            <div style={{ pointerEvents: useDateFilter ? 'auto' : 'none', opacity: useDateFilter ? 1 : 0.4 }}>
              <CrayonDatePicker value={filterEndDate} onChange={setFilterEndDate} />
            </div>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', marginBottom: '5px', cursor: 'pointer' }}>
              <input type="checkbox" checked={useTicketIdFilter} onChange={e => setUseTicketIdFilter(e.target.checked)} />
              啟用單號篩選
            </label>
            <input className="doodle-input" style={{ width: '150px', opacity: useTicketIdFilter ? 1 : 0.4 }} value={filterTicketId} onChange={e => setFilterTicketId(e.target.value)} placeholder="輸入單號" disabled={!useTicketIdFilter} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>盤點種類：</label>
            <select className="doodle-input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as '全部' | '一般' | '追加')}>
              <option value="全部">全部</option>
              <option value="一般">一般</option>
              <option value="追加">追加</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>盤點類型：</label>
            <select className="doodle-input" value={filterTicketType} onChange={e => setFilterTicketType(e.target.value)}>
              <option value="all">全部</option>
              <option value="夾鉗">夾鉗</option>
              <option value="TKW">TKW</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>盤點單狀態：</label>
            <select className="doodle-input" value={filterTicketStatus} onChange={e => setFilterTicketStatus(e.target.value)}>
              <option value="all">全部</option>
              <option value="uncompleted">未結案</option>
              <option value="completed">已結案</option>
            </select>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button className="doodle-button" style={{ height: '42px' }} onClick={() => {
              setFilterTicketId(''); setCategoryFilter('一般'); setFilterTicketType('all'); setFilterTicketStatus('all');
              const d = new Date();
              setFilterEndDate(d.toISOString().split('T')[0]);
              d.setMonth(d.getMonth() - 1);
              setFilterStartDate(d.toISOString().split('T')[0]);
              setUseDateFilter(true);
              setUseTicketIdFilter(true);
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
              <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>盤點單狀態</th>
              <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>盤點類型</th>
              <th style={{ padding: '10px', border: '1px solid var(--crayon-dark)' }}>項目數 (已匯入)</th>
            </tr>
          </thead>
          <tbody>
            {currentTickets.map((t, index) => {
              const seqNum = (currentPage - 1) * itemsPerPage + index + 1;
              const uniqueItemsImported = new Set(details.filter(d => d.ticketId === t.id).map(d => d.itemSeq)).size;
              const totalItems = t.itemCount || 0;
              const isComplete = !!t.closeDate;
              const isAllImported = totalItems > 0 && uniqueItemsImported >= totalItems;
              
              const rowBgColor = isAllImported 
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
                  <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-dark)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-dark)', fontWeight: 'bold' }}>
                      {seqNum}
                    </span>
                  </td>
                  <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-purple)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-purple)', fontWeight: 'bold' }}>
                      {t.id}
                    </span>
                  </td>
                  <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                    <span style={{ display: 'inline-block', backgroundColor: isComplete ? 'var(--crayon-green)' : 'var(--crayon-red)', border: '2px solid var(--crayon-dark)', padding: '2px 8px', borderRadius: '10px', color: 'white', fontWeight: 'bold' }}>
                      {isComplete ? '已結案' : '未結案'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'white', border: '1px dashed var(--crayon-blue)', padding: '2px 8px', borderRadius: '10px', color: 'var(--crayon-blue)', fontWeight: 'bold' }}>
                      {t.ticketType || '無'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', borderRight: '1px solid var(--crayon-dark)' }}>
                    <span style={{ display: 'inline-block', backgroundColor: 'white', border: `1px dashed ${isAllImported ? '#1b5e20' : uniqueItemsImported > 0 ? 'var(--crayon-orange)' : '#999'}`, padding: '2px 8px', borderRadius: '10px', color: isAllImported ? '#1b5e20' : uniqueItemsImported > 0 ? 'var(--crayon-orange)' : '#999', fontWeight: 'bold' }}>
                      {uniqueItemsImported} / {totalItems || '未知'}
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
