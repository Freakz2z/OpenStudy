import { test, expect } from '@playwright/test';
import { installApiMock, sampleDocs, sampleQuestions } from './_helpers';

test.describe('题目统计', () => {
  test('Library 顶部汇总展示总览数据', async ({ page }) => {
    await installApiMock(page, {
      documents: sampleDocs,
      questions: sampleQuestions,
      wrong: [
        {
          ...sampleQuestions[0],
          last_wrong_answer: 'A',
          last_wrong_at: Date.now() - 1000,
        },
      ],
      overrides: {
        getOverallStats: `async function() {
          return {
            document_count: 2,
            question_count: 3,
            attempted_count: 1,
            wrong_count: 1,
            accuracy: 0.67
          };
        }`,
      },
    });
    await page.goto('/#/library');
    const summary = page.locator('.card').filter({ hasText: '2 个文档' });
    await expect(summary.getByText('3 道题')).toBeVisible();
    await expect(summary.getByText('已做 1/3')).toBeVisible();
    await expect(summary.getByText('正确率 67%')).toBeVisible();
  });

  test('每个文档卡片展示已做 / 对 / 错 / 正确率', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions,
      overrides: {
        getDocumentStats: `async function(docId) {
          return {
            question_count: 3,
            attempted_count: 3,
            correct_count: 2,
            wrong_count: 1,
            accuracy: 0.67
          };
        }`,
      },
    });
    await page.goto('/#/library');
    await expect(
      page.getByText(/已做 3\/3.*对 2.*错 1.*正确率 67%/),
    ).toBeVisible();
  });

  test('无任何 attempt 时正确率显示 —', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions,
      overrides: {
        getDocumentStats: `async function() {
          return {
            question_count: 3, attempted_count: 0, correct_count: 0,
            wrong_count: 0, accuracy: null
          };
        }`,
      },
    });
    await page.goto('/#/library');
    const docCard = page.locator('.card').filter({ hasText: '历史简答' });
    await expect(docCard.getByText(/已做 0\/3/)).toBeVisible();
    await expect(docCard.getByText(/正确率\s*—/)).toBeVisible();
  });

  test('题目数为 0 时不显示统计行', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[0]], // question_count = 0
    });
    await page.goto('/#/library');
    // 没有「已做 X/Y」字样
    await expect(page.getByText(/已做 \d+\/\d+/)).not.toBeVisible();
  });

  test('Overview 展示错题热点，日志独立在 Logs 页面展示', async ({ page }) => {
    await installApiMock(page, {
      wrong: [
        {
          ...sampleQuestions[0],
          last_wrong_answer: 'A',
          last_wrong_at: Date.now() - 1000,
          document_title: '历史简答',
          document_file_type: 'docx',
        },
      ],
      overrides: {
        getOverallStats: `async function() {
          return {
            document_count: 1, question_count: 3,
            attempted_count: 3, wrong_count: 1, accuracy: 0.67
          };
        }`,
      },
      logs: [
        {
          id: 'log-1',
          created_at: Date.now(),
          status: 'failed',
          doc_id: 2,
          doc_title: '历史简答',
          file_path: '/Users/test/history.docx',
          file_type: 'docx',
          model_provider: 'deepseek',
          model_name: 'deepseek-v4-flash',
          message: '完整性校验失败',
          estimated_question_count: 10,
          identified_question_count: 8,
          events: [
            {
              severity: 'error',
              stage: 'integrity',
              message: '缺少 q9、q10',
            },
          ],
        },
      ],
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '错题热点' })).toBeVisible();
    await expect(page.getByText('历史简答')).toBeVisible();
    await page.goto('/#/logs');
    await expect(page.getByRole('heading', { name: '识别日志' })).toBeVisible();
    await expect(page.getByText('完整性校验失败')).toBeVisible();
  });

  test('识别完成后 stats 自动刷新', async ({ page }) => {
    let statsCalls = 0;
    await page.exposeFunction('__bumpStats', () => {
      statsCalls++;
    });
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions,
      overrides: {
        getDocumentStats: `async function(docId) {
          try { await window.__bumpStats(); } catch(e) {}
          return {
            question_count: 5, attempted_count: 5,
            correct_count: 4, wrong_count: 1, accuracy: 0.8
          };
        }`,
      },
    });
    await page.goto('/#/library');
    await expect.poll(() => statsCalls).toBeGreaterThanOrEqual(1);
    await expect(page.getByText(/正确率 80%/)).toBeVisible();
  });

  test('识别完成后显示识题质量诊断', async ({ page }) => {
    await installApiMock(page, {
      documents: [sampleDocs[1]],
      questions: sampleQuestions,
      overrides: {
        identifyQuestions: `async function() {
          return {
            questions: [{
              id: 101,
              document_id: 2,
              type: 'choice',
              stem: '中国的首都是？',
              options: ['上海', '北京'],
              answer: 'B',
              explanation: null,
              page_or_section: null,
              position: 0
            }],
            diagnostics: {
              estimatedQuestionCount: 3,
              identifiedQuestionCount: 1,
              coverageRatio: 0.33,
              typeCounts: { choice: 1, multiple: 0, judge: 0, fill: 0, short: 0, code: 0 },
              missingExplanationCount: 1,
              duplicateStemCount: 0,
              suspiciousQuestionCount: 1,
              issueCount: 2,
              issues: [
                { code: 'possible_missing_questions', severity: 'warning', message: '疑似存在漏题。' },
                { code: 'missing_explanations', severity: 'info', message: '有 1 道题没有解析。' }
              ]
            }
          };
        }`,
      },
    });
    await page.goto('/#/library');
    const card = page.locator('.card').filter({ hasText: '历史简答' }).first();
    await card.getByRole('button', { name: '识别题目' }).click();
    await expect(card.getByText('识题质量诊断')).toBeVisible();
    await expect(card.getByText('预检约 3 题')).toBeVisible();
    await expect(card.getByText('识别出 1 题')).toBeVisible();
    await expect(card.getByText('疑似存在漏题。')).toBeVisible();
  });
});
