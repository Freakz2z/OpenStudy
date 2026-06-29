import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

function makeWrong(docId: number, qId: number, lastAnswer: string, title: string) {
  return {
    ...sampleQuestions.find((q) => q.id === qId)!,
    document_id: docId,
    last_wrong_answer: lastAnswer,
    last_wrong_at: Date.now(),
    document_title: title,
    document_file_type: sampleDocs.find((d) => d.id === docId)?.file_type ?? 'pdf',
  };
}

test.describe('错题本按文档分组', () => {
  test('多个错题来自不同文档 → 按文档分组', async ({ page }) => {
    await installApiMock(page, {
      wrong: [
        makeWrong(1, 101, 'A', '代数练习题'),
        makeWrong(1, 102, 'B', '代数练习题'),
        makeWrong(2, 103, 'C', '历史简答'),
      ],
    });
    await page.goto('/#/wrong');
    // 看到两个文档标题
    await expect(page.getByText('代数练习题').first()).toBeVisible();
    await expect(page.getByText('历史简答').first()).toBeVisible();
    // 看到错题数 2 和 1
    await expect(page.getByText('2 道错题')).toBeVisible();
    await expect(page.getByText('1 道错题')).toBeVisible();
  });

  test('折叠/展开文档卡', async ({ page }) => {
    await installApiMock(page, {
      wrong: [makeWrong(1, 101, 'A', '代数练习题')],
    });
    await page.goto('/#/wrong');
    await expect(page.getByText('中国的首都是？')).not.toBeVisible();
    await page.getByRole('button', { name: /代数练习题/ }).click();
    await expect(page.getByText('中国的首都是？')).toBeVisible();
    await page.locator('.wrongbook-doc-footer').getByRole('button', { name: '返回' }).click();
    await expect(page.getByText('中国的首都是？')).not.toBeVisible();
  });

  test('顶部"清空错题本"按钮可点', async ({ page }) => {
    await installApiMock(page, {
      wrong: [makeWrong(1, 101, 'A', '代数练习题')],
    });
    await page.goto('/#/wrong');
    await expect(page.getByRole('button', { name: '清空错题本' })).toBeVisible();
  });

  test('空错题本显示空状态', async ({ page }) => {
    await installApiMock(page, { wrong: [] });
    await page.goto('/#/wrong');
    await expect(page.getByText('还没有错题')).toBeVisible();
    await expect(page.getByRole('button', { name: '清空错题本' })).toHaveCount(0);
  });

  test('点击"重做"跳转 practice', async ({ page }) => {
    await installApiMock(page, {
      wrong: [makeWrong(1, 101, 'A', '代数练习题')],
    });
    await page.goto('/#/wrong');
    await page.getByRole('button', { name: /代数练习题/ }).click();
    await page.getByRole('button', { name: '重做' }).click();
    await expect(page).toHaveURL(/#\/practice\/1\?from=wrong/);
  });
});
