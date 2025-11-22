import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';

interface Marketer {
  id: string;
  email: string;
  name: string;
  type: 'MARKETER' | 'MEDIA_PARTNER';
  tenantId: string;
}

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
}

interface MarketerAuthState {
  marketer: Marketer | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface MarketerAuthContextType extends MarketerAuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const MarketerAuthContext = createContext<MarketerAuthContextType | undefined>(undefined);

const initialState: MarketerAuthState = {
  marketer: null,
  tenant: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

type MarketerAuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { marketer: Marketer; tenant: Tenant; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' };

const marketerAuthReducer = (state: MarketerAuthState, action: MarketerAuthAction): MarketerAuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        marketer: action.payload.marketer,
        tenant: action.payload.tenant,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'AUTH_FAILURE':
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    default:
      return state;
  }
};

interface MarketerAuthProviderProps {
  children: ReactNode;
}

export const MarketerAuthProvider: React.FC<MarketerAuthProviderProps> = ({ children }) => {
  const [state, dispatch] = React.useReducer(marketerAuthReducer, initialState);

  // Check for existing token on app load
  useEffect(() => {
    // Check if user explicitly logged out (flag in sessionStorage)
    const wasLoggedOut = sessionStorage.getItem('marketerLoggedOut');
    if (wasLoggedOut === 'true') {
      // Clear the flag and don't restore auth
      sessionStorage.removeItem('marketerLoggedOut');
      localStorage.removeItem('marketerToken');
      localStorage.removeItem('marketer');
      localStorage.removeItem('marketerTenant');
      dispatch({ type: 'AUTH_FAILURE' });
      return;
    }

    const token = localStorage.getItem('marketerToken');
    const marketerStr = localStorage.getItem('marketer');
    const tenantStr = localStorage.getItem('marketerTenant');

    if (token && marketerStr && tenantStr) {
      try {
        const marketer = JSON.parse(marketerStr);
        const tenant = JSON.parse(tenantStr);
        
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { marketer, tenant, token }
        });
      } catch (error) {
        console.error('Error parsing stored marketer auth data:', error);
        localStorage.removeItem('marketerToken');
        localStorage.removeItem('marketer');
        localStorage.removeItem('marketerTenant');
        dispatch({ type: 'AUTH_FAILURE' });
      }
    } else {
      dispatch({ type: 'AUTH_FAILURE' });
    }
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await apiService.marketerLogin({ email, password });
      
      // Store in localStorage
      localStorage.setItem('marketerToken', response.token);
      localStorage.setItem('marketer', JSON.stringify(response.marketer));
      localStorage.setItem('marketerTenant', JSON.stringify(response.tenant));
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          marketer: response.marketer,
          tenant: response.tenant,
          token: response.token,
        },
      });
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE' });
      throw error;
    }
  };

  const logout = (): void => {
    // Set flag to prevent auto-restore on next mount
    sessionStorage.setItem('marketerLoggedOut', 'true');
    
    // Clear all marketer-related data from localStorage
    localStorage.removeItem('marketerToken');
    localStorage.removeItem('marketer');
    localStorage.removeItem('marketerTenant');
    
    // Also clear from sessionStorage to be safe
    sessionStorage.removeItem('marketerToken');
    sessionStorage.removeItem('marketer');
    sessionStorage.removeItem('marketerTenant');
    
    // Dispatch logout action immediately
    dispatch({ type: 'LOGOUT' });
    
    // Force state update by clearing any pending auth checks
    // This ensures the component re-renders with logged out state
    setTimeout(() => {
      // Double-check that tokens are removed
      if (localStorage.getItem('marketerToken')) {
        localStorage.removeItem('marketerToken');
        localStorage.removeItem('marketer');
        localStorage.removeItem('marketerTenant');
      }
    }, 100);
  };

  // Token is handled by apiService interceptor automatically via localStorage

  return (
    <MarketerAuthContext.Provider
      value={{
        ...state,
        login,
        logout,
      }}
    >
      {children}
    </MarketerAuthContext.Provider>
  );
};

export const useMarketerAuth = (): MarketerAuthContextType => {
  const context = useContext(MarketerAuthContext);
  if (context === undefined) {
    throw new Error('useMarketerAuth must be used within a MarketerAuthProvider');
  }
  return context;
};

