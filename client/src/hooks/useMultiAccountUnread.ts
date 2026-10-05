import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import {
  getActiveAccountId,
  getSlotBearerToken,
  listUsableSavedAccounts,
  type SavedAccountSlot,
} from '../utils/accountSwitcher';

const INBOX_TYPES = new Set(['TENANT_USER', 'CLIENT', 'PARENT']);
const POLL_MS = 45_000;

function inboxSlots(): Array<{ id: string; token: string }> {
  return listUsableSavedAccounts()
    .filter((a: SavedAccountSlot) => INBOX_TYPES.has(a.accountType))
    .map((a) => {
      const token = getSlotBearerToken(a);
      return token ? { id: a.id, token } : null;
    })
    .filter((x): x is { id: string; token: string } => Boolean(x));
}

/**
 * Непрочитанные по всем сохранённым school/portal аккаунтам.
 * Batch через POST /auth/saved-accounts/unread.
 */
export function useMultiAccountUnread(opts?: { menuOpen?: boolean }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeAccountId, setActiveAccountId] = useState<string | null>(() =>
    getActiveAccountId()
  );

  const refresh = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    setActiveAccountId(getActiveAccountId());
    const accounts = inboxSlots();
    if (accounts.length === 0) {
      setCounts({});
      return;
    }
    try {
      const res = await apiService.getSavedAccountsUnread(accounts);
      setCounts(res.counts || {});
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (opts?.menuOpen) void refresh();
  }, [opts?.menuOpen, refresh]);

  const otherAccountsUnread = useMemo(() => {
    const active = activeAccountId;
    return Object.entries(counts).reduce((sum, [id, n]) => {
      if (id === active) return sum;
      return sum + (typeof n === 'number' && n > 0 ? n : 0);
    }, 0);
  }, [counts, activeAccountId]);

  return {
    counts,
    otherAccountsUnread,
    activeAccountId,
    refresh,
  };
}
