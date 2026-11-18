'use strict';

// GHSA-fc5q-39xc-vjpf / CVE-2026-112366: picomatch <= 4.0.7 compiles a repeated
// extglob whose branch holds a bare `*` (for example `+(*a)`) to a regular
// expression with nested unbounded quantifiers, so a failed match runs for
// exponential time and blocks Node.js. No fixed release exists, so
// patches/picomatch@*.patch treat such a pattern as literal text, the way
// picomatch already treats its other risky repeated extglobs. These tests fail
// if the patch is not applied.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Every copy of picomatch that pnpm installed, whichever package uses it.
const store = path.resolve(__dirname, '../../node_modules/.pnpm');
const copies = fs
  .readdirSync(store)
  .filter((name) => name.startsWith('picomatch@'))
  .map((name) => ({
    name: name.replace(/_patch_hash=.*$/, '').replace(/\(.*$/, ''),
    dir: path.join(store, name, 'node_modules/picomatch'),
  }));

test('at least one installed copy of picomatch was found', () => {
  assert.ok(copies.length > 0);
});

// Matches in a child process, so a regression fails the test instead of hanging it.
const timeMatch = (dir, pattern, input) => {
  const script = `
    const pm = require(${JSON.stringify(dir)});
    const start = process.hrtime.bigint();
    const result = pm.isMatch(process.argv[1], process.argv[2]);
    console.log(JSON.stringify({ result, ms: Number(process.hrtime.bigint() - start) / 1e6 }));
  `;
  const run = spawnSync(process.execPath, ['-e', script, input, pattern], { encoding: 'utf8', timeout: 5000 });
  if (run.error || run.status !== 0) return { hung: true };
  return JSON.parse(run.stdout);
};

// Shapes that were exponential before the patch: the advisory's patterns first.
const hostile = [
  '+(*a)', '*(*a)', '+(*)', '+(*a)c', '+(a*)c', '+(*a*)c', '+(**)c', '+(*?)c',
  '+(*a|b)c', '+(*a|*b)', '*(a|*b)', '*(a*)c',
];
// A failing input: a long run of `a` that cannot satisfy the pattern.
const input = `${'a'.repeat(32)}b`;

// Patterns people really write; the patch must not change what they match.
const ordinary = [
  ['+(a|b)', 'abba', true], ['+(a|b)', 'abc', false], ['*(a|b)', 'ab', true],
  ['@(foo|bar).js', 'foo.js', true], ['!(a|b).js', 'c.js', true], ['!(a|b).js', 'a.js', false],
  ['?(a)b', 'b', true], ['+(ab)', 'abab', true], ['src/*.js', 'src/x.js', true],
  ['*.js', 'x.js', true], ['**/*.test.ts', 'a/b/c.test.ts', true], ['+(x)*.js', 'xxa.js', true],
  ['*(a)b', 'aaab', true], ['+([ab])', 'abba', true],
  ['file+(1|2).txt', 'file12.txt', true], ['+(.js|.ts)', '.js.ts', true],
];

for (const { name, dir } of copies) {
  const pm = require(dir);

  test(`${name}: is a version the patch covers (update the patch if this changes)`, () => {
    assert.ok(['2.3.2', '4.0.7'].includes(require(path.join(dir, 'package.json')).version));
  });

  for (const pattern of hostile) {
    test(`${name}: ${pattern} fails fast on a hostile input`, () => {
      const out = timeMatch(dir, pattern, input);
      assert.equal(out.hung, undefined, 'matching did not finish within 5 seconds');
      assert.ok(out.ms < 500, `took ${out.ms} ms`);
      assert.equal(out.result, false);
    });
  }

  test(`${name}: a risky repeated extglob is matched as literal text`, () => {
    assert.equal(pm.isMatch('+(*a)', '+(*a)'), true);
    assert.equal(pm.isMatch('xa', '+(*a)'), false);
  });

  for (const [pattern, text, expected] of ordinary) {
    test(`${name}: ${pattern} still ${expected ? 'matches' : 'rejects'} ${text}`, () => {
      assert.equal(pm.isMatch(text, pattern), expected);
    });
  }
}
