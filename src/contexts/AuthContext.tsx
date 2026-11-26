import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { SystemUser, ModulePermissions } from '../types';
import { addLoginRecord, updateLoginRecord, getSystemUsers } from '../services/api';

interface AuthContextType {
  currentUser: SystemUser | null;
  login: (user: SystemUser) => Promise<void>;
  logout: () => Promise<void>;
  syncCurrentUser: (user: SystemUser) => void;
  hasPermission: (module: keyof ModulePermissions, level: 'view' | 'edit') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const sanitizeUserForStorage = (user: SystemUser): SystemUser => {
  const { password: _removed, ...safeUser } = user;
  return safeUser as SystemUser;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);

  const refreshFromRemote = useCallback(async (targetUser: SystemUser) => {
    try {
      const users = await getSystemUsers();
      const latest = users.find(u => u.id === targetUser.id || u.username === targetUser.username);
      if (latest) {
        const safeLatest = sanitizeUserForStorage(latest);
        setCurrentUser(safeLatest);
        localStorage.setItem('currentUser', JSON.stringify(safeLatest));
      } else if (users.length > 0) {
        // 若該帳號已被管理員刪除，強制登出清除狀態
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
      }
    } catch {
      // ignore network error
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsed: SystemUser = sanitizeUserForStorage(JSON.parse(savedUser));
        setCurrentUser(parsed);
        refreshFromRemote(parsed);
      } catch {
        localStorage.removeItem('currentUser');
      }
    }
  }, [refreshFromRemote]);

  // 防止使用者透過瀏覽器 DevTools 竄改 localStorage 權限，於視窗聚焦或 storage 變更時自動向資料庫校正權限
  useEffect(() => {
    if (!currentUser) return;
    const handleFocusOrStorage = () => {
      refreshFromRemote(currentUser);
    };
    window.addEventListener('focus', handleFocusOrStorage);
    window.addEventListener('storage', handleFocusOrStorage);
    return () => {
      window.removeEventListener('focus', handleFocusOrStorage);
      window.removeEventListener('storage', handleFocusOrStorage);
    };
  }, [currentUser, refreshFromRemote]);

  const syncCurrentUser = (user: SystemUser) => {
    const safeUser = sanitizeUserForStorage(user);
    setCurrentUser(safeUser);
    localStorage.setItem('currentUser', JSON.stringify(safeUser));
  };

  const login = async (user: SystemUser) => {
    const safeUser = sanitizeUserForStorage(user);
    setCurrentUser(safeUser);
    localStorage.setItem('currentUser', JSON.stringify(safeUser));
    
    // Fetch IP and create login record with 3.5s timeout protection & length sanitization
    let ip = 'Unknown';
    let location = 'Unknown';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (typeof data.ip === 'string') {
        ip = data.ip.slice(0, 64);
      }
      if (typeof data.city === 'string' && data.city) {
        location = `${data.city}, ${typeof data.country === 'string' ? data.country : ''}`
          .replace(/, $/, '')
          .slice(0, 128);
      } else if (typeof data.country === 'string' && data.country) {
        location = data.country.slice(0, 128);
      }
    } catch (e) {
      console.warn('Failed to fetch IP/Location', e);
    }
    
    try {
      const loginTime = Date.now();
      const record = await addLoginRecord({
        userId: safeUser.id,
        username: safeUser.username,
        loginTime,
        ip,
        location
      });
      localStorage.setItem('currentLoginRecordId', record.id);
      localStorage.setItem('currentLoginTime', loginTime.toString());
    } catch (e) {
      console.error('Failed to save login record', e);
    }
  };

  const logout = async () => {
    const recordId = localStorage.getItem('currentLoginRecordId');
    if (recordId) {
      try {
        await updateLoginRecord(recordId, { logoutTime: Date.now() });
      } catch (e) {
        console.error('Failed to update logout time', e);
      }
      localStorage.removeItem('currentLoginRecordId');
      localStorage.removeItem('currentLoginTime');
    }
    
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const hasPermission = (module: keyof ModulePermissions, level: 'view' | 'edit'): boolean => {
    if (!currentUser) return false;
    const userLevel = currentUser.permissions?.[module] || 'none';
    
    if (level === 'view') {
      return userLevel === 'view' || userLevel === 'edit';
    }
    
    if (level === 'edit') {
      return userLevel === 'edit';
    }
    
    return false;
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, syncCurrentUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
