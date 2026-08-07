import React, { useState, useEffect } from 'react';
import { getSystemUsers, addSystemUser, updateSystemUser, deleteSystemUser } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { SystemUser, ModulePermissions, PermissionLevel } from '../types';

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
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<SystemUser>>({});
  
  // We check if current user can edit system
  const canEdit = hasPermission('system', 'edit');

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
    if (currentUser?.id === id || currentUser?.username === username) {
      return alert('無法刪除目前登入的帳號！');
    }
    if (confirm(`確定要刪除帳號 [${username}] 嗎？`)) {
      try {
        await deleteSystemUser(id);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>⚙️ 系統管理 (權限與帳號)</h2>
        {canEdit && !isEditing && (
          <button className="doodle-button success" onClick={handleAddNew}>
            ＋ 新增管理員帳號
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
                <th style={{ padding: '15px' }}>帳號</th>
                <th style={{ padding: '15px' }}>名稱</th>
                <th style={{ padding: '15px' }}>完整權限模組數</th>
                <th style={{ padding: '15px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const editCount = Object.values(u.permissions).filter(p => p === 'edit').length;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px dashed #ccc' }}>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>{u.username}</td>
                    <td style={{ padding: '15px' }}>{u.name}</td>
                    <td style={{ padding: '15px' }}>{editCount} 個功能</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button className="doodle-button" style={{ padding: '5px 10px' }} onClick={() => handleEdit(u)}>編輯</button>
                          <button className="doodle-button danger" style={{ padding: '5px 10px' }} onClick={() => handleDelete(u.id, u.username)}>刪除</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>尚無任何帳號資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
