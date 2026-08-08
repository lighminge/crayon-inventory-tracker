import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { SystemUser, ModulePermissions } from '../types';
import { addLoginRecord, updateLoginRecord } from '../services/api';

interface AuthContextType {
  currentUser: SystemUser | null;
  login: (user: SystemUser) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (module: keyof ModulePermissions, level: 'view' | 'edit') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);

  useEffect(() => {
    // Check localStorage on mount
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  const login = async (user: SystemUser) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Fetch IP and create login record
    let ip = 'Unknown';
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      ip = data.ip;
    } catch (e) {
      console.warn('Failed to fetch IP', e);
    }
    
    try {
      const loginTime = Date.now();
      const record = await addLoginRecord({
        userId: user.id,
        username: user.username,
        loginTime,
        ip
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
    const userLevel = currentUser.permissions[module];
    
    if (level === 'view') {
      return userLevel === 'view' || userLevel === 'edit';
    }
    
    if (level === 'edit') {
      return userLevel === 'edit';
    }
    
    return false;
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, hasPermission }}>
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
