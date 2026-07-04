import { expect, test } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

const attemptsOverride = `() => Promise.resolve([
  { question_id: 101, user_answer: 'A', is_correct: false, attempted_at: 1000 },
  { question_id: 102, user_answer: '李白', is_correct: true, attempted_at: 2000 }
])`;

test.describe('做题记录页面', () => {
  test('复用做题页面的答题卡、操作区和题目导航', async ({ page }) => {
    await installApiMock(page, {
      documents: sampleDocs,
      questions: sampleQuestions,
      overrides: { listAttemptsByDocument: attemptsOverride },
    });

    await page.goto('/#/records/2');

    await expect(page.getByRole('heading', { name: '做题记录' })).toBeVisible();
    await expect(page.locator('.practice-stage.records-stage')).toBeVisible();
    await expect(page.locator('.practice-question-card.records-question-card')).toBeVisible();
    await expect(page.locator('.question-nav')).toBeVisible();
    await expect(page.locator('.records-review-card')).toHaveCount(0);
    await expect(page.getByText('回答错误')).toBeVisible();
    await expect(page.locator('.practice-option.is-wrong')).toContainText('上海');
    await expect(page.locator('.practice-option.is-correct')).toContainText('北京');

    const previous = page.getByRole('button', { name: '上一题' });
    const next = page.getByRole('button', { name: '下一题' });
    await expect(previous).toBeDisabled();
    await next.click();
    await expect(page.getByText('《静夜思》的作者是___。')).toBeVisible();
    await expect(page.getByText('回答正确')).toBeVisible();
  });

  test('超长内容只允许纵向滚动，不会让答题区域左右移动', async ({ page }) => {
    const longToken = 'LONG_CONTENT_'.repeat(80);
    const longQuestion = {
      ...sampleQuestions[0],
      stem: `用于验证横向锁定：${longToken}`,
      options: [`A. ${longToken}`, 'B. 正确选项'],
    };

    await installApiMock(page, {
      documents: sampleDocs,
      questions: [longQuestion],
      overrides: {
        listAttemptsByDocument: `() => Promise.resolve([
          { question_id: 101, user_answer: 'A', is_correct: false, attempted_at: 1000 }
        ])`,
      },
    });

    await page.goto('/#/records/2');

    const metrics = await page.evaluate(() => {
      const main = document.querySelector('.practice-main') as HTMLElement;
      const card = document.querySelector('.practice-question-card') as HTMLElement;
      const content = document.querySelector('.practice-question-content') as HTMLElement;
      return {
        mainOverflowX: getComputedStyle(main).overflowX,
        contentOverflowX: getComputedStyle(content).overflowX,
        mainFits: main.scrollWidth <= main.clientWidth,
        cardFits: card.scrollWidth <= card.clientWidth,
        contentFits: content.scrollWidth <= content.clientWidth,
      };
    });

    expect(metrics.mainOverflowX).toBe('hidden');
    expect(metrics.contentOverflowX).toBe('hidden');
    expect(metrics.mainFits).toBe(true);
    expect(metrics.cardFits).toBe(true);
    expect(metrics.contentFits).toBe(true);
  });
});
