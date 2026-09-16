import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';

interface Marketer {
  id: string;
  email: string;
  name: string;
  type: 'MARKETER' | 'MEDIA_PARTNER';
  tenantId?: string | null;
  commissionPercentage?: number;
  balance?: number;
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
  | { type: 'AUTH_SUCCESS'; payload: { marketer: Marketer; tenant: Tenant | null; token: string } }
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

/** Парсит tenant из localStorage; платформенные маркетологи могут быть без школы. */
function parseStoredTenant(raw: string | null): Tenant | null {
  if (raw == null || raw === '' || raw === 'null' || raw === 'undefined') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.id) return null;
    return parsed as Tenant;
  } catch {
    return null;
  }
}

interface MarketerAuthProviderProps {
  children: ReactNode;
}

export const MarketerAuthProvider: React.FC<MarketerAuthProviderProps> = ({ children }) => {
  const [state, dispatch] = React.useReducer(marketerAuthReducer, initialState);

  useEffect(() => {
    const wasLoggedOut = sessionStorage.getItem('marketerLoggedOut');
    if (wasLoggedOut === 'true') {
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

    // tenant не обязателен: платформенные маркетологи без привязки к школе
    if (token && marketerStr) {
      try {
        const marketer = JSON.parse(marketerStr);
        if (!marketer?.id) {
          throw new Error('Invalid marketer payload');
        }
        const tenant = parseStoredTenant(tenantStr);

        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { marketer, tenant, token },
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

      localStorage.setItem('marketerToken', response.token);
      localStorage.setItem('marketer', JSON.stringify(response.marketer));
      localStorage.setItem('marketerTenant', JSON.stringify(response.tenant ?? null));

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          marketer: response.marketer,
          tenant: response.tenant ?? null,
          token: response.token,
        },
      });
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE' });
      throw error;
    }
  };

  const logout = (): void => {
    sessionStorage.setItem('marketerLoggedOut', 'true');

    localStorage.removeItem('marketerToken');
    localStorage.removeItem('marketer');
    localStorage.removeItem('marketerTenant');

    sessionStorage.removeItem('marketerToken');
    sessionStorage.removeItem('marketer');
    sessionStorage.removeItem('marketerTenant');

    dispatch({ type: 'LOGOUT' });

    setTimeout(() => {
      if (localStorage.getItem('marketerToken')) {
        localStorage.removeItem('marketerToken');
        localStorage.removeItem('marketer');
        localStorage.removeItem('marketerTenant');
      }
    }, 100);
  };

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
