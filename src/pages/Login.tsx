import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSystemUsers, addSystemUser, updateSystemUser } from '../services/api';
import { hashPassword, verifyPassword } from '../utils/security';
import type { SystemUser } from '../types';

const LOCKOUT_STORAGE_KEY = 'crayon_login_lockout_v1';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 秒鎖定

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(LOCKOUT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lockoutUntil && parsed.lockoutUntil > Date.now()) {
          setLockoutUntil(parsed.lockoutUntil);
          setFailedAttempts(parsed.failedAttempts || MAX_FAILED_ATTEMPTS);
        } else if (parsed.failedAttempts) {
          setFailedAttempts(parsed.failedAttempts);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (lockoutUntil <= Date.now()) {
      setRemainingSeconds(0);
      return;
    }
    const updateTimer = () => {
      const diff = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (diff <= 0) {
        setRemainingSeconds(0);
        setLockoutUntil(0);
        setFailedAttempts(0);
        sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
      } else {
        setRemainingSeconds(diff);
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 500);
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (lockoutUntil > Date.now()) {
      const sec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(`登入失敗次數過多，請等待 ${sec} 秒後再試`);
      return;
    }

    setLoading(true);

    try {
      const users = await getSystemUsers();

      // Seed default admin with hashed password if no users exist
      if (users.length === 0) {
        const hashedAdminPassword = await hashPassword('admin', 'admin');
        const defaultAdmin: Omit<SystemUser, 'id'> = {
          username: 'admin',
          password: hashedAdminPassword,
          name: '系統管理員',
          permissions: {
            dashboard: 'edit',
            dispatch: 'edit',
            tickets: 'edit',
            workflowTickets: 'edit',
            tasks: 'edit',
            workflow: 'edit',
            materials: 'edit',
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

      const trimmedUsername = username.trim();
      const candidate = users.find(u => u.username === trimmedUsername);

      let isAuthenticated = false;
      let shouldUpgradeHash = false;

      if (candidate) {
        const check = await verifyPassword(password, candidate.password, candidate.username);
        isAuthenticated = check.valid;
        shouldUpgradeHash = check.needsUpgrade;
      }

      if (candidate && isAuthenticated) {
        // 若資料庫仍為舊版明文密碼，登入成功時自動升級為 SHA-256 雜湊儲存
        if (shouldUpgradeHash) {
          try {
            const upgradedHash = await hashPassword(password, candidate.username);
            await updateSystemUser(candidate.id, { password: upgradedHash });
          } catch (upgradeErr) {
            console.warn('Password hash upgrade warning:', upgradeErr);
          }
        }

        sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
        setFailedAttempts(0);
        setLockoutUntil(0);

        const { password: _removed, ...safeUser } = candidate;
        await login(safeUser as SystemUser);
        navigate('/');
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        if (nextFailed >= MAX_FAILED_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_DURATION_MS;
          setLockoutUntil(until);
          sessionStorage.setItem(
            LOCKOUT_STORAGE_KEY,
            JSON.stringify({ failedAttempts: nextFailed, lockoutUntil: until })
          );
          setError(`連續登入錯誤達 ${MAX_FAILED_ATTEMPTS} 次，帳號已暫時鎖定 60 秒`);
        } else {
          sessionStorage.setItem(
            LOCKOUT_STORAGE_KEY,
            JSON.stringify({ failedAttempts: nextFailed, lockoutUntil: 0 })
          );
          setError(`帳號或密碼錯誤（剩餘嘗試次數：${MAX_FAILED_ATTEMPTS - nextFailed} 次）`);
        }
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
        <p style={{ color: '#666', marginBottom: '20px' }}>歡迎回來，請輸入帳號密碼</p>
        
        {error && (
          <div style={{ backgroundColor: '#ffebee', color: 'var(--crayon-red)', padding: '10px', borderRadius: '5px', marginBottom: '20px', fontWeight: 'bold' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            className="doodle-input" 
            type="text" 
            placeholder="輸入帳號" 
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={remainingSeconds > 0}
            required
          />
          <input 
            className="doodle-input" 
            type="password" 
            placeholder="輸入密碼" 
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={remainingSeconds > 0}
            required
          />
          <button 
            type="submit"
            className="doodle-button" 
            style={{ width: '100%', marginTop: '10px', opacity: remainingSeconds > 0 ? 0.6 : 1 }}
            disabled={loading || remainingSeconds > 0}
          >
            {remainingSeconds > 0
              ? `⏳ 請稍候 (${remainingSeconds}s)`
              : loading
              ? '登入中...'
              : '🚀 登入'}
          </button>
        </div>
      </form>
    </div>
  );
}
