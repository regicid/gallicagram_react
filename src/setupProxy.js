const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/ngrams',
    createProxyMiddleware({
      target: 'https://books.google.com/ngrams',
      changeOrigin: true,
    })
  );
};