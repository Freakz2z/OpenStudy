import type { QuestionType } from './types';

const CHOICE_PREFIX_RE = /^\s*(?:[-*+]\s*)?[（(]?\s*([A-Za-z])\s*[.、:：)\]）】]\s*(.+)$/;

export function parseChoiceOption(input: string): { letter?: string; text: string } {
  const text = input.trim();
  if (!text) return { text: '' };
  const match = text.match(CHOICE_PREFIX_RE);
  if (!match) return { text };
  return {
    letter: match[1].toUpperCase(),
    text: match[2].trim(),
  };
}

export function stripChoicePrefix(input: string): string {
  return parseChoiceOption(input).text;
}

export function normalizeChoiceOptions(
  options: string[] | null | undefined,
): string[] | null {
  if (!options) return null;
  const next = options
    .map((item) => stripChoicePrefix(String(item)))
    .map((item) => item.trim())
    .filter(Boolean);
  return next.length > 0 ? next : null;
}

function optionLetterAt(index: number): string {
  return String.fromCharCode(65 + index);
}

function matchAnswerByContent(
  answer: string,
  options?: string[] | null,
): string | null {
  const normalizedOptions = normalizeChoiceOptions(options);
  if (!normalizedOptions) return null;
  const stripped = stripChoicePrefix(answer).toLowerCase();
  const idx = normalizedOptions.findIndex((item) => item.toLowerCase() === stripped);
  return idx >= 0 ? optionLetterAt(idx) : null;
}

export function normalizeChoiceAnswer(
  answer: string,
  options?: string[] | null,
): string {
  const text = answer.trim();
  if (!text) return '';

  const byContent = matchAnswerByContent(text, options);
  if (byContent) return byContent;

  const lettersOnly = text.replace(/[\s,，、;；/]+/g, '');
  if (/^[A-Za-z]+$/.test(lettersOnly)) {
    const upper = lettersOnly.toUpperCase();
    const optionCount = normalizeChoiceOptions(options)?.length ?? 8;
    const maxLetter = optionLetterAt(optionCount - 1);
    const allowed = [...upper].every((letter) => letter >= 'A' && letter <= maxLetter);
    if (allowed) {
      if (upper.length === 1) return upper;
      const sorted = [...new Set(upper)].sort().join('');
      if (/[\s,，、;；/]+/.test(text) || upper === sorted) return sorted;
    }
  }

  const prefixed = text.match(/^\s*([A-Za-z])[.、:：)\]）\s]/);
  if (prefixed) return prefixed[1].toUpperCase();

  return stripChoicePrefix(text);
}

export function getChoiceOptionLetter(option: string, index: number): string {
  return parseChoiceOption(option).letter ?? optionLetterAt(index);
}

export function getChoiceOptionText(option: string): string {
  return parseChoiceOption(option).text;
}

export function formatChoiceAnswerDisplay(
  answer: string | null | undefined,
  options?: string[] | null,
): string {
  const text = answer?.trim() ?? '';
  if (!text) return '';

  const normalizedOptions = normalizeChoiceOptions(options);
  const normalizedAnswer = normalizeChoiceAnswer(text, normalizedOptions);

  if (normalizedOptions && /^[A-Z]+$/.test(normalizedAnswer)) {
    const labels = [...normalizedAnswer]
      .map((letter) => {
        const idx = letter.charCodeAt(0) - 65;
        return idx >= 0 && idx < normalizedOptions.length
          ? `${letter}. ${normalizedOptions[idx]}`
          : null;
      })
      .filter((value): value is string => Boolean(value));
    if (labels.length > 0) return labels.join('；');
  }

  const byContent = matchAnswerByContent(text, normalizedOptions);
  if (normalizedOptions && byContent) {
    const idx = byContent.charCodeAt(0) - 65;
    return `${byContent}. ${normalizedOptions[idx]}`;
  }

  return stripChoicePrefix(text);
}

export function formatQuestionAnswerDisplay(
  type: QuestionType,
  answer: string | null | undefined,
  options?: string[] | null,
): string {
  if (isOptionQuestion(type)) {
    return formatChoiceAnswerDisplay(answer, options);
  }
  return answer?.trim() ?? '';
}

export function isOptionQuestion(type: QuestionType): boolean {
  return type === 'choice' || type === 'multiple' || type === 'judge' || type === 'code';
}
