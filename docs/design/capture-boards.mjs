// Render the original vector boards; no external content or image generation.
import { chromium } from '../../web/node_modules/@playwright/test/index.mjs';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 2070 }, deviceScaleFactor: 1 });
  await mkdir(new URL('../gallery/', import.meta.url), { recursive: true });
  for (const stage of ['sketch', 'wireframe', 'final']) {
    const svg = await readFile(new URL(`${stage}-board.svg`, import.meta.url), 'utf8');
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}svg{display:block}</style></head><body>${svg}</body></html>`);
    await page.screenshot({ path: fileURLToPath(new URL(`../gallery/design-${stage}.png`, import.meta.url)), fullPage: true });
  }
} finally { await browser.close(); }
console.log('Rendered three design gallery boards.');
