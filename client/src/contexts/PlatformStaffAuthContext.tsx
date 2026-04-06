import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { apiService } from '../services/api';

export interface PlatformStaff {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPPORT' | 'DESIGNER' | 'SECURITY';
  mustChangePassword?: boolean;
}

interface PlatformStaffAuthContextType {
  staff: PlatformStaff | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const PlatformStaffAuthContext = createContext<PlatformStaffAuthContextType | undefined>(undefined);

export const PlatformStaffAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [staff, setStaff] = useState<PlatformStaff | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('platformStaff');
    const t = localStorage.getItem('platformStaffToken');
    if (raw && t) {
      try {
        setStaff(JSON.parse(raw));
        setToken(t);
      } catch {
        localStorage.removeItem('platformStaff');
        localStorage.removeItem('platformStaffToken');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiService.platformStaffLogin(email, password);
    localStorage.setItem('platformStaffToken', data.token);
    localStorage.setItem('platformStaff', JSON.stringify(data.staff));
    setToken(data.token);
    setStaff(data.staff);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('platformStaffToken');
    localStorage.removeItem('platformStaff');
    setToken(null);
    setStaff(null);
  }, []);

  const value: PlatformStaffAuthContextType = {
    staff,
    token,
    isAuthenticated: !!token && !!staff,
    isLoading,
    login,
    logout,
  };

  return (
    <PlatformStaffAuthContext.Provider value={value}>
      {children}
    </PlatformStaffAuthContext.Provider>
  );
};

export const usePlatformStaffAuth = (): PlatformStaffAuthContextType => {
  const ctx = useContext(PlatformStaffAuthContext);
  if (!ctx) {
    throw new Error('usePlatformStaffAuth must be used within PlatformStaffAuthProvider');
  }
  return ctx;
};
