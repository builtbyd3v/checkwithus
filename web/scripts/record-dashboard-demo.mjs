// Records the actual local UI fixture, never a live account or bank.
// Start npm run preview:dashboard in another terminal first.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const url = 'http://127.0.0.1:3106/dashboard/preview';
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Preview unavailable');
} catch {
  console.error('Start npm run preview:dashboard before recording. No live environment is used.');
  process.exit(1);
}
await mkdir(new URL('../../docs/gallery/', import.meta.url), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 1080 },
    recordVideo: { dir: fileURLToPath(new URL('../.next/demo-recordings/', import.meta.url)), size: { width: 960, height: 1080 } } });
  await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const start = Date.now();
  const page = await context.newPage();
  const captions = [];
  const step = async (caption, action) => {
    const from = Date.now() - start;
    if (action) await action();
    await page.waitForTimeout(4500); // Intentional viewing time in a recorded demo.
    captions.push({ from, to: Date.now() - start, caption });
  };
  await page.goto(url);
  await page.getByRole('heading', { name: 'Looking out for Rosa' }).waitFor();
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await step('Local dashboard backup demo. Synthetic family and simulated decisions; no money is sent.');
  await step('A gift-card request pauses after ATM cash. The family sees both steps and the times.', async () => {
    await page.getByRole('checkbox', { name: 'ATM sequence' }).check();
    await page.getByRole('article').scrollIntoViewIfNeeded();
  });
  await step('Deny stops the request and announces the result.', async () => {
    await page.getByRole('button', { name: 'Deny', exact: true }).click();
  });
  await step('A payment requiring two approvers stays waiting after the first yes.', async () => {
    await page.getByRole('button', { name: 'Show held', exact: true }).click();
    await page.getByRole('checkbox', { name: 'ATM sequence' }).uncheck();
    await page.getByRole('checkbox', { name: 'Two approvers' }).check();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByRole('article').scrollIntoViewIfNeeded();
  });
  await step('This simulated single-approval request changes to Approved.', async () => {
    await page.getByRole('checkbox', { name: 'Two approvers' }).uncheck();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
  });
  await step('An unanswered request expires and is blocked.', async () => {
    await page.getByRole('button', { name: 'Show expired', exact: true }).click();
    await page.getByRole('article').scrollIntoViewIfNeeded();
  });
  await step('When Guardian is required, the dashboard offers Deny and directs approval to the enrolled phone.', async () => {
    await page.getByRole('button', { name: 'Show held', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Guardian required' }).check();
    await page.getByRole('article').scrollIntoViewIfNeeded();
  });
  const video = page.video();
  await context.close();
  if (!video) throw new Error('Video was not recorded');
  await video.saveAs(fileURLToPath(new URL('../../docs/gallery/dashboard-backup.webm', import.meta.url)));
  const stamp = (ms) => new Date(ms).toISOString().slice(11, 23).replace('.', ',');
  await writeFile(new URL('../../docs/gallery/dashboard-backup.srt', import.meta.url), captions.map((c, index) => `${index + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.caption}\n`).join('\n'));
  console.log(`Recorded ${Math.round((Date.now() - start) / 1000)}s synthetic UI demo and matching SRT captions in docs/gallery.`);
} finally { await browser.close(); }
