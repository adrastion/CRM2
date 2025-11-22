import React, { createContext, useContext, useState, useEffect, ReactNode, useReducer } from 'react';
import { apiService } from '../services/api';

interface PromoCodeAdmin {
  id: string;
  email: string;
  name: string;
  tenantId: string;
}

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
}

interface PromoCodeAdminAuthState {
  admin: PromoCodeAdmin | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface PromoCodeAdminAuthContextType extends PromoCodeAdminAuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const PromoCodeAdminAuthContext = createContext<PromoCodeAdminAuthContextType | undefined>(undefined);

const initialState: PromoCodeAdminAuthState = {
  admin: null,
  tenant: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

type PromoCodeAdminAuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { admin: PromoCodeAdmin; tenant: Tenant; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' };

const promoCodeAdminAuthReducer = (state: PromoCodeAdminAuthState, action: PromoCodeAdminAuthAction): PromoCodeAdminAuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        admin: action.payload.admin,
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

interface PromoCodeAdminAuthProviderProps {
  children: ReactNode;
}

export const PromoCodeAdminAuthProvider: React.FC<PromoCodeAdminAuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(promoCodeAdminAuthReducer, initialState);

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('promoCodeAdminToken');
    const adminStr = localStorage.getItem('promoCodeAdmin');
    const tenantStr = localStorage.getItem('promoCodeAdminTenant');

    if (token && adminStr && tenantStr) {
      try {
        const admin = JSON.parse(adminStr);
        const tenant = JSON.parse(tenantStr);
        
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { admin, tenant, token }
        });
      } catch (error) {
        console.error('Error parsing stored promo code admin auth data:', error);
        localStorage.removeItem('promoCodeAdminToken');
        localStorage.removeItem('promoCodeAdmin');
        localStorage.removeItem('promoCodeAdminTenant');
        dispatch({ type: 'AUTH_FAILURE' });
      }
    } else {
      dispatch({ type: 'AUTH_FAILURE' });
    }
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await apiService.promoCodeAdminLogin({ email, password });
      
      // Store in localStorage
      localStorage.setItem('promoCodeAdminToken', response.token);
      localStorage.setItem('promoCodeAdmin', JSON.stringify(response.admin));
      localStorage.setItem('promoCodeAdminTenant', JSON.stringify(response.tenant));
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          admin: response.admin,
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
    localStorage.removeItem('promoCodeAdminToken');
    localStorage.removeItem('promoCodeAdmin');
    localStorage.removeItem('promoCodeAdminTenant');
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <PromoCodeAdminAuthContext.Provider
      value={{
        ...state,
        login,
        logout,
      }}
    >
      {children}
    </PromoCodeAdminAuthContext.Provider>
  );
};

export const usePromoCodeAdminAuth = (): PromoCodeAdminAuthContextType => {
  const context = useContext(PromoCodeAdminAuthContext);
  if (context === undefined) {
    throw new Error('usePromoCodeAdminAuth must be used within a PromoCodeAdminAuthProvider');
  }
  return context;
};

