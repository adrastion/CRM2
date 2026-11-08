import { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';

export type PublicSiteConfig = {
  socialLinks: Array<{ key: string; label: string; url: string; sortOrder: number }>;
  landingVariant?: string;
  download: {
    tabEnabled: boolean;
    rustoreUrl: string | null;
    publicApkEnabled: boolean;
    apkLabel: string | null;
    iosInstructionEnabled: boolean;
    iosInstructionText: string;
  };
};

let cached: PublicSiteConfig | null = null;
let inflight: Promise<PublicSiteConfig> | null = null;

/** Сброс кэша после смены настроек в SA (в другой вкладке — hard refresh). */
export function clearPublicSiteConfigCache() {
  cached = null;
}

async function fetchConfig(): Promise<PublicSiteConfig> {
  if (cached) return cached;
  if (!inflight) {
    inflight = apiService
      .getPublicSiteConfig()
      .then((data) => {
        cached = data;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Публичный конфиг сайта с лёгким кэшем на сессию. */
export function usePublicSiteConfig() {
  const [config, setConfig] = useState<PublicSiteConfig | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      cached = null;
      const data = await fetchConfig();
      setConfig(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить настройки сайта');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(!cached);
      try {
        const data = await fetchConfig();
        if (!cancelled) setConfig(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить настройки сайта');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading, error, reload };
}
