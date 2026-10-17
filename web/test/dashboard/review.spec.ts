import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard/preview');
  await expect(page.getByRole('heading', { name: 'Looking out for Rosa' })).toBeVisible();
});

test('keyboard deny announces the result and preserves focus after the card changes', async ({ page }) => {
  await page.getByRole('button', { name: 'Approve', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Deny', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#decision-status')).toHaveText('Denied. The payment will not go through.');
  await expect(page.locator('#decision-status')).toBeFocused();
  await expect(page.getByRole('article')).toContainText('Denied');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
});

test('approval updates the state; partial approval keeps the card waiting', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Two approvers' }).check();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('article')).toContainText('It still needs another approver.');
  await expect(page.getByRole('article')).toContainText('Waiting for family');
  await page.getByRole('checkbox', { name: 'Two approvers' }).uncheck();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.locator('#decision-status')).toHaveText('Approved. The payment is on its way.');
  await expect(page.locator('#decision-status')).toBeFocused();
});

test('Guardian and viewer modes expose only the permitted controls', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Guardian required' }).check();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Deny', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toContainText('Guardian notification');
  await page.getByRole('checkbox', { name: 'Viewer', exact: true }).check();
  await expect(page.getByRole('article').getByRole('button')).toHaveCount(0);
});

test('shows the cash and gift-card sequence on a phone-width held card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('checkbox', { name: 'ATM sequence' }).check();
  const timeline = page.getByRole('region', { name: 'Cash then gift card sequence' });
  await expect(timeline).toContainText('$200.00 cash');
  await expect(timeline).toContainText('$500.00 gift card request');
  await expect(timeline).toContainText('Demo ATM (synthetic)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('section[aria-labelledby="preview-title"]').screenshot({ path: path.resolve('../docs/gallery/dashboard-sequence-390.png'), style: 'nextjs-portal { display: none; }' });
});

test('expiry disables stale decisions and refreshes server state once', async ({ page }) => {
  await page.clock.install();
  let refreshes = 0;
  page.on('request', (request) => {
    if (request.url().includes('/dashboard/preview') && request.headers()['rsc'] === '1') refreshes++;
  });
  await page.getByRole('button', { name: 'Expire in two seconds' }).click();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
  await page.clock.fastForward(3000);
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Deny', exact: true })).toBeDisabled();
  await expect(page.getByRole('article')).toContainText('Time is up. Checking payment status.');
  await expect.poll(() => refreshes).toBe(1);
  await page.clock.fastForward(10000);
  expect(refreshes).toBe(1);
  // A new hold deadline must not inherit the old timer's expired state.
  await page.getByRole('button', { name: 'Expire in two seconds' }).click();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
});

test('decision text meets contrast requirements and the card fits at 200% text size', async ({ page }) => {
  for (const name of ['Approve', 'Deny']) {
    const ratio = await page.getByRole('button', { name, exact: true }).evaluate((button) => {
      const style = getComputedStyle(button);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      const luminance = (color: string) => {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
      };
      const text = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.getByRole('checkbox', { name: 'Long payee name' }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const width of [390, 1440]) {
  test(`gallery at ${width}px: all required states, focus and long-name layout`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    const gallery = path.resolve('../docs/gallery');
    await mkdir(gallery, { recursive: true });
    for (const [state, label] of [['held', 'Waiting for family'], ['approved', 'Approved'], ['denied', 'Denied'], ['expired', 'Expired, blocked']] as const) {
      await page.getByRole('button', { name: `Show ${state}`, exact: true }).click();
      await expect(page.getByRole('article')).toContainText(label);
      await page.locator('section[aria-labelledby="preview-title"]').screenshot({ path: path.join(gallery, `dashboard-review-${width}-${state}.png`), style: 'nextjs-portal { display: none; }' });
    }
    await page.getByRole('button', { name: 'Show held', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Long payee name' }).check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('article')).toContainText('$500.00');
    await page.getByRole('button', { name: 'Approve', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Deny', exact: true })).toBeFocused();
    await page.locator('section[aria-labelledby="preview-title"]').screenshot({ path: path.join(gallery, `dashboard-review-${width}-keyboard-long-name.png`), style: 'nextjs-portal { display: none; }' });
  });
}
