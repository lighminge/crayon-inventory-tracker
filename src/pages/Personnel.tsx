import { useState, useEffect } from 'react';
import type { Personnel } from '../types';
import { getPersonnel, addPersonnel, updatePersonnel, deletePersonnel } from '../services/api';

export default function PersonnelPage() {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null);
  const [formData, setFormData] = useState<Omit<Personnel, 'id'>>({
    name: '', gender: 'Male', title: '', notes: ''
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
      setFormData({ name: person.name, gender: person.gender, title: person.title, notes: person.notes });
    } else {
      setEditingPerson(null);
      setFormData({ name: '', gender: 'Male', title: '', notes: '' });
    }
    setIsFormOpen(true);
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
    if (confirm('確定要刪除這位人員嗎？')) {
      await deletePersonnel(id);
      loadPersonnel();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>👥 人員管理</h2>
        <button className="doodle-button" onClick={() => handleOpenForm()}>＋ 新增人員</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {personnelList.map(p => (
          <div key={p.id} className="doodle-border" style={{ padding: '15px' }}>
            <h3 style={{ borderBottom: '2px solid var(--crayon-dark)', paddingBottom: '5px' }}>{p.name}</h3>
            <p><strong>性別：</strong> {p.gender === 'Male' ? '男' : p.gender === 'Female' ? '女' : '其他'}</p>
            <p><strong>職稱：</strong> {p.title}</p>
            <p><strong>備註：</strong> {p.notes || '無'}</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button className="doodle-button" style={{ flex: 1, fontSize: '1rem', padding: '4px' }} onClick={() => handleOpenForm(p)}>編輯</button>
              <button className="doodle-button danger" style={{ flex: 1, fontSize: '1rem', padding: '4px' }} onClick={() => handleDelete(p.id)}>刪除</button>
            </div>
          </div>
        ))}
        {personnelList.length === 0 && <p>目前沒有任何人員資料。</p>}
      </div>

      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px' }}>
            <h3>{editingPerson ? '編輯人員' : '新增人員'}</h3>
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
                <label>備註：</label>
                <textarea className="doodle-input" rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
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
