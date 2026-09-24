const { createProxyMiddleware } = require('http-proxy-middleware');
const pressSearch = require('../api/press');

module.exports = function (app) {
  // On Vercel this is the api/press.js function; the dev server runs the same handler.
  app.get('/api/press', pressSearch);

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
  app.use(
    '/api/sru',
    createProxyMiddleware({
      target: 'https://gallica.bnf.fr',
      changeOrigin: true,
      pathRewrite: {
        '^/': '/SRU',
      },
    })
  );

  // Gallicagram MCP Proxy
  app.use(
    '/mcp-proxy',
    createProxyMiddleware({
      target: 'https://shiny.ens-paris-saclay.fr/guni/v2/mcp/mcp',
      changeOrigin: true,
      secure: true,
      followRedirects: true,
      pathRewrite: {
        '^/mcp-proxy': '',
        '^/': '',
      },
    })
  );
};