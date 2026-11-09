"use strict";

module.exports = {
  hooks: {
    readPackage(pkg) {
      if (
        pkg.name === "expo-router" &&
        pkg.version === "6.0.23" &&
        pkg.dependencies?.["query-string"] === "^7.1.3"
      ) {
        delete pkg.dependencies["query-string"];
      }

      return pkg;
    }
  }
};
