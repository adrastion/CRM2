import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';

interface SuperAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface SuperAdminAuthState {
  superAdmin: SuperAdmin | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type SuperAdminAuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { superAdmin: SuperAdmin; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' };

const initialState: SuperAdminAuthState = {
  superAdmin: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

const superAdminAuthReducer = (
  state: SuperAdminAuthState,
  action: SuperAdminAuthAction
): SuperAdminAuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        superAdmin: action.payload.superAdmin,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        superAdmin: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        superAdmin: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
};

interface SuperAdminAuthContextType {
  superAdmin: SuperAdmin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType | undefined>(undefined);

interface SuperAdminAuthProviderProps {
  children: ReactNode;
}

export const SuperAdminAuthProvider: React.FC<SuperAdminAuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(superAdminAuthReducer, initialState);

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('superAdminToken');
    const superAdminStr = localStorage.getItem('superAdmin');

    if (token && superAdminStr) {
      try {
        const superAdmin = JSON.parse(superAdminStr);
        
        // Set token in API service
        apiService.setToken(token);
        
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { superAdmin, token }
        });
      } catch (error) {
        console.error('Error parsing stored super admin auth data:', error);
        localStorage.removeItem('superAdminToken');
        localStorage.removeItem('superAdmin');
        dispatch({ type: 'AUTH_FAILURE' });
      }
    } else {
      dispatch({ type: 'AUTH_FAILURE' });
    }
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await apiService.superAdminLogin({ email, password });
      
      // Store in localStorage
      localStorage.setItem('superAdminToken', response.token);
      localStorage.setItem('superAdmin', JSON.stringify(response.superAdmin));
      
      // Set token in API service
      apiService.setToken(response.token);
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          superAdmin: response.superAdmin,
          token: response.token,
        },
      });
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE' });
      throw error;
    }
  };

  const logout = (): void => {
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdmin');
    apiService.setToken(null);
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <SuperAdminAuthContext.Provider
      value={{
        superAdmin: state.superAdmin,
        isAuthenticated: state.isAuthenticated,
        isLoading: state.isLoading,
        login,
        logout,
      }}
    >
      {children}
    </SuperAdminAuthContext.Provider>
  );
};

export const useSuperAdminAuth = (): SuperAdminAuthContextType => {
  const context = useContext(SuperAdminAuthContext);
  if (context === undefined) {
    throw new Error('useSuperAdminAuth must be used within a SuperAdminAuthProvider');
  }
  return context;
};

