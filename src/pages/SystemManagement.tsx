import React, { useState, useEffect, useMemo } from 'react';
import { getSystemUsers, addSystemUser, updateSystemUser, deleteSystemUser, getPersonnel, getLoginRecords } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { SystemUser, ModulePermissions, PermissionLevel, Personnel, SystemLoginRecord } from '../types';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';


const defaultPermissions: ModulePermissions = {
  dashboard: 'view',
  dispatch: 'none',
  tickets: 'none',
  workflowTickets: 'none',
  tasks: 'none',
  workflow: 'none',
  itemDetails: 'none',
  personnel: 'none',
  statistics: 'none',
  system: 'none',
  calendar: 'view'
};

const moduleNames: Record<keyof ModulePermissions, string> = {
  dashboard: '儀表板',
  dispatch: '盤點單派送',
  tickets: '盤點單管理',
  workflowTickets: '盤點單流程',
  tasks: '盤點任務',
  workflow: '流程管理',
  itemDetails: '盤點項目明細',
  personnel: '人員管理',
  statistics: '統計作業',
  system: '系統管理',
  calendar: '行事曆'
};

export default function SystemManagement() {
  const { hasPermission, currentUser } = useAuth();
  const canEdit = hasPermission('system', 'edit');
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<SystemUser>>({});
  const [userToDelete, setUserToDelete] = useState<{ id: string, username: string } | null>(null);
  
  // We check if current user can edit system
  
  // Tabs: 'accounts' | 'logins'
  const [activeTab, setActiveTab] = useState<'accounts' | 'logins'>('accounts');
  
  // Personnel for linkage
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  
  // Login Records
  const [loginRecords, setLoginRecords] = useState<SystemLoginRecord[]>([]);
  const [loginPage, setLoginPage] = useState(1);
  const [loginPerPage, setLoginPerPage] = useState(10);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  // Login Records Filters & Sort
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  
  useEffect(() => {
    loadPersonnel();
    if (activeTab === 'logins') {
      loadLoginRecords();
    }
  }, [activeTab]);

  const loadPersonnel = async () => {
    try {
      const p = await getPersonnel();
      setPersonnelList(p);
    } catch (e) {
      console.error('Failed to load personnel', e);
    }
  };

  const loadLoginRecords = async () => {
    try {
      const records = await getLoginRecords();
      setLoginRecords(records);
    } catch (e) {
      console.error('Failed to load login records', e);
    }
  };

  // Login Records Derived Data
  
  const filteredLogins = useMemo(() => {
    let result = [...loginRecords];
    if (filterStartDate) {
      const start = new Date(filterStartDate).setHours(0, 0, 0, 0);
      result = result.filter(r => new Date(r.loginTime).getTime() >= start);
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate).setHours(23, 59, 59, 999);
      result = result.filter(r => new Date(r.loginTime).getTime() <= end);
    }
    if (filterUsername) {
      result = result.filter(r => r.username === filterUsername);
    }
    
    result.sort((a, b) => {
      if (sortOrder === 'desc') return b.loginTime - a.loginTime;
      return a.loginTime - b.loginTime;
    });
    
    return result;
  }, [loginRecords, filterStartDate, filterEndDate, filterUsername, sortOrder]);

  const paginatedLogins = useMemo(() => {
    const start = (loginPage - 1) * loginPerPage;
    return filteredLogins.slice(start, start + loginPerPage);
  }, [filteredLogins, loginPage, loginPerPage]);

  const loginChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    const today = new Date();
    // Initialize last 14 days to 0
    for(let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      counts[d.toLocaleDateString('zh-TW')] = 0;
    }
    
    filteredLogins.forEach(r => {
      const dStr = new Date(r.loginTime).toLocaleDateString('zh-TW');
      if (counts[dStr] !== undefined) {
        counts[dStr]++;
      }
    });
    
    return Object.keys(counts).map(date => ({
      date,
      count: counts[date]
    }));
  }, [filteredLogins]);


  
  const handleExportImage = async () => {
    const el = document.getElementById('login-chart-container');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff' });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `系統登入記錄圖表_${new Date().getTime()}.png`;
      a.click();
    } catch (e) {
      console.error(e);
      alert('匯出圖檔失敗');
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredLogins.map((r, i) => ({
      '序號': i + 1,
      '帳號': r.username,
      'IP': r.ip || '未知',
      '登入時間': new Date(r.loginTime).toLocaleString('zh-TW'),
      '登出時間': r.logoutTime ? new Date(r.logoutTime).toLocaleString('zh-TW') : '未登出/異常'
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "登入記錄");
    
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    XLSX.writeFile(wb, `系統登入記錄_${dateStr}.xlsx`);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const u = await getSystemUsers();
      setUsers(u);
    } catch (err) {
      console.error(err);
      alert('載入系統帳號失敗');
    }
  };

  const handleAddNew = () => {
    setEditingUser({
      username: '',
      password: '',
      name: '',
      permissions: { ...defaultPermissions }
    });
    setIsEditing(true);
  };

  const handleEdit = (user: SystemUser) => {
    setEditingUser(user);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser.username || !editingUser.name || !editingUser.permissions) {
      return alert('請填寫必填欄位');
    }
    
    try {
      if (editingUser.id) {
        // Edit
        await updateSystemUser(editingUser.id, editingUser);
      } else {
        // Add
        if (!editingUser.password) return alert('新帳號必須輸入密碼');
        const exists = users.find(u => u.username === editingUser.username);
        if (exists) return alert('此帳號已被使用');
        
        await addSystemUser(editingUser as Omit<SystemUser, 'id'>);
      }
      setIsEditing(false);
      loadUsers();
    } catch (err) {
      console.error(err);
      alert('儲存失敗');
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (username === 'admin') {
      return alert('無法刪除預設 admin 帳號！');
    }
    if (currentUser?.id === id || currentUser?.username === username) {
      return alert('無法刪除目前登入的帳號！');
    }
    setUserToDelete({ id, username });
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        await deleteSystemUser(userToDelete.id);
        setUserToDelete(null);
        loadUsers();
      } catch (err) {
        console.error(err);
        alert('刪除失敗');
      }
    }
  };

  const updatePermission = (module: keyof ModulePermissions, level: PermissionLevel) => {
    setEditingUser(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions!,
        [module]: level
      }
    }));
  };

  return (

    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--crayon-dark)' }}>
        <button 
          onClick={() => setActiveTab('accounts')}
          style={{
            padding: '10px 20px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'accounts' ? 'var(--crayon-dark)' : '#f0f0f0',
            color: activeTab === 'accounts' ? 'white' : '#666',
            border: '2px solid var(--crayon-dark)',
            borderBottom: 'none',
            borderRadius: '10px 10px 0 0',
            cursor: 'pointer'
          }}
        >
          帳號管理
        </button>
        <button 
          onClick={() => setActiveTab('logins')}
          style={{
            padding: '10px 20px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'logins' ? 'var(--crayon-dark)' : '#f0f0f0',
            color: activeTab === 'logins' ? 'white' : '#666',
            border: '2px solid var(--crayon-dark)',
            borderBottom: 'none',
            borderRadius: '10px 10px 0 0',
            cursor: 'pointer'
          }}
        >
          系統登入記錄
        </button>
      </div>

      {activeTab === 'accounts' && (
        <>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>⚙️ 系統管理 (權限與帳號) <span style={{ fontSize: '1.2rem', color: '#666' }}>共 {users.length} 筆</span></h2>
        {canEdit && !isEditing && (
          <button className="doodle-button success" onClick={handleAddNew}>
            ＋ 新增帳號
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="doodle-border" style={{ padding: '20px', backgroundColor: '#f9f9f9' }}>
          <h3 style={{ marginTop: 0 }}>{editingUser.id ? '編輯帳號' : '新增帳號'}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>登入帳號：</label>
              <input 
                className="doodle-input" 
                style={{ width: '100%' }}
                required 
                disabled={!!editingUser.id}
                value={editingUser.username || ''} 
                onChange={e => setEditingUser({...editingUser, username: e.target.value})} 
                placeholder="例如: admin2" 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>顯示名稱：</label>
              <input 
                className="doodle-input" 
                style={{ width: '100%' }}
                required 
                value={editingUser.name || ''} 
                onChange={e => setEditingUser({...editingUser, name: e.target.value})} 
                placeholder="例如: 廠長" 
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>對應人員連結：</label>
              <select
                className="doodle-input"
                style={{ width: '100%' }}
                value={editingUser.personnelId || ''}
                onChange={e => setEditingUser(prev => ({ ...prev, personnelId: e.target.value }))}
              >
                <option value="">-- 無對應 --</option>
                {personnelList.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.title})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>登入密碼：</label>
              <input 
                className="doodle-input" 
                style={{ width: '100%' }}
                required={!editingUser.id}
                type="text"
                value={editingUser.password || ''} 
                onChange={e => setEditingUser({...editingUser, password: e.target.value})} 
                placeholder={editingUser.id ? "留白代表不修改密碼" : "設定登入密碼"} 
              />
            </div>
          </div>

          <h4 style={{ borderBottom: '2px dashed var(--crayon-dark)', paddingBottom: '10px' }}>🔐 功能權限設定</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {(Object.keys(moduleNames) as (keyof ModulePermissions)[]).map(mod => (
              <div key={mod} className="doodle-border" style={{ padding: '10px', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{moduleNames[mod]}</span>
                <select 
                  className="doodle-input"
                  style={{ width: 'auto', padding: '2px 5px', backgroundColor: '#e3f2fd' }}
                  value={editingUser.permissions?.[mod] || 'none'}
                  onChange={e => updatePermission(mod, e.target.value as PermissionLevel)}
                >
                  <option value="none">無權限 (不可見)</option>
                  <option value="view">僅檢視 (唯讀)</option>
                  <option value="edit">完整權限 (新增/修改/刪除)</option>
                </select>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="doodle-button" onClick={() => setIsEditing(false)}>取消</button>
            <button type="submit" className="doodle-button success">💾 儲存帳號設定</button>
          </div>
        </form>
      ) : (
        <div className="doodle-border" style={{ overflowX: 'auto', backgroundColor: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--crayon-dark)', color: 'white' }}>
                <th style={{ padding: '15px', width: '60px', textAlign: 'center' }}>序號</th>
                <th style={{ padding: '15px' }}>帳號</th>
                <th style={{ padding: '15px' }}>名稱</th>
                <th style={{ padding: '15px' }}>人員連結</th>
                <th style={{ padding: '15px' }}>完整權限模組數</th>
                <th style={{ padding: '15px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, index) => {
                const editCount = Object.values(u.permissions).filter(p => p === 'edit').length;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px dashed #ccc' }}>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{index + 1}</td>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>{u.username}</td>
                    <td style={{ padding: '15px' }}>{u.name}</td>
                    <td style={{ padding: '15px' }}>{u.personnelId ? personnelList.find(p => p.id === u.personnelId)?.name || '未知人員' : '-'}</td>
                    <td style={{ padding: '15px' }}>{editCount} 個功能</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button className="doodle-button" style={{ padding: '5px 10px' }} onClick={() => handleEdit(u)}>編輯</button>
                          <button 
                            className="doodle-button danger" 
                            style={{ 
                              padding: '5px 10px', 
                              opacity: u.username === 'admin' ? 0.5 : 1, 
                              cursor: u.username === 'admin' ? 'not-allowed' : 'pointer' 
                            }} 
                            disabled={u.username === 'admin'}
                            onClick={() => handleDelete(u.id, u.username)}
                          >
                            刪除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>尚無任何帳號資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      </>
      )}

      
      {activeTab === 'logins' && (
        <div className="doodle-border" style={{ padding: '20px', backgroundColor: 'white' }}>
          
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '15px', border: '2px dashed var(--crayon-dark)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <strong>日期區段：</strong>
              <input type="date" className="doodle-input" style={{ padding: '4px 8px', height: '34px', fontSize: '1rem' }} value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
              <span>~</span>
              <input type="date" className="doodle-input" style={{ padding: '4px 8px', height: '34px', fontSize: '1rem' }} value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <strong>登入人員：</strong>
              <select className="doodle-input" style={{ padding: '4px 8px', height: '34px', fontSize: '1rem' }} value={filterUsername} onChange={e => setFilterUsername(e.target.value)}>
                <option value="">全部</option>
                {Array.from(new Set(loginRecords.map(r => r.username))).map(u => (
                   <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <strong>排序方式：</strong>
              <select className="doodle-input" style={{ padding: '4px 8px', height: '34px', fontSize: '1rem' }} value={sortOrder} onChange={e => setSortOrder(e.target.value as 'asc'|'desc')}>
                <option value="desc">由新到舊 (大到小)</option>
                <option value="asc">由舊到新 (小到大)</option>
              </select>
            </div>
            <button className="doodle-button" style={{ padding: '4px 15px', height: '34px', fontSize: '1rem' }} onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterUsername(''); setSortOrder('desc'); }}>清除條件</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>📊 登入記錄分析 <span style={{ fontSize: '1.2rem', color: '#666' }}>總計：{filteredLogins.length} 筆</span></h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select className="doodle-input" style={{ padding: '4px 10px', height: '36px', fontSize: '1rem', borderRadius: '8px' }} value={chartType} onChange={e => setChartType(e.target.value as 'bar'|'line')}>
                <option value="bar">長條圖</option>
                <option value="line">折線圖</option>
              </select>
              <button className="doodle-button" style={{ padding: '4px 15px', height: '36px', fontSize: '1rem', borderRadius: '8px', backgroundColor: '#fff', color: 'var(--crayon-dark)', border: '2px solid var(--crayon-dark)' }} onClick={handleExportImage}>
                🖼️ 匯出圖檔
              </button>
              <button className="doodle-button success" style={{ padding: '4px 15px', height: '36px', fontSize: '1rem', borderRadius: '8px' }} onClick={handleExportExcel}>
                📥 匯出 Excel
              </button>
            </div>
          </div>

          <div id="login-chart-container" style={{ height: '300px', marginBottom: '30px', padding: '10px', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #eee' }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={loginChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--crayon-blue)" name="登入次數" />
                </BarChart>
              ) : (
                <LineChart data={loginChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="var(--crayon-purple)" strokeWidth={3} name="登入次數" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              每頁顯示：
              <select className="doodle-input" style={{ width: '80px', padding: '5px' }} value={loginPerPage} onChange={e => {setLoginPerPage(Number(e.target.value)); setLoginPage(1);}}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              筆
            </div>
            <div>
              <button className="doodle-button" style={{ padding: '5px 15px', marginRight: '10px' }} disabled={loginPage === 1} onClick={() => setLoginPage(p => p - 1)}>上一頁</button>
              <span style={{ fontWeight: 'bold' }}>第 {loginPage} 頁 / 共 {Math.ceil(filteredLogins.length / loginPerPage) || 1} 頁</span>
              <button className="doodle-button" style={{ padding: '5px 15px', marginLeft: '10px' }} disabled={loginPage >= Math.ceil(filteredLogins.length / loginPerPage)} onClick={() => setLoginPage(p => p + 1)}>下一頁</button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', border: '3px solid var(--crayon-dark)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'center' }}>序號</th>
                <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'left' }}>帳號</th>
                <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'center' }}>IP</th>
                <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'center' }}>登入時間</th>
                <th style={{ padding: '12px', borderBottom: '3px solid var(--crayon-dark)', textAlign: 'center' }}>登出時間</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogins.map((r, idx) => (
                <tr key={r.id} style={{ borderBottom: '1px dashed #ccc' }}>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#666' }}>{(loginPage - 1) * loginPerPage + idx + 1}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.username}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{r.ip || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{new Date(r.loginTime).toLocaleString('zh-TW')}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{r.logoutTime ? new Date(r.logoutTime).toLocaleString('zh-TW') : '-'}</td>
                </tr>
              ))}
              {paginatedLogins.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>暫無登入記錄</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}



      {/* 刪除確認視窗 */}
      {userToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px', backgroundColor: 'white', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--crayon-red)', fontSize: '1.8rem', marginTop: 0 }}>⚠️ 刪除確認</h3>
            <p style={{ fontSize: '1.2rem', margin: '20px 0' }}>確定要刪除帳號 <strong>[{userToDelete.username}]</strong> 嗎？</p>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '20px' }}>此動作無法復原！</p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button type="button" className="doodle-button" style={{ flex: 1 }} onClick={() => setUserToDelete(null)}>取消</button>
              <button type="button" className="doodle-button danger" style={{ flex: 1 }} onClick={confirmDelete}>確認刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
