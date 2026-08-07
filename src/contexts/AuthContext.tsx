import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { SystemUser, ModulePermissions } from '../types';

interface AuthContextType {
  currentUser: SystemUser | null;
  login: (user: SystemUser) => void;
  logout: () => void;
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

  const login = (user: SystemUser) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const logout = () => {
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
