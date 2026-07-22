import { useState, useEffect } from 'react';
import type { Workflow, Personnel } from '../types';
import { getWorkflows, addWorkflow, updateWorkflow, deleteWorkflow, getPersonnel } from '../services/api';

export default function WorkflowManagement() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [insertAfterId, setInsertAfterId] = useState<string>('');
  const [formData, setFormData] = useState<Omit<Workflow, 'id'>>({
    name: '',
    order: 0,
    assigneeId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [wData, pData] = await Promise.all([getWorkflows(), getPersonnel()]);
      setWorkflows(wData.sort((a, b) => a.order - b.order));
      setPersonnel(pData);
    } catch (e) {
      console.error(e);
      alert('讀取資料失敗');
    }
  };

  const handleOpenForm = (workflow?: Workflow) => {
    if (workflow) {
      setEditingWorkflow(workflow);
      setFormData({ name: workflow.name, order: workflow.order, assigneeId: workflow.assigneeId || '' });
    } else {
      setEditingWorkflow(null);
      const defaultInsertId = workflows.length > 1 ? workflows[workflows.length - 2].id : (workflows.length > 0 ? workflows[0].id : '');
      setInsertAfterId(defaultInsertId);
      setFormData({ name: '', order: 0, assigneeId: '' });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWorkflow) {
        await updateWorkflow(editingWorkflow.id, formData);
      } else {
        const insertIndex = workflows.findIndex(w => w.id === insertAfterId);
        const created = await addWorkflow(formData);
        
        const newWorkflows = [...workflows];
        newWorkflows.splice(insertIndex + 1, 0, created);
        
        const promises = newWorkflows.map((w, idx) => updateWorkflow(w.id, { order: idx + 1 }));
        await Promise.all(promises);
      }
      setIsFormOpen(false);
      loadData();
    } catch (error: any) {
      alert('儲存失敗：' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除這個流程嗎？')) {
      await deleteWorkflow(id);
      loadData();
    }
  };

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    // Locked items cannot move
    if (index === 0 || index === workflows.length - 1) return;

    if (direction === 'up' && index > 1) {
      const current = workflows[index];
      const prev = workflows[index - 1];
      await Promise.all([
        updateWorkflow(current.id, { order: prev.order }),
        updateWorkflow(prev.id, { order: current.order })
      ]);
      loadData();
    } else if (direction === 'down' && index < workflows.length - 2) {
      const current = workflows[index];
      const next = workflows[index + 1];
      await Promise.all([
        updateWorkflow(current.id, { order: next.order }),
        updateWorkflow(next.id, { order: current.order })
      ]);
      loadData();
    }
  };

  const getPersonnelName = (id?: string) => {
    if (!id) return '未指定';
    const p = personnel.find(x => x.id === id);
    return p ? p.name : '未知';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>⚙️ 流程管理</h2>
        <button className="doodle-button" onClick={() => handleOpenForm()}>＋ 新增流程</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {workflows.map((w, index) => {
          const isFirst = index === 0;
          const isLast = index === workflows.length - 1;
          const isLocked = isFirst || isLast;
          
          return (
            <div key={w.id} className="doodle-border" style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ 
                  backgroundColor: 'var(--crayon-yellow)', 
                  width: '40px', height: '40px', 
                  borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '1.2rem',
                  border: '2px solid var(--crayon-dark)'
                }}>
                  {index + 1}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>
                    {w.name} 
                    {isFirst && <span style={{ fontSize: '0.8rem', color: '#d32f2f', border: '1px solid #d32f2f', borderRadius: '5px', padding: '2px 5px', marginLeft: '10px' }}>🔒 系統鎖定 (起點)</span>}
                    {isLast && <span style={{ fontSize: '0.8rem', color: '#d32f2f', border: '1px solid #d32f2f', borderRadius: '5px', padding: '2px 5px', marginLeft: '10px' }}>🔒 系統鎖定 (終點)</span>}
                  </h3>
                  <p style={{ margin: '5px 0 0 0', color: '#555' }}>預設負責人：{getPersonnelName(w.assigneeId)}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="doodle-button" onClick={() => moveOrder(index, 'up')} disabled={index <= 1 || isLast}>↑</button>
                <button className="doodle-button" onClick={() => moveOrder(index, 'down')} disabled={isFirst || index >= workflows.length - 2}>↓</button>
                <button className="doodle-button success" onClick={() => handleOpenForm(w)}>編輯</button>
                {!isLocked && (
                  <button className="doodle-button danger" onClick={() => handleDelete(w.id)}>刪除</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '400px' }}>
            <h3>{editingWorkflow ? '編輯流程' : '新增流程'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div>
                <label>流程名稱：</label>
                <input className="doodle-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              {!editingWorkflow && workflows.length > 0 && (
                <div>
                  <label>插入位置：</label>
                  <select className="doodle-input" value={insertAfterId} onChange={e => setInsertAfterId(e.target.value)}>
                    {workflows.slice(0, workflows.length - 1).map(w => (
                      <option key={w.id} value={w.id}>插入在「{w.name}」之後</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label>預設負責人員：</label>
                <select className="doodle-input" value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}>
                  <option value="">-- 不指定 --</option>
                  {personnel.map(p => <option key={p.id} value={p.id}>{p.name} ({p.title})</option>)}
                </select>
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
