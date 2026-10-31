import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiService } from '../services/api';

const PROFILE_KEYS = ['name', 'phone', 'inn', 'taxStatus', 'bank'] as const;
const DOC_KEYS = ['offer', 'pep', 'pdn', 'programRules'] as const;

export const MARKETER_ONBOARDING_CHANGED = 'marketer:onboarding-changed';

export function notifyMarketerOnboardingChanged() {
  window.dispatchEvent(new Event(MARKETER_ONBOARDING_CHANGED));
}

export type MarketerCabinetReady = {
  loading: boolean;
  /** Профиль + документы заполнены — кабинет открыт. */
  complete: boolean;
  profileDone: boolean;
  docsDone: boolean;
  missing: string[];
  refresh: () => Promise<void>;
};

/**
 * Готовность кабинета маркетолога: без профиля и подключений
 * рабочие разделы недоступны.
 */
export function useMarketerCabinetReady(enabled = true): MarketerCabinetReady {
  const location = useLocation();
  const [loading, setLoading] = useState(enabled);
  const [complete, setComplete] = useState(false);
  const [profileDone, setProfileDone] = useState(false);
  const [docsDone, setDocsDone] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setComplete(true);
      return;
    }
    try {
      const p = await apiService.getMarketerProfile();
      const miss: string[] = p?.onboarding?.missing || [];
      setMissing(miss);
      setComplete(!!p?.onboarding?.complete);
      setProfileDone(!PROFILE_KEYS.some((k) => miss.includes(k)));
      setDocsDone(!DOC_KEYS.some((k) => miss.includes(k)));
    } catch {
      setComplete(false);
      setProfileDone(false);
      setDocsDone(false);
      setMissing([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setComplete(true);
      return;
    }
    setLoading(true);
    void refresh();
  }, [enabled, location.pathname, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => void refresh();
    window.addEventListener(MARKETER_ONBOARDING_CHANGED, onChange);
    return () => window.removeEventListener(MARKETER_ONBOARDING_CHANGED, onChange);
  }, [enabled, refresh]);

  return { loading, complete, profileDone, docsDone, missing, refresh };
}
