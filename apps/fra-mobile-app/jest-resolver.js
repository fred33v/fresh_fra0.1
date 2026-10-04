// Workspace packages (packages/*) are written for TypeScript's NodeNext rules, so their source
// imports siblings as "./colors.js" while the file on disk is colors.ts. Tests read that source
// directly (like Metro and tsc), so retry such imports without the extension. Same rule as
// metro.config.js.
module.exports = (request, options) => {
  if (request.startsWith('.') && request.endsWith('.js') && options.basedir.includes('/packages/')) {
    try {
      return options.defaultResolver(request.slice(0, -3), options);
    } catch {
      // fall through to the import as written
    }
  }
  return options.defaultResolver(request, options);
};
