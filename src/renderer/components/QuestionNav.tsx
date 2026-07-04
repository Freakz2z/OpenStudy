import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

export type QuestionStatus = 'unanswered' | 'correct' | 'wrong' | 'answered';

interface QuestionNavProps {
  current: number;
  total: number;
  statuses: QuestionStatus[];
  onJump: (index: number) => void;
  layout?: 'right' | 'inline';
  examMode?: boolean;
  correctCount?: number;
  wrongCount?: number;
  remainingCount?: number;
  answeredCount?: number;
  unansweredCount?: number;
}

export function QuestionNav({
  current,
  total,
  statuses,
  onJump,
  layout = 'right',
  examMode = false,
  correctCount = 0,
  wrongCount = 0,
  remainingCount = 0,
  answeredCount = 0,
  unansweredCount = 0,
}: QuestionNavProps) {
  const { t } = useTranslation();

  if (layout === 'inline') {
    return (
      <div
        className="question-nav-inline"
        role="navigation"
        aria-label={examMode ? t('exam.nav.label') : t('practice.nav.label')}
      >
        {Array.from({ length: total }, (_, i) => {
          const s = statuses[i] ?? 'unanswered';
          return (
            <button
              key={i}
              type="button"
              className={`qnav-cell qnav-${s}${i === current ? ' qnav-current' : ''}`}
              onClick={() => onJump(i)}
              aria-label={`${i + 1}`}
              aria-current={i === current ? 'step' : undefined}
            >
              {s === 'correct' ? (
                <Check size={14} />
              ) : s === 'wrong' ? (
                <X size={14} />
              ) : s === 'answered' ? (
                <Check size={14} />
              ) : (
                <span className="qnav-num">{i + 1}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <aside
      className="question-nav"
      role="navigation"
      aria-label={examMode ? t('exam.nav.label') : t('practice.nav.label')}
    >
      <div className="question-nav-header">
        <span className="muted">
          {examMode
            ? t('exam.progress', { current: current + 1, total })
            : t('practice.nav.progress', { done: current + 1, total })}
        </span>
      </div>
      <div className="question-nav-stats">
        {examMode ? (
          <>
            <div className="question-nav-stat">
              <span className="question-nav-stat-label">{t('exam.nav.answered')}</span>
              <strong>{answeredCount}</strong>
            </div>
            <div className="question-nav-stat">
              <span className="question-nav-stat-label">{t('exam.nav.unanswered')}</span>
              <strong>{unansweredCount}</strong>
            </div>
          </>
        ) : (
          <>
            <div className="question-nav-stat">
              <span className="question-nav-stat-label">{t('practice.nav.correct')}</span>
              <strong>{correctCount}</strong>
            </div>
            <div className="question-nav-stat">
              <span className="question-nav-stat-label">{t('practice.nav.wrong')}</span>
              <strong>{wrongCount}</strong>
            </div>
            <div className="question-nav-stat">
              <span className="question-nav-stat-label">{t('practice.nav.unanswered')}</span>
              <strong>{remainingCount}</strong>
            </div>
          </>
        )}
      </div>
      <div className="question-nav-scroll">
        <div className="question-nav-grid">
          {Array.from({ length: total }, (_, i) => {
            const s = statuses[i] ?? 'unanswered';
            return (
              <button
                key={i}
                type="button"
                className={`qnav-cell qnav-${s}${i === current ? ' qnav-current' : ''}`}
                onClick={() => onJump(i)}
                aria-label={`${i + 1}`}
                aria-current={i === current ? 'step' : undefined}
              >
                {s === 'correct' ? (
                  <Check size={14} />
                ) : s === 'wrong' ? (
                  <X size={14} />
                ) : s === 'answered' ? (
                  <Check size={14} />
                ) : (
                  <span className="qnav-num">{i + 1}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
