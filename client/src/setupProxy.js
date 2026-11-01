/**
 * CRA package.json "proxy" режет крупные multipart (APK) → HTTP 413.
 * setupProxy обходит лимит и поднимает таймауты для /api.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      secure: false,
      timeout: 10 * 60 * 1000,
      proxyTimeout: 10 * 60 * 1000,
    })
  );
};
