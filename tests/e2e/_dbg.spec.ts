import { test } from '@playwright/test';
import { installApiMock } from './_helpers';

test('debug', async ({ page }) => {
  page.on('console', (msg) => console.log('[browser]', msg.type(), msg.text()));
  page.on('pageerror', (e) => console.log('[err]', e.message));
  await installApiMock(page);
  await page.goto('/');
  await page.waitForTimeout(2000);
  const html = await page.locator('body').innerHTML();
  console.log('BODY[0..3000]:', html.slice(0, 3000));
});
