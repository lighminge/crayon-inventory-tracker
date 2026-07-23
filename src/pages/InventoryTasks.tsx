import { useState, useEffect, useMemo } from 'react';
import type { InventoryTask, InventoryTicket } from '../types';
import { getTasks, addTask, updateTask, deleteTask, getTickets } from '../services/api';

const formatDateLocal = (timestamp: number) => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function InventoryTasks() {
  const [tasks, setTasks] = useState<InventoryTask[]>([]);
  const [tickets, setTickets] = useState<InventoryTicket[]>([]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<InventoryTask | null>(null);
  
  const [filterStatus, setFilterStatus] = useState('all');
  
  const today = formatDateLocal(new Date().getTime());
  const [formData, setFormData] = useState<Omit<InventoryTask, 'id'>>({
    name: '',
    startDate: new Date(today).getTime(),
    endDate: new Date(today).getTime(),
    ticketType: '夾鉗',
    totalItemCount: 100
  });

  const [startDateStr, setStartDateStr] = useState(today);
  const [endDateStr, setEndDateStr] = useState(today);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, tkData] = await Promise.all([getTasks(), getTickets()]);
      setTasks(tData);
      setTickets(tkData);
    } catch (e) {
      console.error(e);
      alert('讀取資料失敗');
    }
  };

  const handleOpenForm = (task?: InventoryTask) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        name: task.name,
        startDate: task.startDate,
        endDate: task.endDate,
        ticketType: task.ticketType,
        totalItemCount: task.totalItemCount
      });
      setStartDateStr(formatDateLocal(task.startDate));
      setEndDateStr(formatDateLocal(task.endDate));
    } else {
      setEditingTask(null);
      setFormData({
        name: '',
        startDate: new Date(today).getTime(),
        endDate: new Date(today).getTime(),
        ticketType: '夾鉗',
        totalItemCount: 100
      });
      setStartDateStr(today);
      setEndDateStr(today);
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.totalItemCount <= 0) {
      return alert('總項目數量必須大於 0');
    }
    const finalData = {
      ...formData,
      startDate: new Date(startDateStr + 'T00:00:00').getTime(),
      endDate: new Date(endDateStr + 'T23:59:59').getTime()
    };
    
    if (finalData.startDate > finalData.endDate) {
      return alert('開始日期不可大於結束日期');
    }

    try {
      if (editingTask) {
        await updateTask(editingTask.id, finalData);
      } else {
        await addTask(finalData);
      }
      setIsFormOpen(false);
      loadData();
    } catch (error: any) {
      alert('儲存失敗：' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除這筆盤點任務嗎？（此動作不會刪除關聯的盤點單，但可能影響統計）')) {
      await deleteTask(id);
      loadData();
    }
  };

  // Calculate stats for each task
  const tasksWithStats = useMemo(() => {
    return tasks.map(task => {
      // Find all completed tickets linked to this task
      const linkedTickets = tickets.filter(t => t.taskId === task.id && t.closeDate);
      
      // Sum their item counts
      const completedItems = linkedTickets.reduce((sum, t) => sum + (t.itemCount || 0), 0);
      
      const completionRate = task.totalItemCount > 0 
        ? Math.min(100, Math.round((completedItems / task.totalItemCount) * 100))
        : 0;

      const isExpired = new Date().getTime() > task.endDate;

      return {
        ...task,
        completedItems,
        completionRate,
        isExpired
      };
    });
  }, [tasks, tickets]);

  const filteredTasks = useMemo(() => {
    return tasksWithStats.filter(t => {
      if (filterStatus === 'active') return !t.isExpired;
      if (filterStatus === 'expired') return t.isExpired;
      return true;
    });
  }, [tasksWithStats, filterStatus]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>🎯 盤點任務管理</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>任務狀態：</label>
            <select className="doodle-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">全部</option>
              <option value="active">未到期</option>
              <option value="expired">已到期</option>
            </select>
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--crayon-blue)' }}>
            總任務數量：{filteredTasks.length} 筆
          </div>
        </div>
        <button className="doodle-button" onClick={() => handleOpenForm()}>＋ 新增盤點任務</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {filteredTasks.map((task) => (
          <div key={task.id} className="doodle-border" style={{ 
            padding: '20px', 
            backgroundColor: task.isExpired ? '#f5f5f5' : 'white',
            position: 'relative'
          }}>
            {task.isExpired && (
              <div style={{ 
                position: 'absolute', top: '-10px', right: '-10px',
                backgroundColor: '#9e9e9e', color: 'white', padding: '5px 10px',
                borderRadius: '5px', transform: 'rotate(10deg)', fontSize: '0.9rem',
                fontWeight: 'bold', border: '2px dashed var(--crayon-dark)'
              }}>已截止</div>
            )}
            
            <h3 style={{ margin: '0 0 10px 0', borderBottom: '2px solid var(--crayon-dark)', paddingBottom: '5px' }}>
              📝 {task.name}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div style={{ fontSize: '1.2rem' }}><strong>類型：</strong><span style={{ fontWeight: '900', fontSize: '1.4rem' }}>{task.ticketType}</span></div>
              <div style={{ fontSize: '1.2rem' }}>
                <strong>總項目：</strong><span style={{ fontWeight: '900', fontSize: '1.4rem' }}>{task.totalItemCount} 項</span>
              </div>
            </div>

            <div style={{ fontSize: '1.2rem', color: '#333', marginBottom: '15px' }}>
              <strong>期間：</strong><br/>
              <span style={{ fontWeight: '900', fontSize: '1.3rem' }}>{new Date(task.startDate).toLocaleDateString()} ~ {new Date(task.endDate).toLocaleDateString()}</span>
            </div>

            <div className="doodle-border" style={{ padding: '10px', backgroundColor: '#e3f2fd', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>任務進度</span>
                <span style={{ fontWeight: 'bold', color: task.completionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-blue)' }}>
                  {task.completionRate}%
                </span>
              </div>
              <div style={{ width: '100%', height: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid var(--crayon-dark)', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${task.completionRate}%`, 
                  height: '100%', 
                  backgroundColor: task.completionRate === 100 ? 'var(--crayon-green)' : 'var(--crayon-blue)' 
                }}></div>
              </div>
              <div style={{ fontSize: '0.8rem', textAlign: 'right', marginTop: '5px', color: '#555' }}>
                已完成：{task.completedItems} / {task.totalItemCount} 項
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="doodle-button success" style={{ flex: 1 }} onClick={() => handleOpenForm(task)}>編輯</button>
              <button className="doodle-button danger" style={{ flex: 1 }} onClick={() => handleDelete(task.id)}>刪除</button>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <p style={{ color: '#888', gridColumn: '1 / -1' }}>目前尚未建立任何盤點任務。</p>
        )}
      </div>

      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="doodle-border" style={{ padding: '30px', width: '100%', maxWidth: '500px', backgroundColor: 'white' }}>
            <h3 style={{ marginTop: 0 }}>{editingTask ? '編輯任務' : '新增盤點任務'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              
              <div>
                <label style={{ fontWeight: 'bold' }}>任務名稱：</label>
                <input className="doodle-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontWeight: 'bold' }}>開始日期：</label>
                  <input type="date" className="doodle-input" required value={startDateStr} onChange={e => setStartDateStr(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold' }}>結束日期：</label>
                  <input type="date" className="doodle-input" required value={endDateStr} onChange={e => setEndDateStr(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontWeight: 'bold' }}>盤點類型：</label>
                  <select className="doodle-input" value={formData.ticketType} onChange={e => setFormData({...formData, ticketType: e.target.value as any})}>
                    <option value="夾鉗">夾鉗</option>
                    <option value="TKW">TKW</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 'bold' }}>需盤點總項目數：</label>
                  <input type="number" min="1" className="doodle-input" required value={formData.totalItemCount} onChange={e => setFormData({...formData, totalItemCount: Number(e.target.value)})} />
                </div>
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
