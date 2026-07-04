import { describe, expect, it } from 'vitest';
import { OpenStudyJsonQuestionSetSchema } from '../../src/shared/openstudy-json.js';
import {
  openStudyJsonToQuestions,
  questionsToOpenStudyJson,
  renderOpenStudyMarkdown,
} from '../../src/shared/openstudy-standard.js';
import type { Question } from '../../src/shared/types.js';

const sampleQuestions: Question[] = [
  {
    id: 1,
    document_id: 9,
    type: 'choice',
    stem: '哪个注解用于控制层切片测试？',
    options: ['A. @SpringBootTest', 'B. @WebMvcTest', 'C. @DataJpaTest', 'D. @RestClientTest'],
    answer: 'B',
    explanation: '@WebMvcTest 用于控制层切片测试。',
    page_or_section: 'Spring Testing',
    position: 0,
  },
  {
    id: 2,
    document_id: 9,
    type: 'short',
    stem: '简述 TDD 的基本流程。',
    options: null,
    answer: '红、绿、重构。',
    explanation: '先写失败测试，再实现，再重构。',
    page_or_section: null,
    position: 1,
  },
];

describe('OpenStudy standard conversions', () => {
  it('exports question list to canonical json set', () => {
    const json = questionsToOpenStudyJson(sampleQuestions, {
      title: 'Testing Pack',
      sourcePath: '/tmp/testing.md',
      fileType: 'md',
      importedAt: 1,
    });
    expect(OpenStudyJsonQuestionSetSchema.parse(json).questions).toHaveLength(2);
    expect(json.version).toBe('openstudy.question-set.v1');
    expect(json.questions[0]?.type).toBe('choice');
  });

  it('converts canonical json set back to questions', () => {
    const json = questionsToOpenStudyJson(sampleQuestions, { title: 'Round Trip' });
    const questions = openStudyJsonToQuestions(json);
    expect(questions).toHaveLength(2);
    expect(questions[0]?.options?.[1]).toContain('@WebMvcTest');
  });

  it('renders markdown in OpenStudy standard layout', () => {
    const markdown = renderOpenStudyMarkdown(sampleQuestions, 'zh');
    expect(markdown).toContain('## 单选题');
    expect(markdown).toContain('- A. @SpringBootTest');
    expect(markdown).toContain('- B. @WebMvcTest');
    expect(markdown).toContain('Type: choice');
    expect(markdown).toContain('Answer: B');
    expect(markdown).toContain('## 简答题');
    expect(markdown).toContain('Type: short');
  });
});
