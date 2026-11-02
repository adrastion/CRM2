import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import { isNativeApp } from './capacitor/platform';
import { initNativeShell } from './capacitor/nativeShell';
import { initNativePush } from './capacitor/push';
import { initOfflineLayer } from './offline/offlineApi';
import './capacitor/native.css';

async function bootstrap() {
  try {
    await initNativeShell();
  } catch (e) {
    console.warn('[bootstrap] nativeShell', e);
  }
  try {
    await initOfflineLayer();
  } catch (e) {
    console.warn('[bootstrap] offline', e);
  }
  // Push откладываем: без google-services.json ранний register роняет Android.
  window.setTimeout(() => {
    void initNativePush();
  }, 1500);

  // SW только в браузере (в Capacitor — нативный FCM)
  if (!isNativeApp() && 'serviceWorker' in navigator) {
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

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  );
}

void bootstrap();
