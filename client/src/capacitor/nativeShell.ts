import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativeApp, nativePlatform } from './platform';

let backHookInstalled = false;

/** Status bar + Android hardware back → history.back() */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return;

  document.documentElement.classList.add('capacitor-native');
  document.body.classList.add('capacitor-native');

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (nativePlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0B1F3A' });
    }
  } catch (e) {
    console.warn('[capacitor] StatusBar', e);
  }

  try {
    if (!backHookInstalled) {
      backHookInstalled = true;
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) {
          window.history.back();
        } else {
          void CapApp.exitApp();
        }
      });
    }

    CapApp.addListener('appUrlOpen', ({ url }) => {
      try {
        const parsed = new URL(url);
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (path && path !== '/') {
          window.history.pushState({}, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch (e) {
        console.warn('[capacitor] appUrlOpen', e);
      }
    });
  } catch (e) {
    console.warn('[capacitor] App listeners', e);
  }
}
