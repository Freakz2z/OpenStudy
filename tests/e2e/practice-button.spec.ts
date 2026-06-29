import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

test.describe('做题按钮', () => {
  test('question_count > 0 时按钮可点击且跳转 /practice/:id', async ({ page }) => {
    await installApiMock(page, {
      documents: [{ ...sampleDocs[1], question_count: 5 }],
      questions: sampleQuestions,
    });
    await page.goto('/#/library');
    const card = page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    const btn = card.getByRole('button', { name: '做题' });
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(page).toHaveURL(/#\/practice\/2/);
  });

  test('question_count === 0 时禁用做题按钮', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[0]], // question_count = 0
      questions: [],
    });
    await page.goto('/#/library');
    const card = page
      .getByText('代数练习题')
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    const btn = card.getByRole('button', { name: '做题' });
    await expect(btn).toBeDisabled();
  });

  test('识别后 question_count 提升 → 做题按钮可跳转到题目页', async ({ page }) => {
    let count = 0;
    await page.exposeFunction('__setCount', (n: number) => {
      count = n;
    });
    await page.exposeFunction('__getCount', () => count);
    await installApiMock(page, {
      documents: [],
      questions: sampleQuestions,
      overrides: {
        listDocuments: `async function() {
          return [{
            id: 1, file_path: '/tmp/x.pdf', file_type: 'pdf',
            title: '测试文档', imported_at: Date.now(),
            question_count: await window.__getCount()
          }];
        }`,
        identifyQuestions: `async function() {
          await window.__setCount(5);
          return [];
        }`,
      },
    });
    await page.goto('/#/library');
    const card = page
      .getByText('测试文档')
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    await card.getByRole('button', { name: '识别题目' }).click();
    await card.getByRole('button', { name: '做题' }).click();
    await expect(page).toHaveURL(/#\/practice\/1/);
  });
});
