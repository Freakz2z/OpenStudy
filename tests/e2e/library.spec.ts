import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

test.describe('Library 页面', () => {
  test('空状态正常显示', async ({ page }) => {
    await installApiMock(page, { documents: [] });
    await page.goto('/#/library');
    await expect(page.getByRole('heading', { name: '题库' })).toBeVisible();
    await expect(page.getByText('还没有文档。')).toBeVisible();
    await expect(page.getByRole('button', { name: '导入文档' })).toBeVisible();
  });

  test('列出已导入文档', async ({ page }) => {
    await installApiMock(page, {
      documents: sampleDocs,
      questions: sampleQuestions,
    });
    await page.goto('/#/library');
    await expect(page.getByText('代数练习题')).toBeVisible();
    await expect(page.getByText('历史简答')).toBeVisible();
    await expect(page.getByText(/题目数：5/)).toBeVisible();
    await expect(page.getByText(/题目数：0/)).toBeVisible();
  });

  test('侧边栏导航到所有页面', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/#/library');
    await expect(page.getByRole('link', { name: '题库', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '错题本' })).toBeVisible();
    await expect(page.getByRole('link', { name: '设置' })).toBeVisible();
  });

  test('点击「识别题目」调用 API 并刷新列表', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[0]],
      questions: sampleQuestions,
    });
    await page.goto('/#/library');
    await expect(page.getByText('代数练习题')).toBeVisible();
    await page.getByRole('button', { name: '识别题目' }).click();
    await expect(page.getByRole('button', { name: '识别题目' })).toBeEnabled({ timeout: 10000 });
    const calls = await page.evaluate(
      () => (window as unknown as { __testHooks: { identifyCalls: number[] } }).__testHooks.identifyCalls,
    );
    expect(calls).toEqual([1]);
  });

  test('重置进度会清空该文档的本地做题缓存与问 AI 记录', async ({ page }) => {
    let resetCalledWith: number | null = null;
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('重置该文档的做题进度');
      await dialog.accept();
    });
    await page.exposeFunction('__onResetProgress', (id: number) => {
      resetCalledWith = id;
    });
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: [sampleQuestions[0]],
      overrides: {
        resetDocumentProgress: `async (id) => { await window.__onResetProgress(id); return { ok: true, removed: 1 }; }`,
      },
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        'openstudy:practice:2:attempts',
        JSON.stringify([
          {
            questionId: 101,
            userAnswer: 'B. 北京',
            isCorrect: true,
            feedback: null,
            attemptedAt: Date.now(),
          },
        ]),
      );
      localStorage.setItem(
        'openstudy:practice-chat:v1',
        JSON.stringify({
          '2:101': {
            key: '2:101',
            docId: 2,
            questionId: 101,
            questionType: 'choice',
            questionStem: '中国的首都是？',
            updatedAt: Date.now(),
            messages: [{ role: 'user', content: '这题为什么选 B？' }],
          },
        }),
      );
    });

    await page.goto('/#/library');
    await page
      .getByText('历史简答')
      .locator('xpath=ancestor::div[contains(@class,"card")]')
      .getByRole('button', { name: '重置进度' })
      .click();

    await expect.poll(() => resetCalledWith).toBe(2);
    await expect.poll(async () =>
      page.evaluate(() => localStorage.getItem('openstudy:practice:2:attempts')),
    ).toBeNull();
    await expect.poll(async () =>
      page.evaluate(() => localStorage.getItem('openstudy:practice-chat:v1')),
    ).toBe('{}');

    await page.goto('/#/practice/2');
    await expect(page.getByText('中国的首都是？')).toBeVisible();
    await expect(page.getByText('参考答案：')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '提交' })).toBeVisible();
  });

  test('重置进度位于右侧删除按钮左边', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions,
    });
    await page.goto('/#/library');

    const reset = page.getByRole('button', { name: '重置进度' });
    const remove = page.getByRole('button', { name: '删除' });
    const positions = await Promise.all([reset.boundingBox(), remove.boundingBox()]);

    expect(positions[0]).not.toBeNull();
    expect(positions[1]).not.toBeNull();
    expect(positions[0]?.x ?? 0).toBeLessThan(positions[1]?.x ?? 0);
    expect((positions[1]?.x ?? 0) - (positions[0]?.x ?? 0)).toBeLessThan(50);
  });
});
