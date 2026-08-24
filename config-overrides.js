module.exports = function override(config) {
  if (config.output) {
    config.output.sourceMapFilename = '[file].map';
  }

  const oneOfRule = config.module.rules.find((rule) => rule.oneOf);
  if (oneOfRule) {
    oneOfRule.oneOf.forEach((rule) => {
      if (Array.isArray(rule.use)) {
        rule.use.forEach((loader) => {
          if (loader && typeof loader === 'object' && loader.loader && loader.loader.includes('source-map-loader')) {
            loader.options = {
              ...loader.options,
              filterSourceMappingUrl: (url, resourcePath) => {
                if (resourcePath && resourcePath.includes('node_modules/autolinker')) return false;
                if (resourcePath && resourcePath.includes('node_modules/@modelcontextprotocol')) return false;
                return true;
              },
            };
          }
        });
      }
    });
  }

  return config;
};
