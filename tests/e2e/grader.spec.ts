import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

test.describe('判分算法', () => {
  test('多选题：必须选择全部正确项且不能多选', async ({ page }) => {
    const questions = [
      {
        id: 1,
        document_id: 2,
        type: 'multiple' as const,
        stem: '请选择正确项',
        options: ['甲', '乙', '丙', '丁'],
        answer: 'AC',
        explanation: null,
        page_or_section: null,
        position: 0,
      },
    ];
    await installApiMock(page, { questions });
    await page.goto('/#/practice/2');
    await page.locator('label').filter({ hasText: 'A. 甲' }).click();
    await page.locator('label').filter({ hasText: 'C. 丙' }).click();
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✓ 正确')).toBeVisible();
    await expect(page.getByText('A. 甲；C. 丙').first()).toBeVisible();
  });

  test('填空题：忽略空白和标点后相等算对', async ({ page }) => {
    const questions = [
      {
        id: 1,
        document_id: 2,
        type: 'fill' as const,
        stem: '中国的首都是？',
        options: null,
        answer: '北京',
        explanation: null,
        page_or_section: null,
        position: 0,
      },
    ];
    await installApiMock(page, { questions });
    await page.goto('/#/practice/2');
    // 答 "北 京" 应当通过（忽略中间空白）
    await page.getByPlaceholder('输入答案').fill('北 京');
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✓ 正确')).toBeVisible();
  });

  test('填空题：忽略常见中英文标点', async ({ page }) => {
    const questions = [
      {
        id: 1,
        document_id: 2,
        type: 'fill' as const,
        stem: '作者是？',
        options: null,
        answer: '李白',
        explanation: null,
        page_or_section: null,
        position: 0,
      },
    ];
    await installApiMock(page, { questions });
    await page.goto('/#/practice/2');
    await page.getByPlaceholder('输入答案').fill('"李白"');
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✓ 正确')).toBeVisible();
  });

  test('简答题：答中 ≥60% 关键词视为正确', async ({ page }) => {
    const questions = [
      {
        id: 1,
        document_id: 2,
        type: 'short' as const,
        stem: '简述工业革命的影响',
        options: null,
        answer: '促进生产力发展、推动城市化、加剧贫富分化',
        explanation: null,
        page_or_section: null,
        position: 0,
      },
    ];
    await installApiMock(page, { questions });
    await page.goto('/#/practice/2');
    // 命中 2/3 关键词：60% 阈值刚好
    await page.getByPlaceholder('输入答案').fill('工业革命促进了生产力发展，推动了城市化进程');
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✓ 正确')).toBeVisible();
  });

  test('简答题：答中 <60% 关键词视为错误', async ({ page }) => {
    const questions = [
      {
        id: 1,
        document_id: 2,
        type: 'short' as const,
        stem: '简述工业革命的影响',
        options: null,
        answer: '促进生产力发展、推动城市化、加剧贫富分化',
        explanation: null,
        page_or_section: null,
        position: 0,
      },
    ];
    await installApiMock(page, { questions });
    await page.goto('/#/practice/2');
    // 只命中 1/3 ≈ 33%
    await page.getByPlaceholder('输入答案').fill('工业革命促进了生产力发展');
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✗ 错误')).toBeVisible();
  });

  test('简答题：答案无关键词时退化为包含匹配', async ({ page }) => {
    const questions = [
      {
        id: 1,
        document_id: 2,
        type: 'short' as const,
        stem: '简介',
        options: null,
        answer: 'openstudy',
        explanation: null,
        page_or_section: null,
        position: 0,
      },
    ];
    await installApiMock(page, { questions });
    await page.goto('/#/practice/2');
    await page.getByPlaceholder('输入答案').fill('这是一个 openstudy 项目的简介');
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✓ 正确')).toBeVisible();
  });
});

test.describe('重做模式 (?from=wrong)', () => {
  test('从错题本点重做，自动进入 wrong 视图并显示提示', async ({ page }) => {
    await installApiMock(page, {
      questions: sampleQuestions,
      wrong: [
        {
          ...sampleQuestions[0],
          last_wrong_answer: 'A',
          last_wrong_at: Date.now() - 1000,
        },
      ],
    });
    await page.goto('/#/practice/2?from=wrong');
    // 顶部 banner
    await expect(page.getByText('重做模式：来自错题本')).toBeVisible();
    // filter 自动切到 wrong
    await expect(page.locator('select').first()).toHaveValue('wrong');
    // 加载到错题
    await expect(page.getByText('中国的首都是？')).toBeVisible();
  });

  test('重做模式全对完成时显示掌握反馈', async ({ page }) => {
    await installApiMock(page, {
      questions: sampleQuestions,
      wrong: [
        {
          ...sampleQuestions[0],
          last_wrong_answer: 'A',
          last_wrong_at: Date.now() - 1000,
        },
      ],
    });
    await page.goto('/#/practice/2?from=wrong');
    await page.locator('label').filter({ hasText: 'B. 北京' }).click();
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('✓ 正确')).toBeVisible();
    await page.getByRole('button', { name: '下一题' }).click();
    await expect(page.getByText('完成！')).toBeVisible();
    await expect(page.getByText('本轮错题已全部掌握')).toBeVisible();
    // 完成页有"返回错题本"按钮
    await expect(page.getByRole('button', { name: '返回错题本' })).toBeVisible();
  });

  test('重做模式下切换 filter 到 all，URL 中的 from 参数被清掉', async ({ page }) => {
    await installApiMock(page, {
      questions: sampleQuestions,
      wrong: [
        {
          ...sampleQuestions[0],
          last_wrong_answer: 'A',
          last_wrong_at: Date.now() - 1000,
        },
      ],
    });
    await page.goto('/#/practice/2?from=wrong');
    await page.locator('select').first().selectOption('all');
    await expect(page).not.toHaveURL(/from=wrong/);
    await expect(page.getByText('重做模式：来自错题本')).not.toBeVisible();
  });
});
