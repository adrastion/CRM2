/**
 * Сборка для Capacitor.
 * PUBLIC_URL=/ — абсолютные /static/... (как на сайте).
 * Относительный ./ ломает lazy-chunks после перехода на /dashboard, /admin/... → белый экран.
 * Capacitor отдаёт assets с корня https://localhost/, поэтому /static работает.
 */
const { execSync } = require('child_process');
const path = require('path');

const fs = require('fs');

const clientDir = path.join(__dirname, '..');
const googleServices = path.join(clientDir, 'android', 'app', 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServices);
const enableNativePush =
  process.env.REACT_APP_ENABLE_NATIVE_PUSH === 'true' ||
  process.env.REACT_APP_ENABLE_NATIVE_PUSH === '1' ||
  hasGoogleServices;

const env = {
  ...process.env,
  PUBLIC_URL: '/',
  REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'https://profsportcrm.ru/api',
  // иначе CRA падает на eslint warnings как на errors
  CI: 'false',
  DISABLE_ESLINT_PLUGIN: 'true',
  REACT_APP_ENABLE_NATIVE_PUSH: enableNativePush ? 'true' : 'false',
};

console.log(
  '[build-mobile] PUBLIC_URL=/ REACT_APP_API_URL=%s FCM=%s (google-services.json %s)',
  env.REACT_APP_API_URL,
  env.REACT_APP_ENABLE_NATIVE_PUSH,
  hasGoogleServices ? 'found' : 'missing'
);
execSync('npx react-scripts build', { stdio: 'inherit', cwd: clientDir, env });
execSync('npx cap sync android', { stdio: 'inherit', cwd: clientDir, env });
console.log('[build-mobile] done');
