'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '../../apps/fra-training-app');
const routerPackage = require.resolve('expo-router/package.json', {
  paths: [appRoot]
});
const queryString = require(
  path.join(path.dirname(routerPackage), 'build/fork/safeQueryString.js')
);

test('URL spaces are encoded correctly', () => {
  assert.equal(queryString.stringify({ q: 'hello world' }), 'q=hello%20world');
});

test('Multiple query parameters are serialized', () => {
  assert.equal(queryString.stringify({ b: '2', a: '1' }), 'a=1&b=2');
});

test('Array parameters are preserved', () => {
  assert.equal(
    queryString.stringify({ tag: ['one', 'two'] }),
    'tag=one&tag=two'
  );
});

test('Default sorting does not throw and sorts alphabetically', () => {
  assert.equal(
    queryString.stringify({ z: 'last', a: 'first' }),
    'a=first&z=last'
  );
});

test('Sorting can be disabled', () => {
  assert.equal(
    queryString.stringify({ z: 'last', a: 'first' }, { sort: false }),
    'z=last&a=first'
  );
});

test('Custom sorting functions are supported', () => {
  assert.equal(
    queryString.stringify(
      { a: 'first', z: 'last' },
      { sort: (a, b) => b.localeCompare(a) }
    ),
    'z=last&a=first'
  );
});
