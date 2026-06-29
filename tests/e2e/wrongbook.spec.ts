import { test, expect } from '@playwright/test';
import { installApiMock, sampleWrong } from './_helpers';

test.describe('WrongBook 页面', () => {
  test('空状态', async ({ page }) => {
    await installApiMock(page, { wrong: [] });
    await page.goto('/#/wrong');
    await expect(page.getByRole('heading', { name: '错题本' })).toBeVisible();
    await expect(page.getByText('还没有错题。做错题后会出现在这里。')).toBeVisible();
  });

  test('列出错题并显示你的错误答案与正确答案', async ({ page }) => {
    await installApiMock(page, { wrong: sampleWrong });
    await page.goto('/#/wrong');
    await page.getByRole('button', { name: /历史简答/ }).click();
    await expect(page.getByText('中国的首都是？')).toBeVisible();
    await expect(page.getByText('你的答案')).toBeVisible();
    await expect(page.getByText('A. 上海')).toBeVisible();
    await expect(page.getByText('正确答案')).toBeVisible();
    await expect(page.getByText('B. 北京')).toBeVisible();
    await expect(page.getByRole('button', { name: '重做' })).toBeVisible();
  });

  test('点击重做跳转到对应文档的 Practice 页面', async ({ page }) => {
    await installApiMock(page, {
      wrong: sampleWrong,
      questions: [],
      documents: [],
    });
    await page.goto('/#/wrong');
    await page.getByRole('button', { name: /历史简答/ }).click();
    await page.getByRole('button', { name: '重做' }).click();
    await expect(page).toHaveURL(/#\/practice\/2\?from=wrong/);
  });
});
