import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

test.describe('Insights 页面', () => {
  test('缺少 attempt:listRecent handler 时自动回退到兼容聚合', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: [sampleQuestions[0]],
      overrides: {
        listRecentAttempts: `() => Promise.reject(new Error("Error invoking remote method 'attempt:listRecent': Error: No handler registered for 'attempt:listRecent'"))`,
        listAttemptsByDocument: `() => Promise.resolve([{ question_id: 101, user_answer: 'B', is_correct: true, attempted_at: Date.now() }])`,
      },
    });

    await page.goto('/#/insights');

    await expect(page.getByRole('heading', { name: '洞察' })).toBeVisible();
    await expect(page.getByText('最近做题', { exact: true })).toBeVisible();
    await expect(page.getByText('最近正确率', { exact: true })).toBeVisible();
    await expect(page.getByText('选择题', { exact: true })).toBeVisible();
    await expect(page.getByText('历史简答').first()).toBeVisible();
    await expect(
      page.getByText(/No handler registered for 'attempt:listRecent'/),
    ).toHaveCount(0);
  });

  test('进入页面时不会自动生成 AI 洞察，点击后才触发分析', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: [sampleQuestions[0]],
      overrides: {
        listRecentAttempts: `() => Promise.resolve([{
          question_id: 101,
          document_id: 2,
          document_title: '历史简答',
          question_type: 'choice',
          question_stem: '中国的首都是？',
          reference_answer: 'B',
          user_answer: 'B',
          is_correct: true,
          attempted_at: Date.now()
        }])`,
        generateStudyInsights: `() => Promise.resolve({
          summary: '手动分析成功。',
          highlights: ['基础知识掌握稳定'],
          risks: [],
          actions: ['继续练习']
        })`,
      },
    });

    await page.goto('/#/insights');

    await expect(page.getByText('点击右上角分析按钮后，这里会生成建议。')).toBeVisible();
    await expect(page.getByText('手动分析成功。')).toHaveCount(0);

    await page.getByRole('button', { name: '分析洞察' }).click();
    await expect(page.getByText('手动分析成功。')).toBeVisible();
  });

  test('缺少 llm:studyInsights handler 时点击分析会回退到已有的问 AI 通道', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: [sampleQuestions[0]],
      overrides: {
        listRecentAttempts: `() => Promise.resolve([{
          question_id: 101,
          document_id: 2,
          document_title: '历史简答',
          question_type: 'choice',
          question_stem: '中国的首都是？',
          reference_answer: 'B',
          user_answer: 'B',
          is_correct: true,
          attempted_at: Date.now()
        }])`,
        generateStudyInsights: `() => Promise.reject(new Error("Error invoking remote method 'llm:studyInsights': Error: No handler registered for 'llm:studyInsights'"))`,
        askPracticeQuestion: `() => Promise.resolve('{"summary":"兼容通道分析成功。","highlights":["基础知识掌握稳定"],"risks":[],"actions":["继续练习"]}')`,
      },
    });

    await page.goto('/#/insights');

    await page.getByRole('button', { name: '分析洞察' }).click();
    await expect(page.getByText('兼容通道分析成功。')).toBeVisible();
    await expect(page.getByText(/No handler registered for 'llm:studyInsights'/)).toHaveCount(0);
  });

  test('会展示学习画像', async ({ page }) => {
    const now = new Date();
    const makeTime = (dayOffset: number, hour: number) => {
      const value = new Date(now);
      value.setDate(value.getDate() - dayOffset);
      value.setHours(hour, 15, 0, 0);
      return value.getTime();
    };

    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: [sampleQuestions[0]],
      overrides: {
        listRecentAttempts: `() => Promise.resolve([
          {
            question_id: 101,
            document_id: 2,
            document_title: '历史简答',
            question_type: 'choice',
            question_stem: '中国的首都是？',
            reference_answer: 'B',
            user_answer: 'B',
            is_correct: true,
            attempted_at: ${makeTime(0, 21)}
          },
          {
            question_id: 101,
            document_id: 2,
            document_title: '历史简答',
            question_type: 'choice',
            question_stem: '中国的首都是？',
            reference_answer: 'B',
            user_answer: 'B',
            is_correct: true,
            attempted_at: ${makeTime(1, 20)}
          },
          {
            question_id: 101,
            document_id: 2,
            document_title: '历史简答',
            question_type: 'choice',
            question_stem: '中国的首都是？',
            reference_answer: 'B',
            user_answer: 'A',
            is_correct: false,
            attempted_at: ${makeTime(3, 22)}
          }
        ])`,
      },
    });

    await page.goto('/#/insights');

    await expect(page.getByRole('heading', { name: '学习画像' })).toBeVisible();
    await expect(page.getByText('高频时段')).toBeVisible();
    await expect(page.getByText('晚间学习')).toBeVisible();
  });
});
