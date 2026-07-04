import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Copy, Download } from 'lucide-react';
import type { Question, QuestionAttemptSnapshot } from '@shared/types';
import {
  formatQuestionAnswerDisplay,
  getChoiceOptionLetter,
  getChoiceOptionText,
  isOptionQuestion,
  normalizeChoiceAnswer,
} from '@shared/question-format';
import { renderPracticeResultsMarkdown } from '@shared/openstudy-standard';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { MarkdownContent } from '../components/MarkdownContent';
import { QuestionNav, type QuestionStatus } from '../components/QuestionNav';
import { useToast } from '../components/ToastProvider';
import { downloadMarkdownFile } from '../utils/helpers';

function getAttemptStatus(
  questionId: number,
  attemptMap: Record<number, QuestionAttemptSnapshot>,
): 'correct' | 'wrong' | 'unanswered' {
  const a = attemptMap[questionId];
  if (!a) return 'unanswered';
  return a.is_correct ? 'correct' : 'wrong';
}

function getStatusLabel(
  status: 'correct' | 'wrong' | 'unanswered',
  t: (key: string) => string,
): string {
  if (status === 'correct') return t('records.status.correct');
  if (status === 'wrong') return t('records.status.wrong');
  return t('records.status.unattempted');
}

function getQuestionTypeLabel(question: Question, t: (key: string) => string): string {
  if (question.type === 'choice') return t('practice.types.choice');
  if (question.type === 'multiple') return t('practice.types.multiple');
  if (question.type === 'judge') return t('practice.types.judge');
  if (question.type === 'fill') return t('practice.types.fill');
  return t('practice.types.short');
}

export default function Records() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [docTitle, setDocTitle] = useState('');
  const [attemptMap, setAttemptMap] = useState<Record<number, QuestionAttemptSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const id = Number(docId);
    if (!id) return;

    (async () => {
      setLoading(true);
      try {
        const [qs, attempts, docs] = await Promise.all([
          window.api.getQuestionsByDocument(id),
          window.api.listAttemptsByDocument?.(id) ?? Promise.resolve([]),
          window.api.listDocuments(),
        ]);

        setQuestions(qs);
        const doc = docs.find((d) => d.id === id);
        setDocTitle(doc?.title ?? '');

        const map: Record<number, QuestionAttemptSnapshot> = {};
        const seen = new Map<number, QuestionAttemptSnapshot>();
        for (const a of attempts) {
          const prev = seen.get(a.question_id);
          if (!prev || a.attempted_at > prev.attempted_at) {
            seen.set(a.question_id, a);
          }
        }
        for (const [qid, a] of seen) {
          map[qid] = a;
        }
        setAttemptMap(map);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [docId]);

  const statuses = useMemo<QuestionStatus[]>(() => {
    return questions.map((q) => {
      const status = getAttemptStatus(q.id, attemptMap);
      if (status === 'unanswered') return 'unanswered';
      if (status === 'correct') return 'correct';
      return 'wrong';
    });
  }, [questions, attemptMap]);

  const correctCount = statuses.filter((s) => s === 'correct').length;
  const wrongCount = statuses.filter((s) => s === 'wrong').length;
  const unattemptedCount = statuses.filter((s) => s === 'unanswered').length;
  const totalAttempted = correctCount + wrongCount;

  const exportMarkdown = useMemo(() => {
    if (questions.length === 0) return '';
    const attemptRecords: Record<
      number,
      { userAnswer: string; isCorrect: boolean; attemptedAt?: number }
    > = {};
    for (const [qid, a] of Object.entries(attemptMap)) {
      attemptRecords[Number(qid)] = {
        userAnswer: a.user_answer,
        isCorrect: a.is_correct,
        attemptedAt: a.attempted_at,
      };
    }
    const summary = {
      correct: correctCount,
      wrong: wrongCount,
      unanswered: unattemptedCount,
      total: questions.length,
    };
    return renderPracticeResultsMarkdown(docTitle, questions, attemptRecords, summary);
  }, [questions, attemptMap, docTitle, correctCount, wrongCount, unattemptedCount]);

  function handleCopyMarkdown() {
    navigator.clipboard.writeText(exportMarkdown).then(
      () => toast.show('success', t('records.copied')),
      () => toast.show('error', 'Copy failed'),
    );
  }

  function handleExportMarkdown() {
    downloadMarkdownFile(exportMarkdown, `${docTitle || 'records'}-records.md`);
    toast.show('success', t('records.exported'));
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader
          title={t('records.title')}
          back={{ label: t('common.back'), onClick: () => navigate('/library') }}
        />
        <LoadingState label={t('records.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <PageHeader
          title={t('records.title')}
          back={{ label: t('common.back'), onClick: () => navigate('/library') }}
        />
        <div className="card" style={{ color: 'var(--danger)', textAlign: 'center', padding: 40 }}>
          {error}
        </div>
      </div>
    );
  }

  if (totalAttempted === 0) {
    return (
      <div className="page">
        <PageHeader
          title={t('records.title')}
          subtitle={docTitle}
          back={{ label: t('common.back'), onClick: () => navigate('/library') }}
        />
        <EmptyState
          icon={BookOpen}
          title={t('records.empty')}
          description={t('records.emptyHint')}
          action={{ label: t('records.back'), onClick: () => navigate('/library') }}
        />
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const currentAttempt = currentQuestion ? attemptMap[currentQuestion.id] : null;
  const currentStatus = currentQuestion
    ? getAttemptStatus(currentQuestion.id, attemptMap)
    : 'unanswered';
  const currentUserAnswer = currentAttempt?.user_answer ?? '';
  const selectedLetters = currentQuestion
    ? normalizeChoiceAnswer(currentUserAnswer, currentQuestion.options)
    : '';
  const correctLetters = currentQuestion
    ? normalizeChoiceAnswer(currentQuestion.answer, currentQuestion.options)
    : '';

  return (
    <div className="page practice-page practice-page-active records-page">
      <PageHeader
        title={t('records.title')}
        subtitle={docTitle}
        back={{ label: t('common.back'), onClick: () => navigate('/library') }}
        actions={
          <div className="row gap-sm">
            <button className="ghost" onClick={handleCopyMarkdown}>
              <Copy size={16} />
              <span>{t('records.copyMarkdown')}</span>
            </button>
            <button className="ghost" onClick={handleExportMarkdown}>
              <Download size={16} />
              <span>{t('records.exportMarkdown')}</span>
            </button>
          </div>
        }
      />

      <div className="practice-stage records-stage">
        <div className="practice-main">
          {currentQuestion && (
            <div className="practice-question-card records-question-card">
              <div className="practice-question-content">
                <div className="practice-question-meta">
                  <span className="badge muted">{getQuestionTypeLabel(currentQuestion, t)}</span>
                  {currentQuestion.page_or_section && (
                    <span className="badge muted">{currentQuestion.page_or_section}</span>
                  )}
                </div>

                <MarkdownContent
                  content={currentQuestion.stem}
                  className="practice-question-stem"
                />

                {isOptionQuestion(currentQuestion.type) && currentQuestion.options && (
                  <div className="practice-options">
                    {currentQuestion.options.map((option, index) => {
                      const letter = getChoiceOptionLetter(option, index);
                      const isCorrectOption =
                        currentStatus !== 'unanswered' && correctLetters.includes(letter);
                      const isPickedWrong =
                        currentStatus !== 'unanswered' &&
                        selectedLetters.includes(letter) &&
                        !correctLetters.includes(letter);

                      return (
                        <div
                          key={`${option}-${index}`}
                          className={`practice-option revealed${isCorrectOption ? ' is-correct' : ''}${isPickedWrong ? ' is-wrong' : ''}`}
                        >
                          <span className="practice-option-letter">{`${letter}. `}</span>
                          <MarkdownContent
                            content={getChoiceOptionText(option)}
                            className="practice-option-text"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="practice-result-card">
                  <div
                    className={`practice-result-status${currentStatus === 'correct' ? ' success' : currentStatus === 'wrong' ? ' error' : ''}`}
                    role="status"
                  >
                    {getStatusLabel(currentStatus, t)}
                  </div>

                  <div className="practice-result-block">
                    <div className="muted">{t('records.yourAnswer')}</div>
                    <div className="answer-panel">
                      {currentAttempt
                        ? formatQuestionAnswerDisplay(
                            currentQuestion.type,
                            currentUserAnswer,
                            currentQuestion.options,
                          )
                        : '—'}
                    </div>
                  </div>

                  <div className="practice-result-block">
                    <div className="muted">{t('records.reference')}</div>
                    <div className="answer-panel">
                      {formatQuestionAnswerDisplay(
                        currentQuestion.type,
                        currentQuestion.answer,
                        currentQuestion.options,
                      )}
                    </div>
                  </div>

                  {currentQuestion.explanation && (
                    <div className="practice-result-block">
                      <div className="muted">{t('records.explanation')}</div>
                      <div className="answer-panel explanation">
                        {currentQuestion.explanation}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="practice-submit-row records-submit-row">
                <button
                  type="button"
                  className="ghost"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((index) => index - 1)}
                >
                  {t('records.prev')}
                </button>
                <span className="muted records-question-progress">
                  {currentIdx + 1} / {questions.length}
                </span>
                <button
                  type="button"
                  className="ghost"
                  disabled={currentIdx >= questions.length - 1}
                  onClick={() => setCurrentIdx((index) => index + 1)}
                >
                  {t('records.next')}
                </button>
              </div>
            </div>
          )}
        </div>

        <QuestionNav
          current={currentIdx}
          total={questions.length}
          statuses={statuses}
          onJump={setCurrentIdx}
          correctCount={correctCount}
          wrongCount={wrongCount}
          remainingCount={unattemptedCount}
        />
      </div>
    </div>
  );
}
