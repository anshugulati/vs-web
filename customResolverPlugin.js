const path = require('path');
const fs = require('fs');

// Plugin to resolve brand specific css for react app
class CustomResolverPlugin {
  constructor(options) {
    this.options = options || {};
  }

  isResolvable(request) {
    return this.options.brand !== 'default'
      && request.request.endsWith('.css')
      && !request.path.endsWith('.css')
      && !request.path.endsWith(`/${this.options.brand}`);
  }

  apply(resolver) {
    resolver.hooks.resolve.tapAsync('CustomResolverPlugin', (request, context, callback) => {
      try {
        if (this.isResolvable(request)) {
          const originalfilePath = path.join(request.path, request.request);
          const dirname = path.dirname(originalfilePath);
          const fileName = path.basename(originalfilePath);
          const newfilePath = path.join(dirname, this.options.brand, fileName);
          if (fs.existsSync(newfilePath)) {
            request.request = newfilePath;
            console.log('CustomResolverPlugin - resolving path ', newfilePath);
          }
        }
      } catch (error) {
        console.error('Error resolving path:', error);
      }
      return callback();
    });
  }
}

module.exports = CustomResolverPlugin;
