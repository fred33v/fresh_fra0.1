// Renders the downloadable resources (resources/*.html) to A4 PDFs in public/resources/.
// Run after editing a document: pnpm build:resources
// Uses the backend's Puppeteer, so the web app gains no browser dependency.
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'resources');
const output = join(root, 'public', 'resources');
const requireFromBackend = createRequire(join(root, '..', 'fra-backend', 'backend', 'package.json'));
const puppeteer = requireFromBackend('puppeteer');

mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ headless: true });
try {
  for (const file of readdirSync(source).filter((f) => f.endsWith('.html'))) {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.goto(pathToFileURL(join(source, file)).href, { waitUntil: 'load' });
    const target = join(output, file.replace(/\.html$/, '.pdf'));
    await page.pdf({ path: target, format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.close();
    console.log(`wrote ${target.slice(root.length + 1)}`);
  }
} finally {
  await browser.close();
}
