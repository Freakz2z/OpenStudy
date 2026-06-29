import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs } from './_helpers';

test.describe('识别阶段', () => {
  test('重复识别 → 主进程会清空旧题再插入（行为契约）', async ({ page }) => {
    // 用 Node 端持久化的 callCount（exposeFunction 让 mock 能读到）
    let callCount = 0;
    await page.exposeFunction('__bumpCall', () => {
      callCount++;
    });
    await page.exposeFunction('__getCallCount', () => callCount);
    await installApiMock(page, {
      documents: [sampleDocs[0]],
      questions: [],
      overrides: {
        identifyQuestions: `async function() {
          await window.__bumpCall();
          const n = await window.__getCallCount();
          return Array.from({length: 5}, (_, i) => ({
            id: 100 * n + i, document_id: 1, type: 'fill',
            stem: 'Q' + n + '-' + i, options: null, answer: 'A' + i,
            explanation: null, page_or_section: null, position: i
          }));
        }`,
      },
    });
    await page.goto('/#/library');
    const card = page
      .getByText(sampleDocs[0].title)
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    await card.getByRole('button', { name: '识别题目' }).click();
    await expect(card.getByRole('button', { name: '识别题目' })).toBeEnabled();
    await card.getByRole('button', { name: '识别题目' }).click();
    await expect(card.getByRole('button', { name: '识别题目' })).toBeEnabled();
    expect(callCount).toBe(2);
  });

  test('识别中按钮显示「识别中…」且不可重复点击', async ({ page }) => {
    // 让 identify 延迟 300ms，给 loading 状态可见的窗口
    await installApiMock(page, {
      documents: [sampleDocs[0]],
      questions: [],
      overrides: {
        identifyQuestions: `async function() {
          await new Promise(r => setTimeout(r, 300));
          return [];
        }`,
      },
    });
    await page.goto('/#/library');
    const card = page
      .getByText(sampleDocs[0].title)
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    await card.getByRole('button', { name: '识别题目' }).click();
    await expect(card.getByRole('button', { name: '识别中…' })).toBeVisible();
    await expect(card.getByRole('button', { name: '识别中…' })).toBeDisabled();
    // 完成后恢复
    await expect(card.getByRole('button', { name: '识别题目' })).toBeEnabled();
  });

  test('识别返回空数组时显示明确提示', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[0]],
      questions: [],
    });
    await page.goto('/#/library');
    const card = page
      .getByText(sampleDocs[0].title)
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    await card.getByRole('button', { name: '识别题目' }).click();
    await expect(page.getByText(/识别完成但未找到题目/)).toBeVisible();
  });

  test('识别失败时显示错误信息，按钮恢复可点', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[0]],
      questions: [],
      overrides: {
        identifyQuestions: `async function() { throw new Error('LLM 输出无法解析为合法 JSON'); }`,
      },
    });
    await page.goto('/#/library');
    const card = page
      .getByText(sampleDocs[0].title)
      .locator('xpath=ancestor::div[contains(@class,"card")]');
    await card.getByRole('button', { name: '识别题目' }).click();
    await expect(page.getByText(/LLM 输出无法解析/)).toBeVisible();
    await expect(card.getByRole('button', { name: '识别题目' })).toBeEnabled();
  });
});
