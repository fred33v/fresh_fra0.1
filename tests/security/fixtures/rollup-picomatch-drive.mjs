// Child process for rollup-picomatch-redos.test.cjs: drives one of Rollup's bundled
// copies of picomatch through Rollup's public API, so a slow match fails the test by
// timeout instead of hanging it.
//
//   node rollup-picomatch-drive.mjs <rollupDir> <cjs|esm> <filter|watch> <n> <pattern>
//
// ENTRY_NAME overrides the entry file name (default: `a` repeated <n> times, then `b.js`).
// filter: a plugin `transform` hook filter, matched against each module id.
// watch:  `watch.chokidar.ignored`, anchored to `cwd`, matched against watched paths.
// Prints one JSON line; `handlerCalls` is how often the hook ran (filter route only).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [, , dir, flavor, route, n, pattern] = process.argv;
const rollup = flavor === 'cjs'
  ? createRequire(import.meta.url)(path.join(dir, 'dist/rollup.js'))
  : await import(path.join(dir, 'dist/es/rollup.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rollup-picomatch-'));
const entry = path.join(tmp, process.env.ENTRY_NAME || `${'a'.repeat(Number(n))}b.js`);
fs.writeFileSync(entry, 'export const x = 1;');

const start = process.hrtime.bigint();
const elapsed = () => Number(process.hrtime.bigint() - start) / 1e6;

let result;
if (route === 'filter') {
  let handlerCalls = 0;
  const bundle = await rollup.rollup({
    input: entry,
    onwarn() {},
    plugins: [{
      name: 'filter-probe',
      transform: { filter: { id: pattern }, handler() { handlerCalls++; return null; } },
    }],
  });
  await bundle.close();
  result = { handlerCalls, ms: elapsed() };
} else {
  const watcher = rollup.watch({
    input: entry,
    onwarn() {},
    output: { file: path.join(tmp, 'out.js'), format: 'es' },
    watch: { chokidar: { cwd: tmp, ignored: pattern } },
  });
  await new Promise((resolve, reject) => watcher.on('event', (event) => {
    if (event.code === 'END') resolve();
    else if (event.code === 'ERROR') reject(event.error);
  }));
  result = { ms: elapsed() };
  await watcher.close();
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ flavor, route, n: Number(n), pattern, ...result }));
process.exit(0);
