import { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import type { MaterialItem, MaterialHistoryLog } from '../types';
import {
  getMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  getHeadTypes,
  saveHeadTypes,
  getMaterialHistoryLogs
} from '../services/api';
import CrayonDatePicker from '../components/CrayonDatePicker';
import { useAuth } from '../contexts/AuthContext';

const HEAD_TYPE_STYLES: { bg: string; color: string; border: string }[] = [
  { bg: '#f3e8ff', color: '#7e22ce', border: '#d8b4fe' }, // purple (A型)
  { bg: '#fce7f3', color: '#be185d', border: '#fbcfe8' }, // pink (B型)
  { bg: '#d1fae5', color: '#047857', border: '#a7f3d0' }, // emerald (C型)
  { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' }, // blue
  { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' }, // orange
  { bg: '#cffafe', color: '#0e7490', border: '#a5f3fc' }, // cyan
  { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' }, // indigo
  { bg: '#ffe4e6', color: '#be123c', border: '#fecdd3' }, // rose
  { bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' }, // teal
  { bg: '#fef3c7', color: '#b45309', border: '#fde68a' }  // amber
];

const getHeadTypeStyle = (headType?: string) => {
  if (!headType) return { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' };
  if (headType === 'A型') return HEAD_TYPE_STYLES[0];
  if (headType === 'B型') return HEAD_TYPE_STYLES[1];
  if (headType === 'C型') return HEAD_TYPE_STYLES[2];

  let hash = 0;
  for (let i = 0; i < headType.length; i++) {
    hash = headType.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  return HEAD_TYPE_STYLES[3 + (hash % (HEAD_TYPE_STYLES.length - 3))];
};

export default function MaterialsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('materials', 'edit');

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<MaterialItem | null>(null);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<'asc' | 'desc' | 'cat_asc' | 'cat_desc' | 'none'>('asc');
  const [searchName, setSearchName] = useState('');
  const [searchPartName, setSearchPartName] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchHeadType, setSearchHeadType] = useState('all');

  const [formData, setFormData] = useState<MaterialItem>({
    name: '',
    partName: '',
    headType: '',
    stock: 0,
    unit: 'PCS',
    category: '未分類'
  });

  // History Tab State
  const [activeTab, setActiveTab] = useState<'list' | 'history'>('list');
  const [historyLogs, setHistoryLogs] = useState<MaterialHistoryLog[]>([]);

  const [histSearchName, setHistSearchName] = useState('');
  const [histSearchPartName, setHistSearchPartName] = useState('');
  const [histSearchCat, setHistSearchCat] = useState('all');
  const [histSearchHeadType, setHistSearchHeadType] = useState('all');
  const [histStartDate, setHistStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [histEndDate, setHistEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [histSort, setHistSort] = useState<'desc' | 'asc'>('desc');
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(10);

  // Head Types State
  const [headTypes, setHeadTypes] = useState<string[]>(['A型', 'B型', 'C型']);
  const [isHeadTypeMenuOpen, setIsHeadTypeMenuOpen] = useState(false);
  const [newHeadType, setNewHeadType] = useState('');
  const [editingHeadTypeIndex, setEditingHeadTypeIndex] = useState<number | null>(null);
  const [editHeadTypeText, setEditHeadTypeText] = useState('');
  const headTypeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headTypeDropdownRef.current && !headTypeDropdownRef.current.contains(e.target as Node)) {
        setIsHeadTypeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadHeadTypesData = async () => {
    try {
      const types = await getHeadTypes();
      setHeadTypes(types);
    } catch (err) {
      console.error('Error loading head types:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [matsData, logsData] = await Promise.all([
        getMaterials(),
        getMaterialHistoryLogs()
      ]);
      setMaterials(matsData);
      setHistoryLogs(logsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHeadTypesData();
    loadData();
  }, []);

  const addHeadType = () => {
    if (!newHeadType.trim()) return;
    const updated = [...headTypes, newHeadType.trim()];
    setHeadTypes(updated);
    setNewHeadType('');
    saveHeadTypes(updated);
  };

  const handleSaveEditHeadType = () => {
    if (editingHeadTypeIndex === null || !editHeadTypeText.trim()) return;
    const updated = [...headTypes];
    updated[editingHeadTypeIndex] = editHeadTypeText.trim();
    setHeadTypes(updated);
    setEditingHeadTypeIndex(null);
    saveHeadTypes(updated);
  };

  const handleDeleteHeadType = (index: number) => {
    const updated = headTypes.filter((_, i) => i !== index);
    setHeadTypes(updated);
    saveHeadTypes(updated);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setSystemAlert('物料品號不能為空白！');
      return;
    }

    const isDuplicate = materials.some(
      m => m.name.toLowerCase() === formData.name.trim().toLowerCase() && m.id !== editingId
    );
    if (isDuplicate) {
      setSystemAlert(`系統中已存在相同的物料品號 [${formData.name.trim()}]！`);
      return;
    }

    try {
      const payload: Omit<MaterialItem, 'id'> = {
        name: formData.name.trim(),
        partName: formData.partName || '',
        headType: formData.headType || '',
        stock: Number(formData.stock) || 0,
        unit: formData.unit || 'PCS',
        category: formData.category || '未分類'
      };
      if (editingId) {
        await updateMaterial(editingId, payload);
      } else {
        await addMaterial(payload);
      }
      setIsOpen(false);
      loadData();
      setFormData({
        name: '',
        partName: '',
        headType: '',
        stock: 0,
        unit: 'PCS',
        category: '未分類'
      });
      setEditingId(null);
    } catch (err) {
      console.error('Error saving material:', err);
      setSystemAlert('儲存物料失敗！');
    }
  };

  const handleEdit = (mat: MaterialItem) => {
    setFormData({
      ...mat,
      category: mat.category || '未分類',
      headType: mat.headType || ''
    });
    setEditingId(mat.id || null);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterial(id);
      setDeleteConfirmItem(null);
      loadData();
    } catch (err) {
      console.error('Error deleting material:', err);
      setSystemAlert('刪除物料失敗！');
    }
  };

  const openNewForm = () => {
    setFormData({
      name: '',
      partName: '',
      headType: '',
      stock: 0,
      unit: 'PCS',
      category: '未分類'
    });
    setEditingId(null);
    setIsOpen(true);
  };

  // Filter logic for Materials List
  const filteredMaterials = materials.filter(mat => {
    const matchName =
      searchName === '' || mat.name.toLowerCase().includes(searchName.toLowerCase());
    const matchPartName =
      searchPartName === '' ||
      (mat.partName && mat.partName.toLowerCase().includes(searchPartName.toLowerCase()));
    const matchCategory =
      searchCategory === 'all' || (mat.category || '未分類') === searchCategory;
    const matchHeadType =
      searchHeadType === 'all' ||
      (searchHeadType === 'none' ? !mat.headType : mat.headType === searchHeadType);
    return matchName && matchPartName && matchCategory && matchHeadType;
  });

  // Sort logic
  const sortedMaterials = [...filteredMaterials];
  if (sortBy === 'asc') {
    sortedMaterials.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'desc') {
    sortedMaterials.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sortBy === 'cat_asc') {
    sortedMaterials.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  } else if (sortBy === 'cat_desc') {
    sortedMaterials.sort((a, b) => (b.category || '').localeCompare(a.category || ''));
  }

  const totalItems = sortedMaterials.length;
  const categoryCounts = sortedMaterials.reduce((acc, m) => {
    const cat = m.category || '未分類';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = sortedMaterials.slice((page - 1) * pageSize, page * pageSize);

  // History Filter logic
  const filteredHist = historyLogs.filter(log => {
    const mat = materials.find(m => m.id === log.materialId);
    if (
      histSearchName &&
      !log.materialName.toLowerCase().includes(histSearchName.toLowerCase()) &&
      !(mat?.name && mat.name.toLowerCase().includes(histSearchName.toLowerCase()))
    ) {
      return false;
    }
    if (
      histSearchPartName &&
      !(mat?.partName && mat.partName.toLowerCase().includes(histSearchPartName.toLowerCase()))
    ) {
      return false;
    }
    if (histSearchCat !== 'all' && (mat?.category || '未分類') !== histSearchCat) return false;
    if (
      histSearchHeadType !== 'all' &&
      (histSearchHeadType === 'none' ? !!mat?.headType : mat?.headType !== histSearchHeadType)
    ) {
      return false;
    }
    if (histStartDate && log.restockDate < histStartDate) return false;
    if (histEndDate && log.restockDate > histEndDate) return false;
    return true;
  });

  filteredHist.sort((a, b) => {
    if (histSort === 'desc') return b.restockDate.localeCompare(a.restockDate);
    return a.restockDate.localeCompare(b.restockDate);
  });

  const histTotalItems = filteredHist.length;
  const histTotalPages = Math.ceil(histTotalItems / histPageSize) || 1;
  const histPaginatedData = filteredHist.slice(
    (histPage - 1) * histPageSize,
    histPage * histPageSize
  );

  const handleExportExcel = async () => {
    const exportData = filteredHist.map((log, index) => {
      const mat = materials.find(m => m.id === log.materialId);
      return {
        序號: index + 1,
        補完日期: log.restockDate,
        物料分類: mat?.category || '未分類',
        物料品號: log.materialName,
        物料品名: mat?.partName || '',
        頭型: mat?.headType || '',
        來源管制單號: log.controlId,
        '補完/進貨備註': log.notes || ''
      };
    });

    if (exportData.length === 0) {
      setSystemAlert('目前沒有符合條件的歷程資料可匯出！');
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('庫存變更歷程');
    const headers = Object.keys(exportData[0]);
    ws.columns = headers.map(h => ({
      header: h,
      key: h,
      width: Math.max(14, h.length * 2 + 4)
    }));
    exportData.forEach(r => ws.addRow(r));
    ws.getRow(1).font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `庫存變更歷程_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasPermission('materials', 'view')) {
    return (
      <div className="doodle-border" style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fff', marginTop: '20px' }}>
        <h2 style={{ color: 'var(--crayon-red)', marginTop: 0 }}>🚫 無權限存取「物料庫存」功能</h2>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>您的帳號目前未被授權檢視此頁面，請聯絡系統管理員。</p>
      </div>
    );
  }

  return (
    <div>
      {/* 頂部標題與新增物料按鈕 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '15px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'Caveat, cursive',
              fontSize: '2.5rem',
              color: 'var(--crayon-blue)'
            }}
          >
            📦 物料庫存
          </h2>
          {activeTab === 'list' && canEdit && (
            <button
              type="button"
              className="doodle-button success"
              style={{ fontWeight: 'bold', fontSize: '1.05rem', padding: '8px 18px' }}
              onClick={openNewForm}
            >
              ＋ 新增物料
            </button>
          )}
        </div>
      </div>

      {/* 分頁切換列：物料清單 / 庫存變更歷程 */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '3px dashed var(--crayon-dark)',
          paddingBottom: '12px'
        }}
      >
        <button
          type="button"
          className="doodle-button"
          style={{
            padding: '8px 20px',
            fontSize: '1.05rem',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'list' ? 'var(--crayon-blue)' : 'white',
            color: activeTab === 'list' ? 'white' : 'var(--crayon-dark)'
          }}
          onClick={() => setActiveTab('list')}
        >
          📋 物料清單
        </button>
        <button
          type="button"
          className="doodle-button"
          style={{
            padding: '8px 20px',
            fontSize: '1.05rem',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'history' ? 'var(--crayon-purple)' : 'white',
            color: activeTab === 'history' ? 'white' : 'var(--crayon-dark)'
          }}
          onClick={() => setActiveTab('history')}
        >
          🕒 庫存變更歷程
        </button>
      </div>

      {/* 分頁 1：物料清單 */}
      {activeTab === 'list' && (
        <>
          {/* 查詢、排序與統計列 */}
          <div
            className="doodle-border"
            style={{
              padding: '18px 20px',
              marginBottom: '20px',
              backgroundColor: '#f9f9f9',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {/* 第一行：查詢與排序 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>查詢品號：</label>
                <input
                  className="doodle-input"
                  style={{ width: '140px', backgroundColor: 'white' }}
                  placeholder="輸入品號..."
                  value={searchName}
                  onChange={e => {
                    setSearchName(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>查詢品名：</label>
                <input
                  className="doodle-input"
                  style={{ width: '140px', backgroundColor: 'white' }}
                  placeholder="輸入品名..."
                  value={searchPartName}
                  onChange={e => {
                    setSearchPartName(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>查詢分類：</label>
                <select
                  className="doodle-input"
                  style={{ width: 'auto', backgroundColor: 'white' }}
                  value={searchCategory}
                  onChange={e => {
                    setSearchCategory(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">全部分類</option>
                  <option value="未分類">未分類</option>
                  <option value="TKW">TKW</option>
                  <option value="夾鉗">夾鉗</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>查詢頭型：</label>
                <select
                  className="doodle-input"
                  style={{ width: 'auto', backgroundColor: 'white' }}
                  value={searchHeadType}
                  onChange={e => {
                    setSearchHeadType(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">全部</option>
                  <option value="none">無 (空白)</option>
                  {headTypes.filter(Boolean).map(ht => (
                    <option key={ht} value={ht}>
                      {ht}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderLeft: '2px dashed var(--crayon-dark)',
                  paddingLeft: '14px'
                }}
              >
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--crayon-blue)' }}>
                  排序：
                </label>
                <select
                  className="doodle-input"
                  style={{ width: 'auto', backgroundColor: 'white', border: '2px solid var(--crayon-blue)' }}
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                >
                  <option value="none">預設排序</option>
                  <option value="asc">依物料品號 由小到大</option>
                  <option value="desc">依物料品號 由大到小</option>
                  <option value="cat_asc">依物料分類 由小到大</option>
                  <option value="cat_desc">依物料分類 由大到小</option>
                </select>
              </div>
            </div>

            {/* 第二行：統計數量與分頁控制 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                borderTop: '2px dashed #ccc',
                paddingTop: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    color: 'var(--crayon-dark)',
                    backgroundColor: 'var(--crayon-yellow)',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    border: '2px solid var(--crayon-dark)'
                  }}
                >
                  👉 總計：{totalItems} 筆
                </span>
                {Object.entries(categoryCounts).map(([cat, count]) => (
                  <span
                    key={cat}
                    style={{
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      color: 'var(--crayon-blue)',
                      backgroundColor: '#e3f2fd',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      border: '1.5px dashed var(--crayon-blue)'
                    }}
                  >
                    {cat}：{count}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontWeight: 'bold' }}>每頁顯示：</label>
                  <select
                    className="doodle-input"
                    style={{ width: 'auto', backgroundColor: 'white' }}
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10 筆</option>
                    <option value={20}>20 筆</option>
                    <option value={30}>30 筆</option>
                    <option value={50}>50 筆</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="doodle-button"
                    style={{ padding: '5px 12px', minHeight: 'auto' }}
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    上一頁
                  </button>
                  <span style={{ fontWeight: 'bold' }}>
                    第 {page} / {totalPages} 頁
                  </span>
                  <button
                    type="button"
                    className="doodle-button"
                    style={{ padding: '5px 12px', minHeight: 'auto' }}
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    下一頁
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 物料清單表格 */}
          <div className="doodle-border" style={{ overflowX: 'auto', backgroundColor: 'white' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--crayon-dark)', color: 'white' }}>
                  {canEdit && <th style={{ padding: '14px', width: '150px' }}>操作</th>}
                  <th style={{ padding: '14px', width: '75px' }}>序號</th>
                  <th style={{ padding: '14px' }}>物料分類</th>
                  <th style={{ padding: '14px' }}>物料品號</th>
                  <th style={{ padding: '14px' }}>物料品名</th>
                  <th style={{ padding: '14px' }}>頭型</th>
                  <th style={{ padding: '14px' }}>庫存數量</th>
                  <th style={{ padding: '14px' }}>單位</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={canEdit ? 8 : 7}
                      style={{ padding: '30px', textAlign: 'center', fontWeight: 'bold' }}
                    >
                      載入中...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canEdit ? 8 : 7}
                      style={{ padding: '30px', textAlign: 'center', color: '#666', fontWeight: 'bold' }}
                    >
                      尚無物料資料
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((mat, index) => {
                    const htStyle = getHeadTypeStyle(mat.headType);
                    const isZeroStock = mat.stock === 0;

                    return (
                      <tr
                        key={mat.id || index}
                        style={{
                          borderTop: '2px solid var(--crayon-dark)',
                          backgroundColor: isZeroStock
                            ? '#fee2e2'
                            : index % 2 === 0
                            ? '#fafafa'
                            : '#ffffff'
                        }}
                      >
                        {canEdit && (
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className="doodle-button"
                                style={{
                                  padding: '4px 12px',
                                  fontSize: '0.88rem',
                                  minHeight: 'auto',
                                  fontWeight: 'bold'
                                }}
                                onClick={() => handleEdit(mat)}
                              >
                                編輯
                              </button>
                              <button
                                type="button"
                                className="doodle-button danger"
                                style={{
                                  padding: '4px 12px',
                                  fontSize: '0.88rem',
                                  minHeight: 'auto',
                                  fontWeight: 'bold'
                                }}
                                onClick={() => setDeleteConfirmItem(mat)}
                              >
                                刪除
                              </button>
                            </div>
                          </td>
                        )}
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              fontWeight: '900',
                              fontSize: '1.1rem',
                              color: 'white',
                              backgroundColor: '#c026d3',
                              border: '3px solid #f5d0fe',
                              boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
                            }}
                          >
                            {(page - 1) * pageSize + index + 1}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {mat.category === 'TKW' ? (
                            <span
                              style={{
                                backgroundColor: '#dbeafe',
                                color: '#1d4ed8',
                                border: '2px solid #93c5fd',
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '0.9rem'
                              }}
                            >
                              TKW
                            </span>
                          ) : mat.category === '夾鉗' ? (
                            <span
                              style={{
                                backgroundColor: '#ffedd5',
                                color: '#c2410c',
                                border: '2px solid #fdba74',
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '0.9rem'
                              }}
                            >
                              夾鉗
                            </span>
                          ) : (
                            <span style={{ color: '#666', fontWeight: 'bold' }}>
                              {mat.category || '未分類'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontSize: '1.05rem',
                              fontWeight: 'bold',
                              backgroundColor: '#ccfbf1',
                              color: '#115e59',
                              border: '2px solid #5eead4',
                              padding: '4px 12px',
                              borderRadius: '8px',
                              boxShadow: '1px 1px 0px rgba(0,0,0,0.1)'
                            }}
                          >
                            {mat.name}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {mat.partName ? (
                            <span
                              style={{
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                backgroundColor: '#eef2ff',
                                color: '#4338ca',
                                border: '2px solid #c7d2fe',
                                padding: '4px 12px',
                                borderRadius: '8px'
                              }}
                            >
                              {mat.partName}
                            </span>
                          ) : (
                            <span style={{ color: '#888' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {mat.headType ? (
                            <span
                              style={{
                                backgroundColor: htStyle.bg,
                                color: htStyle.color,
                                border: `2px solid ${htStyle.border}`,
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '0.88rem'
                              }}
                            >
                              {mat.headType}
                            </span>
                          ) : (
                            <span style={{ color: '#888' }}>-</span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: '12px 14px',
                            fontWeight: '900',
                            fontSize: '1.15rem',
                            color: isZeroStock ? 'var(--crayon-red)' : 'var(--crayon-dark)'
                          }}
                        >
                          {mat.stock}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 'bold' }}>{mat.unit}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 分頁 2：庫存變更歷程 */}
      {activeTab === 'history' && (
        <>
          <div
            className="doodle-border"
            style={{
              padding: '18px 20px',
              marginBottom: '20px',
              backgroundColor: '#f9f9f9',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {/* 第一行：品號、品名、分類、頭型 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>查詢品號：</label>
                <input
                  className="doodle-input"
                  style={{ width: '140px', backgroundColor: 'white' }}
                  placeholder="輸入品號..."
                  value={histSearchName}
                  onChange={e => {
                    setHistSearchName(e.target.value);
                    setHistPage(1);
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>查詢品名：</label>
                <input
                  className="doodle-input"
                  style={{ width: '140px', backgroundColor: 'white' }}
                  placeholder="輸入品名..."
                  value={histSearchPartName}
                  onChange={e => {
                    setHistSearchPartName(e.target.value);
                    setHistPage(1);
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>查詢分類：</label>
                <select
                  className="doodle-input"
                  style={{ width: 'auto', backgroundColor: 'white' }}
                  value={histSearchCat}
                  onChange={e => {
                    setHistSearchCat(e.target.value);
                    setHistPage(1);
                  }}
                >
                  <option value="all">全部分類</option>
                  <option value="未分類">未分類</option>
                  <option value="TKW">TKW</option>
                  <option value="夾鉗">夾鉗</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>查詢頭型：</label>
                <select
                  className="doodle-input"
                  style={{ width: 'auto', backgroundColor: 'white' }}
                  value={histSearchHeadType}
                  onChange={e => {
                    setHistSearchHeadType(e.target.value);
                    setHistPage(1);
                  }}
                >
                  <option value="all">全部</option>
                  <option value="none">無 (空白)</option>
                  {headTypes.filter(Boolean).map(ht => (
                    <option key={ht} value={ht}>
                      {ht}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 第二行：日期(起)、日期(迄)、日期清空、排序、匯出 Excel、分頁控制 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px',
                borderTop: '2px dashed #ccc',
                paddingTop: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>日期(起)：</label>
                  <div style={{ width: '150px' }}>
                    <CrayonDatePicker
                      value={histStartDate}
                      onChange={val => {
                        setHistStartDate(val);
                        setHistPage(1);
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>日期(迄)：</label>
                  <div style={{ width: '150px' }}>
                    <CrayonDatePicker
                      value={histEndDate}
                      onChange={val => {
                        setHistEndDate(val);
                        setHistPage(1);
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="doodle-button"
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.88rem',
                    minHeight: 'auto',
                    backgroundColor: 'white',
                    color: 'var(--crayon-dark)'
                  }}
                  onClick={() => {
                    setHistStartDate('');
                    setHistEndDate('');
                    setHistPage(1);
                  }}
                >
                  日期清空
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderLeft: '2px dashed var(--crayon-dark)',
                    paddingLeft: '12px'
                  }}
                >
                  <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>日期排序：</label>
                  <select
                    className="doodle-input"
                    style={{ width: 'auto', backgroundColor: 'white' }}
                    value={histSort}
                    onChange={e => {
                      setHistSort(e.target.value as 'asc' | 'desc');
                      setHistPage(1);
                    }}
                  >
                    <option value="desc">由大到小 (新到舊)</option>
                    <option value="asc">由小到大 (舊到新)</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="doodle-button success"
                  style={{ padding: '5px 14px', fontSize: '0.92rem', fontWeight: 'bold', minHeight: 'auto' }}
                  onClick={handleExportExcel}
                >
                  📥 匯出 Excel
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--crayon-blue)' }}>
                  總計：{histTotalItems} 筆資料
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontWeight: 'bold' }}>每頁顯示：</label>
                  <select
                    className="doodle-input"
                    style={{ width: 'auto', backgroundColor: 'white' }}
                    value={histPageSize}
                    onChange={e => {
                      setHistPageSize(Number(e.target.value));
                      setHistPage(1);
                    }}
                  >
                    <option value={10}>10 筆</option>
                    <option value={20}>20 筆</option>
                    <option value={30}>30 筆</option>
                    <option value={50}>50 筆</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="doodle-button"
                    style={{ padding: '5px 12px', minHeight: 'auto' }}
                    disabled={histPage === 1}
                    onClick={() => setHistPage(p => Math.max(1, p - 1))}
                  >
                    上一頁
                  </button>
                  <span style={{ fontWeight: 'bold' }}>
                    第 {histPage} / {histTotalPages} 頁
                  </span>
                  <button
                    type="button"
                    className="doodle-button"
                    style={{ padding: '5px 12px', minHeight: 'auto' }}
                    disabled={histPage === histTotalPages}
                    onClick={() => setHistPage(p => Math.min(histTotalPages, p + 1))}
                  >
                    下一頁
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 庫存變更歷程表格 */}
          <div className="doodle-border" style={{ overflowX: 'auto', backgroundColor: 'white' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--crayon-dark)', color: 'white' }}>
                  <th style={{ padding: '14px', width: '75px' }}>序號</th>
                  <th style={{ padding: '14px' }}>補完日期</th>
                  <th style={{ padding: '14px' }}>物料分類</th>
                  <th style={{ padding: '14px' }}>物料品號</th>
                  <th style={{ padding: '14px' }}>物料品名</th>
                  <th style={{ padding: '14px' }}>頭型</th>
                  <th style={{ padding: '14px' }}>來源管制單號</th>
                  <th style={{ padding: '14px' }}>補完/進貨備註</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '30px', textAlign: 'center', fontWeight: 'bold' }}>
                      載入中...
                    </td>
                  </tr>
                ) : histPaginatedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ padding: '30px', textAlign: 'center', color: '#666', fontWeight: 'bold' }}
                    >
                      無符合條件的歷程記錄
                    </td>
                  </tr>
                ) : (
                  histPaginatedData.map((log, index) => {
                    const mat = materials.find(m => m.id === log.materialId);
                    const htStyle = getHeadTypeStyle(mat?.headType);

                    return (
                      <tr
                        key={log.id}
                        style={{
                          borderTop: '2px solid var(--crayon-dark)',
                          backgroundColor: index % 2 === 0 ? '#fef3c7' : '#e0f2fe'
                        }}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              fontWeight: '900',
                              fontSize: '1.1rem',
                              color: 'white',
                              backgroundColor: '#c026d3',
                              border: '3px solid #f5d0fe',
                              boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
                            }}
                          >
                            {(histPage - 1) * histPageSize + index + 1}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#15803d' }}>
                          {log.restockDate}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {mat?.category === 'TKW' ? (
                            <span
                              style={{
                                backgroundColor: '#dbeafe',
                                color: '#1d4ed8',
                                border: '2px solid #93c5fd',
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '0.9rem'
                              }}
                            >
                              TKW
                            </span>
                          ) : mat?.category === '夾鉗' ? (
                            <span
                              style={{
                                backgroundColor: '#ffedd5',
                                color: '#c2410c',
                                border: '2px solid #fdba74',
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '0.9rem'
                              }}
                            >
                              夾鉗
                            </span>
                          ) : (
                            <span style={{ color: '#666', fontWeight: 'bold' }}>
                              {mat?.category || '未分類'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontSize: '1.05rem',
                              fontWeight: 'bold',
                              backgroundColor: '#ccfbf1',
                              color: '#115e59',
                              border: '2px solid #5eead4',
                              padding: '4px 12px',
                              borderRadius: '8px'
                            }}
                          >
                            {log.materialName}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {mat?.partName ? (
                            <span
                              style={{
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                backgroundColor: '#eef2ff',
                                color: '#4338ca',
                                border: '2px solid #c7d2fe',
                                padding: '4px 12px',
                                borderRadius: '8px'
                              }}
                            >
                              {mat.partName}
                            </span>
                          ) : (
                            <span style={{ color: '#888' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {mat?.headType ? (
                            <span
                              style={{
                                backgroundColor: htStyle.bg,
                                color: htStyle.color,
                                border: `2px solid ${htStyle.border}`,
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '0.88rem'
                              }}
                            >
                              {mat.headType}
                            </span>
                          ) : (
                            <span style={{ color: '#888' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 'bold' }}>{log.controlId}</td>
                        <td style={{ padding: '12px 14px' }}>{log.notes || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 新增 / 編輯物料 彈出視窗 */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '15px'
          }}
        >
          <div
            className="doodle-border"
            style={{
              padding: '28px',
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'white',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'var(--crayon-paper)',
                border: '2px solid var(--crayon-dark)',
                fontSize: '1.1rem',
                cursor: 'pointer',
                color: 'var(--crayon-red)',
                fontWeight: 'bold',
                width: '35px',
                height: '35px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
              }}
            >
              ❌
            </button>

            <h3 style={{ marginTop: 0, fontSize: '1.6rem', color: 'var(--crayon-dark)' }}>
              {editingId ? '📝 編輯物料' : '➕ 新增物料'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  物料品號：
                </label>
                <input
                  className="doodle-input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  onBlur={() => {
                    if (formData.name.trim()) {
                      const isDuplicate = materials.some(
                        m =>
                          m.name.toLowerCase() === formData.name.trim().toLowerCase() &&
                          m.id !== editingId
                      );
                      if (isDuplicate) {
                        setSystemAlert(`系統中已存在相同的物料品號 [${formData.name.trim()}]！`);
                      }
                    }
                  }}
                  placeholder="輸入物料品號"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  物料品名：
                </label>
                <input
                  className="doodle-input"
                  value={formData.partName || ''}
                  onChange={e => setFormData({ ...formData, partName: e.target.value })}
                  placeholder="輸入物料品名 (選填)"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  物料分類：
                </label>
                <select
                  className="doodle-input"
                  value={formData.category || '未分類'}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="未分類">未分類</option>
                  <option value="TKW">TKW</option>
                  <option value="夾鉗">夾鉗</option>
                </select>
              </div>

              {/* 頭型選取與動態新增/編輯/刪除 */}
              <div ref={headTypeDropdownRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  頭型：
                </label>
                <button
                  type="button"
                  className="doodle-input"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    fontWeight: 'bold'
                  }}
                  onClick={() => setIsHeadTypeMenuOpen(prev => !prev)}
                >
                  <span style={{ color: formData.headType ? 'var(--crayon-dark)' : '#888' }}>
                    {formData.headType || '頭型 (選填)'}
                  </span>
                  <span>▼</span>
                </button>

                {isHeadTypeMenuOpen && (
                  <div
                    className="doodle-border"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '6px',
                      backgroundColor: 'white',
                      padding: '12px',
                      zIndex: 50,
                      boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input
                        className="doodle-input"
                        style={{ flex: 1, padding: '5px 8px', fontSize: '0.9rem' }}
                        value={newHeadType}
                        onChange={e => setNewHeadType(e.target.value)}
                        placeholder="新增頭型..."
                      />
                      <button
                        type="button"
                        className="doodle-button success"
                        style={{ padding: '4px 12px', fontSize: '0.88rem', minHeight: 'auto', fontWeight: 'bold' }}
                        onClick={addHeadType}
                      >
                        新增
                      </button>
                    </div>

                    <div
                      style={{
                        maxHeight: '190px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div
                        onClick={() => {
                          setFormData({ ...formData, headType: '' });
                          setIsHeadTypeMenuOpen(false);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#f5f5f5',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.9rem'
                        }}
                      >
                        無 (空白)
                      </div>

                      {headTypes.map((ht, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            if (editingHeadTypeIndex !== i) {
                              setFormData({ ...formData, headType: ht });
                              setIsHeadTypeMenuOpen(false);
                            }
                          }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor:
                              formData.headType === ht ? '#e3f2fd' : '#fafafa',
                            border: '1.5px solid #ddd',
                            cursor: 'pointer'
                          }}
                        >
                          {editingHeadTypeIndex === i ? (
                            <div
                              style={{ display: 'flex', gap: '6px', width: '100%' }}
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                className="doodle-input"
                                style={{ flex: 1, padding: '3px 8px', fontSize: '0.88rem' }}
                                value={editHeadTypeText}
                                onChange={e => setEditHeadTypeText(e.target.value)}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="doodle-button success"
                                style={{ padding: '2px 8px', fontSize: '0.8rem', minHeight: 'auto' }}
                                onClick={handleSaveEditHeadType}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                className="doodle-button"
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '0.8rem',
                                  minHeight: 'auto',
                                  backgroundColor: '#eee',
                                  color: 'var(--crayon-dark)'
                                }}
                                onClick={() => setEditingHeadTypeIndex(null)}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <span style={{ fontWeight: 'bold', fontSize: '0.92rem' }}>{ht}</span>
                              <div
                                style={{ display: 'flex', gap: '6px' }}
                                onClick={e => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="doodle-button"
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '0.78rem',
                                    minHeight: 'auto',
                                    backgroundColor: '#fff9c4',
                                    color: 'var(--crayon-dark)'
                                  }}
                                  onClick={() => {
                                    setEditingHeadTypeIndex(i);
                                    setEditHeadTypeText(ht);
                                  }}
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  className="doodle-button danger"
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '0.78rem',
                                    minHeight: 'auto'
                                  }}
                                  onClick={() => handleDeleteHeadType(i)}
                                >
                                  🗑️
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {headTypes.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#888', padding: '12px' }}>
                          無可用頭型
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  庫存數量：
                </label>
                <input
                  type="number"
                  className="doodle-input"
                  value={formData.stock}
                  onChange={e =>
                    setFormData({ ...formData, stock: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  單位：
                </label>
                <select
                  className="doodle-input"
                  value={formData.unit}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                >
                  <option value="PCS">PCS</option>
                  <option value="KG">KG</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="doodle-button success"
                  style={{ flex: 1, fontWeight: 'bold', fontSize: '1.05rem' }}
                  onClick={handleSave}
                >
                  儲存
                </button>
                <button
                  type="button"
                  className="doodle-button"
                  style={{
                    flex: 1,
                    fontWeight: 'bold',
                    fontSize: '1.05rem',
                    backgroundColor: '#eee',
                    color: 'var(--crayon-dark)'
                  }}
                  onClick={() => setIsOpen(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 確認刪除物料 彈出視窗 */}
      {deleteConfirmItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '15px'
          }}
        >
          <div
            className="doodle-border"
            style={{
              padding: '28px',
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'white',
              textAlign: 'center'
            }}
          >
            <h3 style={{ color: 'var(--crayon-red)', fontSize: '1.8rem', marginTop: 0 }}>
              ⚠️ 確認刪除物料
            </h3>
            <p style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>
              您確定要刪除物料品號 <strong>{deleteConfirmItem.name}</strong> 嗎？<br />
              此動作無法復原。
            </p>
            {(deleteConfirmItem.stock || 0) > 0 && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#ffebee',
                  color: 'var(--crayon-red)',
                  borderRadius: '10px',
                  border: '2px dashed var(--crayon-red)',
                  fontWeight: 'bold',
                  marginBottom: '18px'
                }}
              >
                ⚠️ 警告：該物料目前尚有庫存 {deleteConfirmItem.stock}{' '}
                {deleteConfirmItem.unit}！刪除後將遺失此庫存資料。
              </div>
            )}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
              <button
                type="button"
                className="doodle-button"
                style={{ backgroundColor: '#eee', color: 'var(--crayon-dark)' }}
                onClick={() => setDeleteConfirmItem(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="doodle-button danger"
                onClick={() => {
                  if (deleteConfirmItem.id) handleDelete(deleteConfirmItem.id);
                }}
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 系統提示 彈出視窗 */}
      {systemAlert && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '15px'
          }}
        >
          <div
            className="doodle-border"
            style={{
              padding: '28px',
              width: '100%',
              maxWidth: '400px',
              backgroundColor: 'white',
              textAlign: 'center'
            }}
          >
            <h3 style={{ color: 'var(--crayon-red)', fontSize: '1.8rem', marginTop: 0 }}>
              ⚠️ 系統提示
            </h3>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{systemAlert}</p>
            <div style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="doodle-button"
                onClick={() => setSystemAlert(null)}
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
