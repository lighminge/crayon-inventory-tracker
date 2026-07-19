import { useState, useEffect, useMemo } from 'react';
import { getPersonnel, addPersonnel, updatePersonnel, deletePersonnel } from '../services/api';
import type { Personnel } from '../types';

const ROLES_LIST = ['備料', '收料', '盤點', '行政', '生管', '採購', '主管'];

const MaleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-5deg)' }}>
    <circle cx="10" cy="14" r="5" strokeDasharray="15 2" />
    <path d="M13.5 10.5L20 4M15 4h5v5" />
  </svg>
);

const FemaleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(5deg)' }}>
    <circle cx="12" cy="9" r="5" strokeDasharray="15 2" />
    <path d="M12 14v8M9 18h6" />
  </svg>
);

const OtherIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="11" r="4" strokeDasharray="12 2" />
    <path d="M13 8l5-5M14 3h4v4" />
    <path d="M10 15v5M8 18h4" />
  </svg>
);

export default function PersonnelPage() {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  // Filter State
  const [filterRole, setFilterRole] = useState('');

  const [formData, setFormData] = useState<Omit<Personnel, 'id'>>({
    name: '',
    gender: 'Male',
    title: '',
    notes: '',
    roles: ['盤點']
  });

  useEffect(() => {
    loadPersonnel();
  }, []);

  const loadPersonnel = async () => {
    try {
      const data = await getPersonnel();
      setPersonnelList(data);
    } catch (error: any) {
      console.error('讀取失敗：', error);
      alert('讀取資料失敗，請確認 Firebase 資料庫權限設定是否為公開 (Test Mode)');
    }
  };

  const handleOpenForm = (person?: Personnel) => {
    if (person) {
      setEditingPerson(person);
      setFormData({
        name: person.name,
        gender: person.gender,
        title: person.title,
        notes: person.notes,
        roles: person.roles || ['盤點']
      });
    } else {
      setEditingPerson(null);
      setFormData({ name: '', gender: 'Male', title: '', notes: '', roles: ['盤點'] });
    }
    setIsFormOpen(true);
  };

  const handleRoleToggle = (role: string) => {
    const currentRoles = formData.roles || [];
    if (currentRoles.includes(role)) {
      setFormData({ ...formData, roles: currentRoles.filter(r => r !== role) });
    } else {
      setFormData({ ...formData, roles: [...currentRoles, role] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPerson) {
        await updatePersonnel(editingPerson.id, formData);
      } else {
        await addPersonnel(formData);
      }
      setIsFormOpen(false);
      loadPersonnel();
    } catch (error: any) {
      alert('儲存失敗！可能是 Firebase 權限問題。詳細錯誤：' + error.message);
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除這筆人員資料嗎？')) {
      await deletePersonnel(id);
      loadPersonnel();
    }
  };

  // Filter & Pagination Logic
  const filteredPersonnel = useMemo(() => {
    if (!filterRole) return personnelList;
    return personnelList.filter(p => (p.roles || []).includes(filterRole));
  }, [personnelList, filterRole]);

  const totalPages = Math.ceil(filteredPersonnel.length / itemsPerPage);
  const currentPersonnel = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPersonnel.slice(start, start + itemsPerPage);
  }, [filteredPersonnel, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, filterRole]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>👥 人員管理</h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontWeight: 'bold' }}>工作職責：</label>
            <select className="doodle-input" style={{ width: 'auto' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">-- 全部職責 --</option>
              {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>每頁筆數：</label>
            <select className="doodle-input" style={{ width: 'auto' }} value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>
          <button className="doodle-button success" onClick={() => handleOpenForm()}>＋ 新增人員</button>
        </div>
      </div>

      <div style={{ marginBottom: '15px', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>👉 系統中目前共有 {filteredPersonnel.length} 位符合條件的人員</span>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="doodle-button" style={{ padding: '5px 10px', fontSize: '0.9rem' }} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一頁</button>
            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--crayon-dark)' }}>{currentPage} / {totalPages}</div>
            <button className="doodle-button" style={{ padding: '5px 10px', fontSize: '0.9rem' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一頁</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {currentPersonnel.map((person, index) => {
          const seqNum = (currentPage - 1) * itemsPerPage + index + 1;
          
          return (
            <div key={person.id} className="doodle-border" style={{ padding: '20px', backgroundColor: 'var(--crayon-paper)', position: 'relative' }}>
              <span style={{ 
                position: 'absolute', top: '10px', right: '10px',
                backgroundColor: 'var(--crayon-dark)', color: 'white', 
                padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold' 
              }}>
                #{seqNum}
              </span>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '2px solid var(--crayon-dark)', paddingBottom: '5px', display: 'flex', alignItems: 'center', fontSize: '2rem', fontWeight: '900', color: 'var(--crayon-dark)' }}>
                {person.name} 
                <span style={{ 
                  fontSize: '1.2rem', 
                  marginLeft: '10px',
                  backgroundColor: person.gender === 'Male' ? '#e3f2fd' : person.gender === 'Female' ? '#fce4ec' : '#f5f5f5',
                  border: `2px dashed ${person.gender === 'Male' ? 'var(--crayon-blue)' : person.gender === 'Female' ? 'var(--crayon-red)' : 'var(--crayon-dark)'}`,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  justifyContent: 'center',
                  color: 'var(--crayon-dark)'
                }}>
                  {person.gender === 'Male' ? <><MaleIcon /> 男</> : person.gender === 'Female' ? <><FemaleIcon /> 女</> : <><OtherIcon /> 其他</>}
                </span>
              </h3>
              <p style={{ margin: '5px 0' }}><strong>職稱：</strong>{person.title}</p>
              
              <div style={{ margin: '10px 0', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                <strong>職責：</strong>
                {(person.roles || []).map(r => (
                  <span key={r} style={{ 
                    backgroundColor: 'var(--crayon-yellow)', 
                    padding: '2px 8px', 
                    borderRadius: '10px', 
                    fontSize: '0.85rem',
                    border: '1px dashed var(--crayon-dark)'
                  }}>{r}</span>
                ))}
                {(!person.roles || person.roles.length === 0) && <span style={{ color: '#888' }}>未設定</span>}
              </div>

              <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#555' }}>備註：{person.notes || '無'}</p>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button className="doodle-button success" style={{ flex: 1 }} onClick={() => handleOpenForm(person)}>編輯</button>
                <button className="doodle-button danger" style={{ flex: 1 }} onClick={() => handleDelete(person.id)}>刪除</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '30px' }}>
          <button className="doodle-button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一頁</button>
          <div style={{ padding: '8px 15px', fontWeight: 'bold' }}>{currentPage} / {totalPages}</div>
          <button className="doodle-button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一頁</button>
        </div>
      )}

      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'white', position: 'relative' }}>
            <button 
              onClick={() => setIsFormOpen(false)}
              style={{ 
                position: 'absolute', top: '15px', right: '15px', 
                background: 'var(--crayon-paper)', border: '2px solid var(--crayon-dark)', 
                fontSize: '1.2rem', cursor: 'pointer', color: 'var(--crayon-red)', 
                fontWeight: 'bold', width: '35px', height: '35px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
              }}
            >
              ❌
            </button>
            <h3 style={{ marginTop: 0 }}>{editingPerson ? '編輯人員資料' : '新增人員資料'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div>
                <label>姓名：</label>
                <input className="doodle-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label>性別：</label>
                <select className="doodle-input" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}>
                  <option value="Male">男</option>
                  <option value="Female">女</option>
                  <option value="Other">其他</option>
                </select>
              </div>
              <div>
                <label>職稱：</label>
                <input className="doodle-input" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div>
                <label>工作職責 (可複選)：</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', padding: '10px', border: '2px dashed var(--crayon-dark)', borderRadius: '10px' }}>
                  {ROLES_LIST.map(role => (
                    <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={(formData.roles || []).includes(role)}
                        onChange={() => handleRoleToggle(role)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--crayon-blue)' }}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label>備註：</label>
                <textarea className="doodle-input" style={{ minHeight: '80px' }} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="doodle-button success" style={{ flex: 1 }}>儲存</button>
                <button type="button" className="doodle-button danger" style={{ flex: 1 }} onClick={() => setIsFormOpen(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
