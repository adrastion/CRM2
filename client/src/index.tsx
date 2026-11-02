import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import { isNativeApp } from './capacitor/platform';
import './capacitor/native.css';

const rootEl = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootEl);

// Сначала UI — иначе ожидание offline/Capacitor даёт «белый экран» на слабых WebView.
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

async function initNativeExtras() {
  try {
    const { initNativeShell } = await import('./capacitor/nativeShell');
    await initNativeShell();
  } catch (e) {
    console.warn('[bootstrap] nativeShell', e);
  }
  try {
    const { initOfflineLayer } = await import('./offline/offlineApi');
    await initOfflineLayer();
  } catch (e) {
    console.warn('[bootstrap] offline', e);
  }
  window.setTimeout(() => {
    void import('./capacitor/push')
      .then(({ initNativePush }) => initNativePush())
      .catch((e) => console.warn('[bootstrap] push', e));
  }, 2000);
}

if (isNativeApp()) {
  void initNativeExtras();
} else {
  // На сайте offline-слой тоже полезен, но не блокирует первый кадр
  void import('./offline/offlineApi')
    .then(({ initOfflineLayer }) => initOfflineLayer())
    .catch((e) => console.warn('[bootstrap] offline', e));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    });
  }
}
