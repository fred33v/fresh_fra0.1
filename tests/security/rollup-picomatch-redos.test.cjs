'use strict';

// GHSA-fc5q-39xc-vjpf / CVE-2026-112366 in Rollup's own copies of picomatch.
//
// Rollup bundles picomatch into its dist files, so patches/picomatch@*.patch
// cannot reach it. It has six copies: one each in dist/shared/rollup.js and
// dist/es/shared/node-entry.js (picomatch 4.x, used for plugin hook filters), and
// two each in dist/shared/index.js and dist/es/shared/watch.js (picomatch 2.x,
// inside the bundled chokidar, used for watch.chokidar.ignored). patches/rollup@4.68.0.patch
// applies the same fix as the picomatch patches to all six. These tests drive each
// route through Rollup's public API, in the CommonJS and ES builds, and fail if the
// patch is not applied.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Every copy of rollup that pnpm installed, whichever package uses it.
const store = path.resolve(__dirname, '../../node_modules/.pnpm');
const copies = fs
  .readdirSync(store)
  .filter((name) => name.startsWith('rollup@'))
  .map((name) => ({
    name: name.replace(/_patch_hash=.*$/, ''),
    dir: path.join(store, name, 'node_modules/rollup'),
  }));

const driver = path.join(__dirname, 'fixtures/rollup-picomatch-drive.mjs');

// Runs in a child process, so a regression fails the test instead of hanging it.
const drive = (dir, flavor, route, n, pattern, entryName = '') => {
  const run = spawnSync(process.execPath, [driver, dir, flavor, route, String(n), pattern], {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, ENTRY_NAME: entryName },
  });
  if (run.error || run.status !== 0) return { hung: true, stderr: run.stderr };
  return JSON.parse(run.stdout.trim().split('\n').pop());
};

test('at least one installed copy of rollup was found', () => {
  assert.ok(copies.length > 0);
});

// Where the bundled copies live, and how many of each (see the header).
const bundles = {
  'dist/shared/rollup.js': 1,
  'dist/es/shared/node-entry.js': 1,
  'dist/shared/index.js': 2,
  'dist/es/shared/watch.js': 2,
};
const count = (text, needle) => text.split(needle).length - 1;

// A failing 30-character name makes the unpatched match run for many minutes.
const N = 30;
const hostileFilters = ['**/+(*a)', '**/*(*a)', '**/+(a*)c', '**/+(*a|b)c', '**/+(*a|*b)'];
const hostileIgnored = ['+(*a)', '+(a*)c'];

// Patterns people really write for a hook filter; the patch must not change them.
const ordinary = [
  ['**/*.js', 1], ['**/*.css', 0], ['**/@(ab|x.test).js', 1], ['**/?(*.)+(spec|test).js', 1],
  ['**/+(spec|test).js', 0], ['**/{x.test,cd}.js', 1], ['**/!(*.css)', 1], ['**/*(a|b)*.js', 1],
];

for (const { name, dir } of copies) {
  test(`${name}: is the version the patch covers (update the patch if this changes)`, () => {
    assert.equal(require(path.join(dir, 'package.json')).version, '4.68.0');
  });

  test(`${name}: every bundled picomatch copy carries the guard`, () => {
    for (const [file, expected] of Object.entries(bundles)) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      assert.equal(count(text, 'const analyzeRepeatedExtglob = '), expected, `${file}: copies of picomatch`);
      assert.equal(count(text, 'const hasBareStar = '), expected, `${file}: helper`);
      assert.equal(count(text, 'if (hasBareStar(branch))'), expected, `${file}: guard`);
    }
  });

  for (const flavor of ['cjs', 'esm']) {
    for (const pattern of hostileFilters) {
      test(`${name} ${flavor}: hook filter ${pattern} fails fast on a hostile module name`, () => {
        const out = drive(dir, flavor, 'filter', N, pattern);
        assert.equal(out.hung, undefined, 'matching did not finish within 10 seconds');
        assert.ok(out.ms < 3000, `took ${out.ms} ms`);
        assert.equal(out.handlerCalls, 0);
      });
    }

    for (const pattern of hostileIgnored) {
      test(`${name} ${flavor}: watch.chokidar.ignored ${pattern} fails fast on a hostile file name`, () => {
        const out = drive(dir, flavor, 'watch', N, pattern);
        assert.equal(out.hung, undefined, 'matching did not finish within 10 seconds');
        assert.ok(out.ms < 3000, `took ${out.ms} ms`);
      });
    }

    for (const [pattern, calls] of ordinary) {
      test(`${name} ${flavor}: hook filter ${pattern} still ${calls ? 'matches' : 'skips'} x.test.js`, () => {
        const out = drive(dir, flavor, 'filter', 1, pattern, 'x.test.js');
        assert.equal(out.hung, undefined);
        assert.equal(out.handlerCalls, calls);
      });
    }

    test(`${name} ${flavor}: a risky repeated extglob is matched as literal text`, () => {
      assert.equal(drive(dir, flavor, 'filter', 1, '**/+(*.js)', 'x.test.js').handlerCalls, 0);
    });

    test(`${name} ${flavor}: watch.chokidar.ignored still accepts an ordinary pattern`, () => {
      const out = drive(dir, flavor, 'watch', 1, '*.css', 'x.test.js');
      assert.equal(out.hung, undefined);
    });
  }
}
