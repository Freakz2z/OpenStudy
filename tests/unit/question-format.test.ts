import { describe, expect, it } from 'vitest';
import {
  formatChoiceAnswerDisplay,
  formatQuestionAnswerDisplay,
  getChoiceOptionLetter,
  getChoiceOptionText,
  isOptionQuestion,
  normalizeChoiceAnswer,
  normalizeChoiceOptions,
  parseChoiceOption,
  stripChoicePrefix,
} from '../../src/shared/question-format.js';

describe('question-format', () => {
  it('去掉选项前缀', () => {
    expect(stripChoicePrefix('A. 北京')).toBe('北京');
    expect(stripChoicePrefix('b、上海')).toBe('上海');
    expect(stripChoicePrefix('C) 广州')).toBe('广州');
    expect(stripChoicePrefix('（R）RNN')).toBe('RNN');
  });

  it('优先识别显式前缀，否则按位置给选项字母', () => {
    expect(parseChoiceOption('T. Transformer')).toEqual({ letter: 'T', text: 'Transformer' });
    expect(getChoiceOptionLetter('HTTP 协议', 0)).toBe('A');
    expect(getChoiceOptionLetter('R. RNN', 2)).toBe('R');
    expect(getChoiceOptionText('R. RNN')).toBe('RNN');
  });

  it('规范化选项数组', () => {
    expect(normalizeChoiceOptions(['A. 北京', ' B、上海 ', '广州'])).toEqual([
      '北京',
      '上海',
      '广州',
    ]);
  });

  it('把选择题答案统一成字母', () => {
    expect(normalizeChoiceAnswer('a')).toBe('A');
    expect(normalizeChoiceAnswer('B. 北京')).toBe('B');
    expect(normalizeChoiceAnswer('上海', ['北京', '上海', '广州'])).toBe('B');
    expect(normalizeChoiceAnswer('D、A、C')).toBe('ACD');
    expect(normalizeChoiceAnswer('BAD', ['好', '坏', '一般', '未知'])).toBe('BAD');
  });

  it('把选择题答案格式化成可读展示文本', () => {
    const options = ['A. 上海', 'B. 北京', 'C. 广州'];
    expect(formatChoiceAnswerDisplay('B', options)).toBe('B. 北京');
    expect(formatChoiceAnswerDisplay('上海', options)).toBe('A. 上海');
    expect(formatChoiceAnswerDisplay('A. 上海', options)).toBe('A. 上海');
    expect(formatChoiceAnswerDisplay('AC', options)).toBe('A. 上海；C. 广州');
  });

  it('按题型格式化答案展示', () => {
    expect(formatQuestionAnswerDisplay('choice', 'B', ['北京', '上海'])).toBe(
      'B. 上海',
    );
    expect(formatQuestionAnswerDisplay('code', 'B', ['甲', '乙'])).toBe('B. 乙');
    expect(formatQuestionAnswerDisplay('fill', ' 李白 ', null)).toBe('李白');
  });

  it('代码题也视为选项题', () => {
    expect(isOptionQuestion('choice')).toBe(true);
    expect(isOptionQuestion('judge')).toBe(true);
    expect(isOptionQuestion('code')).toBe(true);
    expect(isOptionQuestion('short')).toBe(false);
  });
});
