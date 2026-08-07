import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSystemUsers, addSystemUser } from '../services/api';
import type { SystemUser } from '../types';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const users = await getSystemUsers();
      
      // Seed default admin if no users exist
      if (users.length === 0) {
        const defaultAdmin: Omit<SystemUser, 'id'> = {
          username: 'admin',
          password: 'admin',
          name: '系統管理員',
          permissions: {
            dashboard: 'edit',
            dispatch: 'edit',
            tickets: 'edit',
            workflowTickets: 'edit',
            tasks: 'edit',
            workflow: 'edit',
            itemDetails: 'edit',
            personnel: 'edit',
            statistics: 'edit',
            system: 'edit',
            calendar: 'edit'
          }
        };
        const newUser = await addSystemUser(defaultAdmin);
        users.push(newUser);
      }

      const user = users.find(u => u.username === username && u.password === password);
      
      if (user) {
        login(user);
        navigate('/');
      } else {
        setError('帳號或密碼錯誤');
      }
    } catch (err) {
      console.error(err);
      setError('登入系統發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <form onSubmit={handleLogin} className="doodle-border" style={{ padding: '40px', maxWidth: '400px', margin: '0 auto', backgroundColor: 'white' }}>
        <h2 style={{ color: 'var(--crayon-dark)', marginTop: 0 }}>🔐 系統登入</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>歡迎回來，請輸入管理員帳號密碼</p>
        
        {error && (
          <div style={{ backgroundColor: '#ffebee', color: 'var(--crayon-red)', padding: '10px', borderRadius: '5px', marginBottom: '20px', fontWeight: 'bold' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            className="doodle-input" 
            type="text" 
            placeholder="帳號 (預設為 admin)" 
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input 
            className="doodle-input" 
            type="password" 
            placeholder="密碼 (預設為 admin)" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button 
            type="submit"
            className="doodle-button" 
            style={{ width: '100%', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? '登入中...' : '🚀 登入'}
          </button>
        </div>
      </form>
    </div>
  );
}
