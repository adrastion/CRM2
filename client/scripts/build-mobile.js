/**
 * Сборка для Capacitor.
 * PUBLIC_URL=/ — абсолютные /static/... (как на сайте).
 * Относительный ./ ломает lazy-chunks после перехода на /dashboard, /admin/... → белый экран.
 * Capacitor отдаёт assets с корня https://localhost/, поэтому /static работает.
 */
const { execSync } = require('child_process');
const path = require('path');

const env = {
  ...process.env,
  PUBLIC_URL: '/',
  REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'https://profsportcrm.ru/api',
  // иначе CRA падает на eslint warnings как на errors
  CI: 'false',
  DISABLE_ESLINT_PLUGIN: 'true',
};

const clientDir = path.join(__dirname, '..');

console.log('[build-mobile] PUBLIC_URL=/ REACT_APP_API_URL=%s', env.REACT_APP_API_URL);
execSync('npx react-scripts build', { stdio: 'inherit', cwd: clientDir, env });
execSync('npx cap sync android', { stdio: 'inherit', cwd: clientDir, env });
console.log('[build-mobile] done');
