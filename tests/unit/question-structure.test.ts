import { describe, expect, it } from 'vitest';
import {
  parseStructuredQuestions,
  segmentQuestionDocument,
} from '../../src/main/services/question-structure.js';

describe('question structure parser', () => {
  it('允许章节内题号重新开始，并识别四类题型', () => {
    const text = `
[[PDF PAGE 1]]
一、单选题
1. 首都是？
A. 上海
B. 北京
答案：B
解析：北京是首都。

二、判断题
1、地球是球体。
答案：对

三、填空题
1）1+1=____。
答案：2

四、简答题
1. 请解释单元测试。
参考答案：用于验证最小可测试单元。
`;
    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(4);
    expect(result.questions.map((q) => q?.type)).toEqual([
      'choice',
      'judge',
      'fill',
      'short',
    ]);
    expect(result.questions[1]).toMatchObject({
      options: ['正确', '错误'],
      answer: 'A',
    });
  });

  it('容忍全角标点、括号题号和行内选项', () => {
    const text = `选择题
（1） 哪个数字最大？ A、1 B、2 C、3 D、4
正确答案：D
`;
    const { blocks, questions } = parseStructuredQuestions(text);
    expect(blocks).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      type: 'choice',
      stem: '哪个数字最大？',
      options: ['1', '2', '3', '4'],
      answer: 'D',
    });
  });

  it('目录型章节标题不会被计为题目', () => {
    const text = `目录
一、单选题................1
二、判断题................3

一、单选题
1. 第一题
A. 甲
B. 乙
答案：A`;
    expect(segmentQuestionDocument(text).blocks).toHaveLength(1);
  });

  it('代码题（单选）章节标题不会被误切成“第 四 题”', () => {
    const text = `## 三、填空题
### 1. Spring Boot中专门用于Controller接口切片测试的注解是____。
答案：@WebMvcTest

## 四、代码题（单选）
### 1. 请阅读以下代码，哪个选项的描述是正确的：
A. 甲
B. 乙
答案：B`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((block) => [block.heading, block.number])).toEqual([
      ['填空题', '1'],
      ['代码题', '1'],
    ]);
    expect(result.questions.map((question) => question?.type)).toEqual(['fill', 'code']);
  });

  it('支持英文标准章节标题', () => {
    const text = `## Multiple Choice
### 1. Which option is correct?
A. Alpha
B. Beta
Answer: B

## Short Answer
### 1. Describe TDD
Answer: Red, green, refactor.`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((block) => block.heading)).toEqual([
      'Multiple Choice',
      'Short Answer',
    ]);
    expect(result.questions.map((question) => question?.type)).toEqual(['choice', 'short']);
  });

  it('优先使用逐题 Type 字段, 即使没有题型章节也能识别', () => {
    const text = `### 1. 下面哪些属于测试阶段产物？
Type: multiple
A. 用例
B. 缺陷报告
C. 编译器
Answer: AB

### 2. TDD 的三步是什么？
Type: short
Answer: Red, green, refactor.`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.questions.map((question) => question?.type)).toEqual(['multiple', 'short']);
    expect(result.questions[0]).toMatchObject({
      options: ['用例', '缺陷报告', '编译器'],
      answer: 'AB',
    });
  });

  it('会从 QUESTION_ID 注释中恢复 source_id', () => {
    const text = `## 单选题
<!-- QUESTION_ID:q9 PAGE:2 -->
### 1. 哪个选项正确？
A. 甲
B. 乙
Type: choice
Answer: A`;

    const result = parseStructuredQuestions(text);
    expect(result.blocks[0]?.sourceId).toBe('q9');
    expect(result.questions[0]).toMatchObject({
      source_id: 'q9',
      answer: 'A',
    });
  });
});
