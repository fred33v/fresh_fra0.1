'use strict';

// GHSA-gcqx-w48m-w2h4: deepmerge <= 4.3.1 lets a "__proto__" key in merged
// input replace the prototype of the returned object. No fixed release
// exists, so patches/deepmerge@4.3.1.patch blocks the key. These tests fail
// if the patch is not applied.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

const fs = require('node:fs');

// Every copy of deepmerge that pnpm installed, whichever package uses it.
const store = path.resolve(__dirname, '../../node_modules/.pnpm');
const copies = fs
  .readdirSync(store)
  .filter((name) => name.startsWith('deepmerge@'))
  .map((name) => path.join(store, name, 'node_modules/deepmerge'));

test('at least one installed copy of deepmerge was found', () => {
  assert.ok(copies.length > 0);
});

const hostile = () => JSON.parse('{"safe":1,"__proto__":{"polluted":"yes"},"nested":{"__proto__":{"polluted":"yes"}}}');

for (const copy of copies) {
  const fromConsumer = createRequire(path.join(copy, 'package.json'));
  const name = path.basename(path.dirname(path.dirname(copy)));

  for (const entry of ['./dist/cjs.js', './dist/umd.js']) {
    const merge = fromConsumer(entry);
    const label = `${name} ${entry}`;

    test(`${label}: is version 4.3.1 (update the patch if this changes)`, () => {
      assert.equal(fromConsumer('./package.json').version, '4.3.1');
    });

    test(`${label}: hostile source cannot change the result's prototype`, () => {
      const out = merge({ a: 1 }, hostile());
      assert.equal(Object.getPrototypeOf(out), Object.prototype);
      assert.equal(out.polluted, undefined);
      assert.equal(Object.getPrototypeOf(out.nested), Object.prototype);
      assert.equal(out.nested.polluted, undefined);
      assert.equal(out.safe, 1);
      assert.equal(out.a, 1);
    });

    test(`${label}: hostile target cannot change the result's prototype`, () => {
      const out = merge(hostile(), { b: 2 });
      assert.equal(Object.getPrototypeOf(out), Object.prototype);
      assert.equal(out.polluted, undefined);
      assert.equal(out.nested.polluted, undefined);
      assert.equal(out.b, 2);
    });

    test(`${label}: merge.all and clone:false are covered`, () => {
      const all = merge.all([{}, hostile(), { c: 3 }]);
      assert.equal(all.polluted, undefined);
      assert.equal(all.nested.polluted, undefined);
      const noClone = merge({}, hostile(), { clone: false });
      assert.equal(Object.getPrototypeOf(noClone), Object.prototype);
      assert.equal(noClone.polluted, undefined);
    });

    test(`${label}: Object.prototype is not polluted`, () => {
      merge({}, hostile());
      assert.equal({}.polluted, undefined);
    });

    test(`${label}: ordinary merging still works`, () => {
      assert.deepEqual(
        merge({ a: { x: 1 }, list: [1] }, { a: { y: 2 }, list: [2] }),
        { a: { x: 1, y: 2 }, list: [1, 2] },
      );
    });
  }
}
