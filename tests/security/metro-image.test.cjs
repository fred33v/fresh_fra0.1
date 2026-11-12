'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '../../apps/fra-mobile-app');
const expoPackage = require.resolve('expo/package.json', { paths: [appRoot] });
const cliPackage = require.resolve('@expo/cli/package.json', {
  paths: [path.dirname(expoPackage)]
});
const metroPackage = require.resolve('metro/package.json', {
  paths: [path.dirname(cliPackage)]
});
const metroAssets = require(path.join(path.dirname(metroPackage), 'src/Assets.js'));

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
  'base64'
);

const webp = Buffer.from(
  '524946461600000057454250565038580a00000000000000010000020000',
  'hex'
);

test('PNG dimensions are preserved', () => {
  assert.deepEqual(metroAssets.getAssetSize('png', png, 'test.png'), {
    width: 1,
    height: 1
  });
});

test('JPEG dimensions are preserved', () => {
  const jpeg = fs.readFileSync(
    path.join(__dirname, 'fixtures/sample.jpg')
  );
  assert.deepEqual(
    metroAssets.getAssetSize('jpg', jpeg, 'sample.jpg'),
    { width: 640, height: 360 }
  );
});

test('SVG dimensions are preserved', () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"></svg>'
  );

  assert.deepEqual(metroAssets.getAssetSize('svg', svg, 'test.svg'), {
    width: 120,
    height: 80
  });
});

test('WebP dimensions are preserved', () => {
  assert.deepEqual(metroAssets.getAssetSize('webp', webp, 'test.webp'), {
    width: 2,
    height: 3
  });
});

test('Malformed images are rejected', () => {
  assert.throws(() =>
    metroAssets.getAssetSize('png', Buffer.from('not-a-valid-image'), 'invalid.png')
  );
});

test('Empty image files are rejected', () => {
  assert.throws(() =>
    metroAssets.getAssetSize('png', Buffer.alloc(0), 'empty.png')
  );
});

test('Asset scaling and hashing are preserved', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metro-security-'));

  try {
    fs.writeFileSync(path.join(dir, 'sample.png'), png);
    fs.writeFileSync(path.join(dir, 'sample@2x.png'), png);

    const data = await metroAssets.getAssetData(
      path.join(dir, 'sample.png'),
      'assets/sample.png',
      [],
      null,
      '/assets'
    );

    assert.equal(data.width, 1);
    assert.equal(data.height, 1);
    assert.deepEqual(data.scales, [1, 2]);
    assert.deepEqual(data.files.map(file => path.basename(file)), [
      'sample.png',
      'sample@2x.png'
    ]);
    assert.match(data.hash, /^[a-f0-9]{32}$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
