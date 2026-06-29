import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

test.describe('Practice 完成页 - 重做错题按钮', () => {
  test('本轮有错题时显示「重做错题（N）」按钮', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions.slice(0, 2),
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    // 第 1 题答错
    await page.locator('label').filter({ hasText: 'A. 上海' }).click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    // 第 2 题答对
    const input = page.getByPlaceholder('输入答案');
    await input.click();
    await input.fill('李白');
    await input.press('Enter');
    await page.waitForTimeout(200);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    // 完成页：应有「重做错题（1）」按钮
    await expect(page.getByRole('button', { name: /重做错题.*1/ })).toBeVisible();
  });

  test('点「重做错题」按钮导航到 ?from=wrong 模式', async ({ page }) => {
    // 第 1 题作为错题进入错题本
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions.slice(0, 2),
      wrong: [
        {
          ...sampleQuestions[0],
          last_wrong_answer: 'A',
          last_wrong_at: Date.now(),
          document_title: '历史简答',
          document_file_type: 'docx',
        },
      ],
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.locator('label').filter({ hasText: 'A. 上海' }).click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    await page.getByPlaceholder('输入答案').fill('李白');
    await page.getByPlaceholder('输入答案').press('Enter');
    await page.waitForTimeout(200);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    // 点「重做错题」
    await page.getByRole('button', { name: /重做错题/ }).click();
    await expect(page).toHaveURL(/#\/practice\/2\?from=wrong/);
    await page.waitForTimeout(300);
    // 重做模式 banner
    await expect(page.getByText('重做模式：来自错题本')).toBeVisible();
    // 加载到错题（第 1 题）
    await expect(page.getByText('中国的首都是？')).toBeVisible();
  });

  test('本轮全对时不显示「重做错题」按钮', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions.slice(0, 2),
    });
    await page.goto('/#/practice/2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    // 第 1 题答对
    await page.locator('label').filter({ hasText: 'B. 北京' }).click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    // 第 2 题答对
    const input = page.getByPlaceholder('输入答案');
    await input.click();
    await input.fill('李白');
    await input.press('Enter');
    await page.waitForTimeout(200);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    await expect(page.getByText('完成！')).toBeVisible();
    await expect(page.getByRole('button', { name: /重做错题/ })).toHaveCount(0);
  });
});

test.describe('Library 错误重试精确化', () => {
  test('重试按钮调用出错文档的 ID（不是第一篇）', async ({ page }) => {
    let retriedWithId: number | null = null;
    await page.exposeFunction('__capture', (id: number) => {
      retriedWithId = id;
    });
    await page.exposeFunction('__getCapture', () => retriedWithId);
    await installApiMock(page, {
      documents: [sampleDocs[0], sampleDocs[1]], // 两个文档
      questions: [],
      overrides: {
        identifyQuestions: `async function(docId) {
          await window.__capture(docId);
          // 始终抛错，让重试按钮出现
          throw new Error('LLM 输出无法解析为合法 JSON');
        }`,
      },
    });
    await page.goto('/#/library');
    // 点第二篇文档的「识别题目」（id=2）
    const secondCard = page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    await secondCard.getByRole('button', { name: '识别题目' }).click();
    // 错误卡片出现 + 重试按钮
    const errorCard = page.locator('.card.error');
    await expect(errorCard).toBeVisible();
    const retryBtn = errorCard.getByRole('button', { name: '重试' });
    await expect(retryBtn).toBeVisible();
    // 点重试
    await retryBtn.click();
    // 验证重试调用的是第二篇文档（id=2），不是第一篇
    await expect.poll(() => retriedWithId).toBe(2);
  });
});
