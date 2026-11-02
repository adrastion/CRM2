import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSuperAdminAuth } from '../contexts/SuperAdminAuthContext';
import { resolveRealtimeToken } from './resolveRealtimeToken';
import { useRealtimeSocket } from './useRealtimeSocket';

/**
 * Глобальный мост Socket.IO → window events.
 * Монтируется один раз внутри Router (AppContent).
 */
const RealtimeBridge: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { isAuthenticated: isSa } = useSuperAdminAuth();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(() => resolveRealtimeToken());

  useEffect(() => {
    setToken(resolveRealtimeToken());
  }, [isAuthenticated, isSa, location.pathname]);

  useEffect(() => {
    const sync = () => setToken(resolveRealtimeToken());
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  useRealtimeSocket({ token, enabled: Boolean(token) });
  return null;
};

export default RealtimeBridge;
