import { describe, expect, it } from 'vitest';
import { isExactFillMatch, localCheckAnswer } from '../../src/shared/practice-grading';

describe('practice grading', () => {
  it('treats trimmed identical fill answers as exact matches', () => {
    expect(
      isExactFillMatch(
        {
          type: 'fill',
          answer: '李白',
        },
        ' 李白 ',
      ),
    ).toBe(true);
  });

  it('does not treat punctuation-normalized equality as exact match', () => {
    expect(
      isExactFillMatch(
        {
          type: 'fill',
          answer: '北京',
        },
        '北 京',
      ),
    ).toBe(false);

    expect(
      localCheckAnswer(
        {
          type: 'fill',
          answer: '北京',
          options: null,
        },
        '北 京',
      ),
    ).toBe(true);
  });
});
