const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/ngrams',
    createProxyMiddleware({
      target: 'https://books.google.com/ngrams',
      changeOrigin: true,
    })
  );
  app.use(
    '/api/lemonde',
    createProxyMiddleware({
      target: 'https://www.lemonde.fr',
      changeOrigin: true,
      pathRewrite: {
        '^/': '/recherche/',
      },
    })
  );
  app.use(
    '/api/persee',
    createProxyMiddleware({
      target: 'https://www.persee.fr',
      changeOrigin: true,
      pathRewrite: {
        '^/': '/search',
      },
    })
  );
};