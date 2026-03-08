// Polyfills for React Native environment in Jest

// Mock global objects that React Native provides
global.window = global;
global.self = global;

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = (cb) => {
  setTimeout(cb, 0);
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Mock performance API
global.performance = {
  now: () => Date.now(),
};

// Mock IntersectionObserver (used by some libraries)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};
