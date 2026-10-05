import React from 'react';
import { useNavigate } from 'react-router-dom';
import { switchToAccountSafe, getActiveAccountId } from '../utils/accountSwitcher';

function destinationForSlot(accountId: string, next?: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  if (accountId.startsWith('CLIENT:') || accountId.startsWith('PARENT:')) {
    return '/client/dashboard';
  }
  if (accountId.startsWith('SUPER_ADMIN:')) return '/admin/dashboard';
  if (accountId.startsWith('TESTER:')) return '/tester/dashboard';
  return '/dashboard';
}

async function applySwitch(accountId: string, next?: string | null) {
  const active = getActiveAccountId();
  const target = destinationForSlot(accountId, next);
  if (active === accountId) {
    if (target && window.location.pathname + window.location.search !== target) {
      window.location.assign(target);
    }
    return;
  }
  // switchToAccountSafe делает reload при успехе — next кладём в sessionStorage
  sessionStorage.setItem('pendingSwitchNext', target);
  const result = await switchToAccountSafe(accountId);
  if (result === 'ok') {
    // reload уже произошёл или произойдёт
    return;
  }
  sessionStorage.removeItem('pendingSwitchNext');
}

/**
 * Deep-link с push: ?switchAccount=TENANT_USER:id&next=/chats
 * и postMessage от service worker.
 */
const SwitchAccountFromPush: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    const pendingNext = sessionStorage.getItem('pendingSwitchNext');
    if (pendingNext) {
      sessionStorage.removeItem('pendingSwitchNext');
      navigate(pendingNext, { replace: true });
    }

    const params = new URLSearchParams(window.location.search);
    const switchAccount = params.get('switchAccount');
    const next = params.get('next');
    if (switchAccount) {
      params.delete('switchAccount');
      params.delete('next');
      const qs = params.toString();
      const clean =
        window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
      void applySwitch(switchAccount, next);
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'SWITCH_ACCOUNT_FROM_PUSH') return;
      if (data.switchAccount) {
        void applySwitch(String(data.switchAccount), data.next ? String(data.next) : null);
      } else if (data.next && String(data.next).startsWith('/')) {
        navigate(String(data.next), { replace: true });
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [navigate]);

  return null;
};

export default SwitchAccountFromPush;
