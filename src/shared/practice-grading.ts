import type { Question, QuestionType } from './types';
import {
  isOptionQuestion,
  normalizeChoiceAnswer,
} from './question-format';

type GradableQuestion = Pick<Question, 'type' | 'answer' | 'options'>;

export interface LocalPracticeGradeResult {
  isCorrect: boolean;
  reason: string;
}

export function isAiAssistedQuestion(type: QuestionType): boolean {
  return type === 'short' || type === 'fill' || type === 'code';
}

function normalizeFillAnswer(value: string): string {
  return value.replace(/[\s　，。、,.；;：:！!？?'''""]/g, '').toLowerCase();
}

function stripParticles(value: string): string {
  return value.replace(/[的了着过]/g, '');
}

export function localCheckAnswer(question: GradableQuestion, userAnswer: string): boolean {
  const answer = userAnswer.trim();
  if (!answer) return false;

  if (isOptionQuestion(question.type)) {
    return (
      normalizeChoiceAnswer(answer, question.options) ===
      normalizeChoiceAnswer(question.answer, question.options)
    );
  }

  if (question.type === 'fill') {
    return normalizeFillAnswer(answer) === normalizeFillAnswer(question.answer);
  }

  const keywords = question.answer
    .split(/[，。、,.；; \n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  if (keywords.length === 0) {
    return stripParticles(answer)
      .toLowerCase()
      .includes(stripParticles(question.answer).toLowerCase());
  }

  const normalizedUserAnswer = stripParticles(answer).toLowerCase();
  const hitCount = keywords.filter((keyword) =>
    normalizedUserAnswer.includes(stripParticles(keyword).toLowerCase()),
  ).length;

  return hitCount >= 1 && hitCount / keywords.length >= 0.6;
}

export function localGradeAnswer(
  question: GradableQuestion,
  userAnswer: string,
): LocalPracticeGradeResult {
  const isCorrect = localCheckAnswer(question, userAnswer);

  if (question.type === 'fill') {
    return {
      isCorrect,
      reason: isCorrect
        ? '答案与参考答案一致，已按填空题规则判定正确。'
        : '答案与参考答案差异较大，已按填空题规则判定错误。',
    };
  }

  if (question.type === 'short' || question.type === 'code') {
    return {
      isCorrect,
      reason: isCorrect
        ? '答案覆盖了参考答案的关键要点，已按主观题规则判定正确。'
        : '答案未充分覆盖参考答案的关键要点，已按主观题规则判定错误。',
    };
  }

  return {
    isCorrect,
    reason: isCorrect ? '答案正确。' : '答案错误。',
  };
}
