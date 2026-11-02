import React, { useEffect } from 'react';
import { refreshNativePushRegistration } from './push';
import { pullOfflineSnapshots } from '../offline/offlineApi';
import { isNativeApp } from './platform';

/**
 * После появления любого токена — FCM register + offline pull.
 * Монтируется один раз в App.
 */
const NativeBootstrap: React.FC = () => {
  useEffect(() => {
    const sync = () => {
      const hasSession = Boolean(
        localStorage.getItem('token') ||
          localStorage.getItem('clientToken') ||
          localStorage.getItem('superAdminToken') ||
          localStorage.getItem('testerToken')
      );
      if (!hasSession) return;
      void refreshNativePushRegistration();
      void pullOfflineSnapshots();
    };

    sync();
    window.addEventListener('storage', sync);
    const id = window.setInterval(sync, 60_000);
    return () => {
      window.removeEventListener('storage', sync);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (isNativeApp()) {
      document.documentElement.classList.add('capacitor-native');
      document.body.classList.add('capacitor-native');
    }
  }, []);

  return null;
};

export default NativeBootstrap;
