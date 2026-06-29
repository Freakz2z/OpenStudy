import { describe, expect, it } from 'vitest';
import {
  analyzeMarkdownPrecheck,
  buildIdentifyQualityReport,
} from '../../src/shared/question-diagnostics.js';

describe('question diagnostics', () => {
  it('能预检 Markdown 中的题号、答案与选项', () => {
    const report = analyzeMarkdownPrecheck(`
## 1. 中国的首都是？
A. 上海
B. 北京
答案：B

## 2. 第二题
A. 甲
`);

    expect(report.estimatedQuestionCount).toBe(2);
    expect(report.optionLineCount).toBe(3);
    expect(report.answerLineCount).toBe(1);
    expect(report.issues.some((issue) => issue.code === 'missing_answer')).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'option_count_low')).toBe(true);
  });

  it('兼容标准 Markdown 和旧式粗体答案标记, 不误报缺少答案', () => {
    const report = analyzeMarkdownPrecheck(`
## 单选题

### 1. 第一题
- A. 甲
- B. 乙
Answer: B

### 2. 第二题
- A. 甲
- B. 乙
**【答案】** A
**【解析】** 说明
`);

    expect(report.estimatedQuestionCount).toBe(2);
    expect(report.answerLineCount).toBe(2);
    expect(report.issues.some((issue) => issue.code === 'missing_answer')).toBe(false);
  });

  it('能根据识别结果生成质量诊断', () => {
    const report = buildIdentifyQualityReport(
      `
## 1. 第一题
答案：A

## 2. 第二题
答案：B

## 3. 第三题
答案：C
`,
      [
        {
          type: 'choice',
          stem: '第一题',
          options: ['甲', '乙'],
          answer: 'A',
          explanation: '',
        },
      ],
    );

    expect(report.estimatedQuestionCount).toBe(3);
    expect(report.identifiedQuestionCount).toBe(1);
    expect(report.coverageRatio).toBeCloseTo(1 / 3);
    expect(report.issues.some((issue) => issue.code === 'possible_missing_questions')).toBe(true);
    expect(report.missingExplanationCount).toBe(1);
  });
});
