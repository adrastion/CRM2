import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

interface Tester {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface TesterAuthState {
  tester: Tester | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type TesterAuthAction =
  | { type: 'AUTH_SUCCESS'; payload: { tester: Tester; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' };

const initialState: TesterAuthState = {
  tester: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

const testerAuthReducer = (state: TesterAuthState, action: TesterAuthAction): TesterAuthState => {
  switch (action.type) {
    case 'AUTH_SUCCESS':
      return {
        ...state,
        tester: action.payload.tester,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'AUTH_FAILURE':
    case 'LOGOUT':
      return {
        ...state,
        tester: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
};

interface TesterAuthContextType {
  tester: Tester | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

const TesterAuthContext = createContext<TesterAuthContextType | undefined>(undefined);

export const TesterAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(testerAuthReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem('testerToken');
    const testerStr = localStorage.getItem('tester');

    if (token && testerStr) {
      try {
        const tester = JSON.parse(testerStr);
        dispatch({ type: 'AUTH_SUCCESS', payload: { tester, token } });
      } catch {
        localStorage.removeItem('testerToken');
        localStorage.removeItem('tester');
        dispatch({ type: 'AUTH_FAILURE' });
      }
    } else {
      dispatch({ type: 'AUTH_FAILURE' });
    }
  }, []);

  const logout = (): void => {
    localStorage.removeItem('testerToken');
    localStorage.removeItem('tester');
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <TesterAuthContext.Provider
      value={{
        tester: state.tester,
        isAuthenticated: state.isAuthenticated,
        isLoading: state.isLoading,
        logout,
      }}
    >
      {children}
    </TesterAuthContext.Provider>
  );
};

export const useTesterAuth = (): TesterAuthContextType => {
  const context = useContext(TesterAuthContext);
  if (context === undefined) {
    throw new Error('useTesterAuth must be used within a TesterAuthProvider');
  }
  return context;
};
