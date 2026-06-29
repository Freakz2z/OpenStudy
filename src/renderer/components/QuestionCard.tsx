import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Question } from '@shared/types';
import type { ShortcutSettings } from '@shared/shortcuts';
import {
  formatQuestionAnswerDisplay,
  getChoiceOptionLetter,
  getChoiceOptionText,
  isOptionQuestion,
  normalizeChoiceAnswer,
} from '@shared/question-format';
import {
  isAiAssistedQuestion,
  localCheckAnswer,
  localGradeAnswer,
} from '@shared/practice-grading';
import { matchesShortcut } from '../utils/shortcuts';

interface Props {
  question: Question;
  initialAnswer?: string;
  shortcuts: ShortcutSettings;
  aiOpen?: boolean;
  onSubmit: (userAnswer: string, isCorrect: boolean, feedback?: string | null) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function cleanSection(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/第\s*\d+\s*\/\s*\d+\s*段\s*/g, '').trim() || null;
}

function looksLikeCode(s: string): boolean {
  if (!s) return false;
  if (/\n/.test(s)) return true;
  if (
    /(\bfunction\b|\bconst\b|\blet\b|\bclass\b|\bimport\b|\breturn\b|\bawait\b|\basync\b|=>|===|!==)/.test(
      s,
    )
  )
    return true;
  if (/\b\w+\(\)\s*=>/.test(s)) return true;
  return false;
}

function currentUserAnswer(
  choice: string,
  fill: string,
  short: string,
  type: string,
): string {
  if (type === 'choice' || type === 'multiple' || type === 'judge') return choice;
  if (type === 'fill') return fill;
  return short;
}

function hasAnyModifier(shortcut: ShortcutSettings[keyof ShortcutSettings]): boolean {
  return Boolean(
    shortcut.mod || shortcut.ctrl || shortcut.meta || shortcut.alt || shortcut.shift,
  );
}

export default function QuestionCard({
  question,
  initialAnswer = '',
  shortcuts,
  aiOpen = false,
  onSubmit,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Props) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState('');
  const [fill, setFill] = useState('');
  const [short, setShort] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [optionCursor, setOptionCursor] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const stateRef = useRef({
    revealed,
    choice,
    fill,
    short,
    submitting,
    hasPrev,
    hasNext,
    shortcuts,
    aiOpen,
    optionCursor,
    question,
  });
  stateRef.current = {
    revealed,
    choice,
    fill,
    short,
    submitting,
    hasPrev,
    hasNext,
    shortcuts,
    aiOpen,
    optionCursor,
    question,
  };

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;
  const submitCurrentAnswerRef = useRef<() => Promise<void>>(async () => {});

  function setChoiceState(nextValue: string | ((current: string) => string)): string {
    const resolved =
      typeof nextValue === 'function'
        ? nextValue(stateRef.current.choice)
        : nextValue;
    stateRef.current.choice = resolved;
    setChoice(resolved);
    return resolved;
  }

  function setFillState(nextValue: string): string {
    stateRef.current.fill = nextValue;
    setFill(nextValue);
    return nextValue;
  }

  function setShortState(nextValue: string): string {
    stateRef.current.short = nextValue;
    setShort(nextValue);
    return nextValue;
  }

  function setRevealedState(nextValue: boolean): boolean {
    stateRef.current.revealed = nextValue;
    setRevealed(nextValue);
    return nextValue;
  }

  function setSubmittingState(nextValue: boolean): boolean {
    stateRef.current.submitting = nextValue;
    setSubmitting(nextValue);
    return nextValue;
  }

  function setOptionCursorState(nextValue: number): number {
    stateRef.current.optionCursor = nextValue;
    setOptionCursor(nextValue);
    return nextValue;
  }

  useEffect(() => {
    const nextAnswer = initialAnswer;
    setChoiceState(isOptionQuestion(question.type) ? nextAnswer : '');
    setFillState(question.type === 'fill' ? nextAnswer : '');
    setShortState(question.type === 'short' || question.type === 'code' ? nextAnswer : '');
    setRevealedState(false);
    setIsCorrect(null);
    setFeedback(null);
    setSubmittingState(false);
    setOptionCursorState(-1);
    if (!isOptionQuestion(question.type)) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [question.id, question.type]);

  function selectOptionByIndex(nextIndex: number, options: string[]) {
    setOptionCursorState(nextIndex);
    if (question.type === 'multiple') {
      const letter = getChoiceOptionLetter(options[nextIndex], nextIndex);
      setChoiceState((current) => {
        const selected = new Set(normalizeChoiceAnswer(current, options));
        if (selected.has(letter)) selected.delete(letter);
        else selected.add(letter);
        return [...selected].sort().join('');
      });
      return;
    }
    setChoiceState(options[nextIndex]);
  }

  async function submitCurrentAnswer() {
    const nextAnswer = currentUserAnswer(
      stateRef.current.choice,
      stateRef.current.fill,
      stateRef.current.short,
      question.type,
    ).trim();
    if (!nextAnswer || stateRef.current.submitting) return;

    setSubmittingState(true);
    try {
      if (isAiAssistedQuestion(question.type)) {
        const fallback = localGradeAnswer(question, nextAnswer);
        const result = await window.api
          .gradePracticeAnswer({
            question: {
              type: question.type,
              stem: question.stem,
              options: question.options,
              answer: question.answer,
              explanation: question.explanation,
            },
            userAnswer: nextAnswer,
          })
          .catch(() => ({
            ...fallback,
            mode: 'fallback' as const,
          }));

        setIsCorrect(result.isCorrect);
        setFeedback(result.reason || fallback.reason);
        setRevealedState(true);
        onSubmit(nextAnswer, result.isCorrect, result.reason || fallback.reason);
        return;
      }

      const ok = localCheckAnswer(question, nextAnswer);
      setIsCorrect(ok);
      setFeedback(null);
      setRevealedState(true);
      onSubmit(nextAnswer, ok, null);
    } finally {
      setSubmittingState(false);
    }
  }
  submitCurrentAnswerRef.current = submitCurrentAnswer;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = stateRef.current;
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';
      const inTextComposer =
        inInput || target.isContentEditable || target.closest('[contenteditable="true"]') !== null;

      if (
        matchesShortcut(e, s.shortcuts.practicePrev) &&
        !(inTextComposer && !hasAnyModifier(s.shortcuts.practicePrev))
      ) {
        if (s.submitting || !s.hasPrev) return;
        e.preventDefault();
        onPrev();
        return;
      }

      if (!s.aiOpen && matchesShortcut(e, s.shortcuts.practiceSubmit)) {
        if (s.submitting) return;
        if (!s.revealed) {
          if (tag === 'TEXTAREA') e.preventDefault();
          const ua =
            isOptionQuestion(s.question.type)
              ? s.choice
              : s.question.type === 'fill'
                ? s.fill
                : s.short;
          if (!ua.trim()) return;
          void submitCurrentAnswerRef.current();
        } else if (!s.aiOpen && matchesShortcut(e, s.shortcuts.practiceNext) && s.hasNext) {
          e.preventDefault();
          onNextRef.current();
        }
        return;
      }

      if (!s.aiOpen && matchesShortcut(e, s.shortcuts.practiceNext)) {
        if (s.submitting || !s.revealed || !s.hasNext) return;
        e.preventDefault();
        onNextRef.current();
        return;
      }

      if (
        !s.revealed &&
        isOptionQuestion(s.question.type) &&
        s.question.options &&
        !inTextComposer
      ) {
        if (
          matchesShortcut(e, s.shortcuts.practiceOptionPrev) ||
          matchesShortcut(e, s.shortcuts.practiceOptionNext)
        ) {
          e.preventDefault();
          const direction = matchesShortcut(e, s.shortcuts.practiceOptionPrev) ? -1 : 1;
          const currentIndex =
            s.optionCursor >= 0 && s.optionCursor < s.question.options.length
              ? s.optionCursor
              : s.question.type === 'multiple'
                ? (() => {
                    const selectedLetters = normalizeChoiceAnswer(s.choice, s.question.options);
                    if (!selectedLetters.length) return -1;
                    const firstSelected = selectedLetters[0];
                    return s.question.options.findIndex(
                      (option, index) =>
                        getChoiceOptionLetter(option, index) === firstSelected,
                    );
                  })()
                : s.question.options.findIndex((option) => option === s.choice.trim());
          const baseIndex =
            currentIndex >= 0
              ? currentIndex
              : direction > 0
                ? -1
                : 0;
          const nextIndex =
            (baseIndex + direction + s.question.options.length) % s.question.options.length;
          selectOptionByIndex(nextIndex, s.question.options);
          return;
        }

        const k = e.key.toUpperCase();
        const idx = k.charCodeAt(0) - 65;
        if (idx >= 0 && idx < s.question.options.length) {
          setOptionCursorState(idx);
          if (s.question.type === 'multiple') {
            const letter = String.fromCharCode(65 + idx);
            setChoiceState((current) => {
              const selected = new Set(normalizeChoiceAnswer(current, s.question.options));
              if (selected.has(letter)) selected.delete(letter);
              else selected.add(letter);
              return [...selected].sort().join('');
            });
          } else {
            setChoiceState(s.question.options[idx]);
          }
        }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPrev]);

  const ua = currentUserAnswer(choice, fill, short, question.type);
  const canSubmit = ua.trim().length > 0;
  const displaySection = cleanSection(question.page_or_section);
  const displayUserAnswer =
    isOptionQuestion(question.type)
      ? (ua
          ? formatQuestionAnswerDisplay(question.type, ua, question.options)
          : t('practice.result.yourAnswerEmpty'))
      : (ua || t('practice.result.yourAnswerEmpty'));
  const displayReferenceAnswer = formatQuestionAnswerDisplay(
    question.type,
    question.answer,
    question.options,
  );
  const typeLabel =
    question.type === 'choice'
      ? t('practice.types.choice')
      : question.type === 'multiple'
        ? t('practice.types.multiple')
      : question.type === 'judge'
        ? t('practice.types.judge')
      : question.type === 'fill'
        ? t('practice.types.fill')
        : t('practice.types.short');

  return (
    <div className="practice-question-card">
      <div className="practice-question-content">
        <div className="practice-question-meta">
          <span className="badge muted">{typeLabel}</span>
          {displaySection && <span className="badge muted">{displaySection}</span>}
        </div>

        <div
          className={`practice-question-stem${looksLikeCode(question.stem) ? ' is-code' : ''}`}
        >
          {question.stem}
        </div>

        {isOptionQuestion(question.type) && question.options && (
          <div className="practice-options">
            {question.options.map((opt, idx) => {
              const letter = getChoiceOptionLetter(opt, idx);
              const displayText = getChoiceOptionText(opt);
              const selectedLetters = normalizeChoiceAnswer(choice, question.options);
              const correctLetters = normalizeChoiceAnswer(question.answer, question.options);
              const isRight = revealed && correctLetters.includes(letter);
              const isSelected = !revealed && selectedLetters.includes(letter);
              const isActive = !revealed && optionCursor === idx;
              const isPickedWrong =
                revealed && selectedLetters.includes(letter) && !correctLetters.includes(letter);

              return (
                <label
                  key={`${opt}-${idx}`}
                  className={`practice-option${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}${isRight ? ' is-correct' : ''}${isPickedWrong ? ' is-wrong' : ''}${revealed ? ' revealed' : ''}`}
                >
                  <input
                    type={question.type === 'multiple' ? 'checkbox' : 'radio'}
                    name={`choice-${question.id}`}
                    value={opt}
                    disabled={revealed}
                    checked={selectedLetters.includes(letter)}
                    onChange={() => {
                      if (question.type === 'multiple') {
                        const selected = new Set(selectedLetters);
                        if (selected.has(letter)) selected.delete(letter);
                        else selected.add(letter);
                        setChoiceState([...selected].sort().join(''));
                      } else {
                        setChoiceState(opt);
                      }
                      setOptionCursorState(idx);
                    }}
                  />
                  <span className="practice-option-letter">{`${letter}. `}</span>
                  <span
                    className={`practice-option-text${looksLikeCode(displayText) ? ' is-code' : ''}`}
                  >
                    {displayText}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {question.type === 'fill' && (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={fill}
            disabled={revealed}
            className={revealed ? (isCorrect ? 'answer-input correct' : 'answer-input wrong') : 'answer-input'}
            onChange={(e) => setFillState(e.target.value)}
            placeholder={t('practice.placeholder.fill')}
          />
        )}

        {question.type === 'short' && (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={short}
            disabled={revealed}
            className={revealed ? (isCorrect ? 'answer-input correct' : 'answer-input wrong') : 'answer-input'}
            onChange={(e) => setShortState(e.target.value)}
            rows={4}
            placeholder={t('practice.placeholder.short')}
            style={{ fontFamily: 'inherit' }}
          />
        )}

        {revealed ? (
          <div className="practice-result-card">
            <div
              className={`practice-result-status ${isCorrect ? 'success' : 'error'}`}
              role="status"
            >
              {isCorrect ? `✓ ${t('practice.result.correct')}` : `✗ ${t('practice.result.wrong')}`}
            </div>

            <div className="practice-result-block">
              <div className="muted">{t('practice.result.yourAnswerLabel')}</div>
              <div className="answer-panel">
                {displayUserAnswer}
              </div>
            </div>

            <div className="practice-result-block">
              <div className="muted">{t('practice.result.reference')}</div>
              <div className="answer-panel">{displayReferenceAnswer}</div>
            </div>

            {question.explanation && (
              <div className="practice-result-block">
                <div className="muted">{t('practice.result.explanation')}</div>
                <div className="answer-panel explanation">{question.explanation}</div>
              </div>
            )}
          </div>
        ) : null}

        {feedback && (
          <div className="practice-result-block">
            <div className="muted">{t('practice.result.feedback')}</div>
            <div className="answer-panel explanation">{feedback}</div>
          </div>
        )}
      </div>

      <div className="practice-submit-row">
        <button type="button" className="ghost" disabled={!hasPrev || submitting} onClick={onPrev}>
          {t('practice.buttons.prev')}
        </button>
        <button
          type="button"
          className="primary"
          disabled={!canSubmit || revealed || submitting}
          onClick={() => {
            void submitCurrentAnswer();
          }}
        >
          {submitting ? t('practice.buttons.submitting') : t('practice.buttons.submit')}
        </button>
        <button type="button" className="ghost" disabled={!hasNext || submitting} onClick={onNext}>
          {t('practice.buttons.next')}
        </button>
      </div>
    </div>
  );
}
