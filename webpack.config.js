module.exports = {
  devtool: false,
  module: {
    rules: [
      {
        test: /\.(js|mjs|jsx|ts|tsx)$/, 
        enforce: 'pre',
        exclude: /node_modules\/((?!autolinker|@modelcontextprotocol).)*/,
        use: [{
          loader: require.resolve('source-map-loader'),
          options: {
            filterSourceMappingUrl: (url, resourcePath) => {
              if (resourcePath && resourcePath.includes('node_modules/autolinker')) return false;
              if (resourcePath && resourcePath.includes('node_modules/@modelcontextprotocol')) return false;
              return true;
            },
          },
        }],
      },
    ],
  },
};
