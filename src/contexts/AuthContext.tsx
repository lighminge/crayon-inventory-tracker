import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);

  useEffect(() => {
    // Check localStorage on mount and sync latest permissions from DB
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsed: SystemUser = JSON.parse(savedUser);
        setCurrentUser(parsed);
        getSystemUsers()
          .then(users => {
            const latest = users.find(u => u.id === parsed.id || u.username === parsed.username);
            if (latest) {
              setCurrentUser(latest);
              localStorage.setItem('currentUser', JSON.stringify(latest));
            }
          })
          .catch(() => {});
      } catch (e) {}
    }
  }, []);

  const syncCurrentUser = (user: SystemUser) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const login = async (user: SystemUser) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Fetch IP and create login record
    let ip = 'Unknown';
    let location = 'Unknown';
    try {
      const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
      const data = await res.json();
      ip = data.ip || 'Unknown';
      if (data.city) {
        location = `${data.city}, ${data.country || ''}`.replace(/, $/, '');
      } else if (data.country) {
        location = data.country;
      }
    } catch (e) {
      console.warn('Failed to fetch IP/Location', e);
    }
    
    try {
      const loginTime = Date.now();
      const record = await addLoginRecord({
        userId: user.id,
        username: user.username,
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
