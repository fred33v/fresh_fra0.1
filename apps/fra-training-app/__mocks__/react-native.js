// Mock for react-native
const React = require('react');

const View = 'View';
const Text = 'Text';
const TouchableOpacity = 'TouchableOpacity';
const TouchableHighlight = 'TouchableHighlight';
const Pressable = 'Pressable';
const ScrollView = 'ScrollView';
const FlatList = 'FlatList';
const Image = 'Image';
const TextInput = 'TextInput';
const ActivityIndicator = 'ActivityIndicator';
const Switch = 'Switch';
const Modal = 'Modal';

const Linking = {
  openURL: jest.fn(),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
};

const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => style,
};

const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios || obj.default,
};

const Dimensions = {
  get: () => ({ width: 375, height: 667 }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const Animated = {
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  Value: jest.fn(() => ({
    setValue: jest.fn(),
    interpolate: jest.fn(() => ({ _value: 0 })),
  })),
  timing: jest.fn(() => ({
    start: jest.fn((callback) => callback && callback()),
  })),
  spring: jest.fn(() => ({
    start: jest.fn((callback) => callback && callback()),
  })),
  decay: jest.fn(() => ({
    start: jest.fn((callback) => callback && callback()),
  })),
  sequence: jest.fn(() => ({
    start: jest.fn((callback) => callback && callback()),
  })),
  parallel: jest.fn(() => ({
    start: jest.fn((callback) => callback && callback()),
  })),
  delay: jest.fn(() => ({
    start: jest.fn((callback) => callback && callback()),
  })),
  stagger: jest.fn(() => ({
    start: jest.fn((callback) => callback && callback()),
  })),
  loop: jest.fn(() => ({
    start: jest.fn((callback) => callback && callback()),
  })),
  event: jest.fn(() => jest.fn()),
  createAnimatedComponent: (Component) => Component,
};

const Easing = {
  linear: jest.fn(),
  ease: jest.fn(),
  quad: jest.fn(),
  cubic: jest.fn(),
  poly: jest.fn(),
  sin: jest.fn(),
  circle: jest.fn(),
  exp: jest.fn(),
  elastic: jest.fn(),
  back: jest.fn(),
  bounce: jest.fn(),
  bezier: jest.fn(),
  in: jest.fn(),
  out: jest.fn(),
  inOut: jest.fn(),
};

const Keyboard = {
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
};

const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (layoutSize) => layoutSize * 2,
  roundToNearestPixel: (layoutSize) => Math.round(layoutSize * 2) / 2,
};

const AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
};

const Touchable = {
  Mixin: {
    touchableGetInitialState: () => ({}),
    touchableHandlePress: jest.fn(),
    touchableHandleLongPress: jest.fn(),
    touchableHandleStartShouldSetResponder: jest.fn(),
    touchableHandleResponderTerminationRequest: jest.fn(),
    touchableHandleResponderGrant: jest.fn(),
    touchableHandleResponderMove: jest.fn(),
    touchableHandleResponderRelease: jest.fn(),
    touchableHandleResponderTerminate: jest.fn(),
  },
};

const processColor = (color) => color;

const PanResponder = {
  create: jest.fn(() => ({
    panHandlers: {},
  })),
};

module.exports = {
  View,
  Text,
  TouchableOpacity,
  TouchableHighlight,
  Pressable,
  ScrollView,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Switch,
  Modal,
  Linking,
  StyleSheet,
  Platform,
  Dimensions,
  Animated,
  Easing,
  Keyboard,
  PixelRatio,
  AppState,
  Touchable,
  processColor,
  PanResponder,
};
