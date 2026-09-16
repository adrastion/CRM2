import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { hasAnalyticsConsent } from '../utils/cookieConsent';

const VISITOR_KEY = 'siteVisitorId';
const HEARTBEAT_MS = 30_000;

function ensureVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id || id.length < 8) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `v-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return `v-${Date.now()}`;
  }
}

function resolveActorHint(): string {
  try {
    if (localStorage.getItem('superAdminToken')) return 'guest';
    if (localStorage.getItem('token')) return 'school';
    if (localStorage.getItem('clientToken')) {
      return localStorage.getItem('userType') === 'parent' ? 'parent' : 'client';
    }
  } catch {
    /* ignore */
  }
  return 'guest';
}

function pingUrl(): string {
  const base = process.env.REACT_APP_API_URL || '';
  if (base) return `${base.replace(/\/$/, '')}/site-analytics/ping`;
  return '/api/site-analytics/ping';
}

function sendPing(payload: Record<string, unknown>, useBeacon = false) {
  if (!hasAnalyticsConsent()) return;
  const body = JSON.stringify(payload);
  const url = pingUrl();
  try {
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

/**
 * Tracks SPA presence for Super Admin site-traffic monitoring.
 * Sends pings only after cookie analytics consent.
 */
const SiteTrafficTracker: React.FC = () => {
  const location = useLocation();
  const visitorIdRef = useRef(ensureVisitorId());
  const pathRef = useRef(location.pathname);
  const [consentOk, setConsentOk] = useState(() => hasAnalyticsConsent());

  useEffect(() => {
    const onChange = () => setConsentOk(hasAnalyticsConsent());
    window.addEventListener('cookie-consent-changed', onChange as EventListener);
    return () => window.removeEventListener('cookie-consent-changed', onChange as EventListener);
  }, []);

  useEffect(() => {
    pathRef.current = location.pathname;
    if (!consentOk) return;
    sendPing({
      visitorId: visitorIdRef.current,
      path: location.pathname,
      actorHint: resolveActorHint(),
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      visibility: typeof document !== 'undefined' ? document.visibilityState : 'visible',
    });
  }, [location.pathname, consentOk]);

  useEffect(() => {
    if (!consentOk) return;

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      sendPing({
        visitorId: visitorIdRef.current,
        path: pathRef.current,
        actorHint: resolveActorHint(),
        visibility: 'visible',
      });
    };

    const interval = window.setInterval(tick, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sendPing(
          {
            visitorId: visitorIdRef.current,
            path: pathRef.current,
            actorHint: resolveActorHint(),
            closing: true,
            visibility: 'hidden',
          },
          true
        );
      } else {
        tick();
      }
    };

    const onPageHide = () => {
      sendPing(
        {
          visitorId: visitorIdRef.current,
          path: pathRef.current,
          actorHint: resolveActorHint(),
          closing: true,
        },
        true
      );
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [consentOk]);

  return null;
};

export default SiteTrafficTracker;
