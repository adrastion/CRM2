/**
 * Сборка web-ассетов для Capacitor: PUBLIC_URL=./ (относительные пути).
 * Обычный `npm run build` для сайта — без PUBLIC_URL (корневые /static/...).
 */
const { execSync } = require('child_process');
const path = require('path');

const env = {
  ...process.env,
  PUBLIC_URL: './',
  REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'https://profsportcrm.ru/api',
  CI: process.env.CI || 'true',
};

const clientDir = path.join(__dirname, '..');

console.log('[build-mobile] PUBLIC_URL=./ REACT_APP_API_URL=%s', env.REACT_APP_API_URL);
execSync('npx react-scripts build', { stdio: 'inherit', cwd: clientDir, env });
execSync('npx cap sync android', { stdio: 'inherit', cwd: clientDir, env });
console.log('[build-mobile] done');
