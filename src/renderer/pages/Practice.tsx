import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Copy,
  Download,
  ListChecks,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { AppSettings, Question, QuestionAttemptSnapshot } from '@shared/types';
import { DEFAULT_SHORTCUTS, normalizeShortcutSettings } from '@shared/shortcuts';
import { formatQuestionAnswerDisplay } from '@shared/question-format';
import { renderPracticeResultsMarkdown } from '@shared/openstudy-standard';
import QuestionCard from '../components/QuestionCard';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { QuestionNav, type QuestionStatus } from '../components/QuestionNav';
import { PracticeAsk } from '../components/PracticeAsk';
import { useToast } from '../components/ToastProvider';
import {
  loadStoredAttempts,
  saveStoredAttempts,
  type StoredAttemptRecord,
} from '../utils/practice-attempts';

interface AttemptRecord {
  question: Question;
  userAnswer: string;
  isCorrect: boolean;
  feedback?: string | null;
  attemptedAt?: number;
}

function buildAttemptMap(
  questions: Question[],
  attempts: QuestionAttemptSnapshot[],
): Record<number, AttemptRecord> {
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  return attempts.reduce<Record<number, AttemptRecord>>((acc, attempt) => {
    const question = questionMap.get(attempt.question_id);
    if (!question) return acc;
    acc[attempt.question_id] = {
      question,
      userAnswer: attempt.user_answer,
      isCorrect: attempt.is_correct,
      feedback: null,
      attemptedAt: attempt.attempted_at,
    };
    return acc;
  }, {});
}

function buildStoredAttemptMap(
  questions: Question[],
  attempts: StoredAttemptRecord[],
): Record<number, AttemptRecord> {
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  return attempts.reduce<Record<number, AttemptRecord>>((acc, attempt) => {
    const question = questionMap.get(attempt.questionId);
    if (!question) return acc;
    acc[attempt.questionId] = {
      question,
      userAnswer: attempt.userAnswer,
      isCorrect: attempt.isCorrect,
      feedback: attempt.feedback ?? null,
      attemptedAt: attempt.attemptedAt,
    };
    return acc;
  }, {});
}

function mergeAttemptMaps(
  primary: Record<number, AttemptRecord>,
  secondary: Record<number, AttemptRecord>,
): Record<number, AttemptRecord> {
  const merged: Record<number, AttemptRecord> = { ...secondary };
  for (const [key, value] of Object.entries(primary)) {
    const current = merged[Number(key)];
    if (!current || (value.attemptedAt ?? 0) >= (current.attemptedAt ?? 0)) {
      merged[Number(key)] = value;
    }
  }
  return merged;
}

export default function Practice() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const toast = useToast();
  const fromWrong = searchParams.get('from') === 'wrong';
  const targetQuestionId = Number(searchParams.get('q'));
  const aiRequested = searchParams.get('ai') === '1';

  const [idx, setIdx] = useState(0);
  const [filter, setFilter] = useState<'all' | 'wrong'>(
    fromWrong ? 'wrong' : 'all',
  );
  const [practiceList, setPracticeList] = useState<Question[]>([]);
  const [attemptMap, setAttemptMap] = useState<Record<number, AttemptRecord>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiOpen, setAiOpen] = useState(aiRequested);
  const [cardRevision, setCardRevision] = useState(0);
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [docTitle, setDocTitle] = useState('');

  useEffect(() => {
    setAiOpen(aiRequested);
  }, [aiRequested, docId]);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const settings = (await window.api.getSettings()) as AppSettings;
        if (!cancelled) {
          setShortcuts(normalizeShortcutSettings(settings.shortcuts));
        }
      } catch {
        if (!cancelled) {
          setShortcuts(DEFAULT_SHORTCUTS);
        }
      }
    };
    const onUpdated = () => {
      void loadSettings();
    };
    void loadSettings();
    window.addEventListener('openstudy:settings-updated', onUpdated as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('openstudy:settings-updated', onUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!docId) return;
    if (!window.api) {
      console.error('window.api 未注入');
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    const load = async () => {
      try {
        const effectiveFilter = fromWrong ? 'wrong' : filter;
        const [next, snapshots] = await Promise.all([
          effectiveFilter === 'wrong'
            ? window.api
                .listWrongQuestions()
                .then((items) =>
                  items
                    .filter((q) => q.document_id === Number(docId))
                    .map((q) => {
                      const {
                        last_wrong_answer,
                        last_wrong_at,
                        document_title,
                        document_file_type,
                        ...question
                      } = q;
                      return question as Question;
                    }),
                )
            : window.api.getQuestionsByDocument(Number(docId)),
          Promise.resolve(window.api.listAttemptsByDocument?.(Number(docId)) ?? []).catch(
            () => [],
          ),
        ]);
        // Load document title
        window.api.listDocuments().then((docs) => {
          const doc = docs.find((d) => d.id === Number(docId));
          if (doc && !cancelled) setDocTitle(doc.title);
        }).catch(() => {});
        if (cancelled) return;
        const dbAttemptMap = buildAttemptMap(next, snapshots);
        const storedAttemptMap = buildStoredAttemptMap(next, loadStoredAttempts(Number(docId)));
        const mergedAttemptMap = fromWrong
          ? {}
          : mergeAttemptMaps(storedAttemptMap, dbAttemptMap);
        setPracticeList(next);
        const targetIndex =
          Number.isFinite(targetQuestionId) && targetQuestionId > 0
            ? next.findIndex((item) => item.id === targetQuestionId)
            : -1;
        setIdx(targetIndex >= 0 ? targetIndex : 0);
        setAttemptMap(mergedAttemptMap);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [docId, filter, fromWrong, targetQuestionId]);

  function onFilterChange(next: 'all' | 'wrong') {
    setFilter(next);
    if (fromWrong && next !== 'wrong') {
      const np = new URLSearchParams(searchParams);
      np.delete('from');
      setSearchParams(np, { replace: true });
    }
  }

  const backTarget = fromWrong ? '/wrong' : '/library';
  const backLabel = fromWrong
    ? t('practice.completion.backToWrongbook')
    : t('practice.completion.backToLibrary');

  const attempts = useMemo(
    () =>
      practiceList
        .map((question) => attemptMap[question.id])
        .filter((item): item is AttemptRecord => Boolean(item)),
    [attemptMap, practiceList],
  );

  const done = useMemo(
    () => ({
      correct: attempts.filter((item) => item.isCorrect).length,
      wrong: attempts.filter((item) => !item.isCorrect).length,
    }),
    [attempts],
  );

  const statuses = useMemo<QuestionStatus[]>(
    () =>
      practiceList.map((question) => {
        const attempt = attemptMap[question.id];
        if (!attempt) return 'unanswered';
        return attempt.isCorrect ? 'correct' : 'wrong';
      }),
    [attemptMap, practiceList],
  );

  const remainingCount = Math.max(practiceList.length - attempts.length, 0);

  const exportMarkdown = useMemo(() => {
    const title = docTitle || `${t('practice.completion.docLabel', { id: Number(docId) })}`;
    return renderPracticeResultsMarkdown(
      title,
      practiceList,
      Object.fromEntries(
        Object.entries(attemptMap).map(([qid, rec]) => [
          Number(qid),
          { userAnswer: rec.userAnswer, isCorrect: rec.isCorrect },
        ]),
      ),
      { correct: done.correct, wrong: done.wrong, total: attempts.length },
    );
  }, [docTitle, practiceList, attemptMap, done, docId, t]);

  function handleCopyMarkdown() {
    navigator.clipboard
      .writeText(exportMarkdown)
      .then(() => toast.show('success', t('practice.completion.copied')))
      .catch(() => toast.show('error', t('templates.copyFailed')));
  }

  function handleExportMarkdown() {
    const title = docTitle || `doc-${docId}`;
    const filename = `${title.replace(/[/\\?%*:|"<>]/g, '_')}-practice.md`;
    const blob = new Blob([exportMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.show('success', t('practice.completion.exported'));
  }

  function restart() {
    setIdx(0);
    setAttemptMap({});
    setCardRevision((current) => current + 1);
  }

  function goPrev() {
    setIdx((current) => Math.max(current - 1, 0));
  }

  function goNext() {
    setIdx((current) => Math.min(current + 1, practiceList.length));
  }

  function jumpToQuestion(nextIndex: number) {
    setIdx(nextIndex);
    setCardRevision((current) => current + 1);
  }

  if (!docId) return <Navigate to="/library" replace />;

  if (loading) {
    return (
      <div className="page practice-page">
        <PageHeader
          title={t('practice.title')}
          back={{ label: t('common.back'), onClick: () => navigate(backTarget) }}
        />
        <LoadingState label={t('practice.loading')} />
      </div>
    );
  }

  if (practiceList.length === 0) {
    return (
      <div className="page practice-page">
        <PageHeader
          title={t('practice.title')}
          back={{ label: t('common.back'), onClick: () => navigate(backTarget) }}
        />
        {error ? (
          <div className="card error" role="alert">{error}</div>
        ) : (
          <EmptyState
            icon={ListChecks}
            title={t('practice.noQuestions')}
            description={t('practice.noQuestionsHint')}
            action={{ label: backLabel, onClick: () => navigate(backTarget) }}
          />
        )}
      </div>
    );
  }

  if (idx >= practiceList.length) {
    const allCorrect = done.wrong === 0 && done.correct > 0;
    const wrongOnes = attempts.filter((item) => !item.isCorrect);
    return (
      <div className="page practice-page">
        <PageHeader
          title={t('practice.completion.title')}
          back={{ label: t('common.back'), onClick: () => navigate(backTarget) }}
        />
        <div className="card">
          <div className="row gap-md">
            <span className="badge success">
              {t('practice.completion.correctCount', { count: done.correct })}
            </span>
            <span className="badge error">
              {t('practice.completion.wrongCount', { count: done.wrong })}
            </span>
          </div>

          {fromWrong && allCorrect && (
            <div className="card success" style={{ marginTop: 12 }}>
              <div className="row gap-sm">
                <PartyPopper size={18} />
                <strong>{t('practice.completion.masteredAll')}</strong>
              </div>
            </div>
          )}

          <div className="row gap-sm mt-md" style={{ flexWrap: 'wrap' }}>
            <button onClick={restart}>
              <RotateCcw size={16} />
              <span>{t('practice.completion.again')}</span>
            </button>
            {wrongOnes.length > 0 && (
              <button onClick={() => navigate(`/practice/${docId}?from=wrong`)}>
                <RefreshCw size={16} />
                <span>{t('practice.completion.redoWrong', { count: wrongOnes.length })}</span>
              </button>
            )}
            <button onClick={handleCopyMarkdown} title={t('practice.completion.copyMarkdown')}>
              <Copy size={16} />
              <span>{t('practice.completion.copyMarkdown')}</span>
            </button>
            <button onClick={handleExportMarkdown} title={t('practice.completion.exportMarkdown')}>
              <Download size={16} />
              <span>{t('practice.completion.exportMarkdown')}</span>
            </button>
            <button onClick={() => navigate(backTarget)}>
              <ArrowLeft size={16} />
              <span>{backLabel}</span>
            </button>
          </div>
        </div>

        {wrongOnes.length > 0 && (
          <>
            <h2 style={{ marginTop: 24 }}>
              {t('practice.completion.wrongListTitle', {
                count: wrongOnes.length,
              })}
            </h2>
            {wrongOnes.map((item) => (
              <div key={item.question.id} className="card">
                <div className="row gap-sm" style={{ marginBottom: 6 }}>
                  <span className="badge muted">
                    {item.question.type === 'choice'
                      ? t('practice.types.choice')
                      : item.question.type === 'multiple'
                        ? t('practice.types.multiple')
                      : item.question.type === 'judge'
                        ? t('practice.types.judge')
                      : item.question.type === 'fill'
                        ? t('practice.types.fill')
                        : t('practice.types.short')}
                  </span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{item.question.stem}</div>
                <div className="error mt-md">
                  {t('wrongbook.yourAnswer', {
                    text:
                      item.userAnswer
                        ? formatQuestionAnswerDisplay(
                            item.question.type,
                            item.userAnswer,
                            item.question.options,
                          )
                        : t('practice.result.yourAnswerEmpty'),
                  })}
                </div>
                <div className="success mt-md">
                  {t('wrongbook.reference', {
                    text: formatQuestionAnswerDisplay(
                      item.question.type,
                      item.question.answer,
                      item.question.options,
                    ),
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  const q = practiceList[idx];
  const currentAttempt = attemptMap[q.id] ?? null;

  return (
    <div className="page practice-page practice-page-active">
      {fromWrong && (
        <div className="card warning mb-md">
          <div className="row gap-sm">
            <RefreshCw size={16} />
            <span>{t('practice.redoBanner')}</span>
          </div>
        </div>
      )}

      <PageHeader
        title={t('practice.title')}
        back={{ label: t('practice.back'), onClick: () => navigate(backTarget) }}
        actions={
          <div className="row gap-sm">
            <select
              className="practice-filter-select"
              aria-label={t('practice.filterLabel')}
              value={filter}
              onChange={(e) => onFilterChange(e.target.value as 'all' | 'wrong')}
            >
              <option value="all">{t('practice.filterAll')}</option>
              <option value="wrong">{t('practice.filterWrong')}</option>
            </select>
            <button
              type="button"
              className={`ghost icon-only practice-ai-toggle${aiOpen ? ' is-open' : ''}`}
              onClick={() => setAiOpen((cur) => !cur)}
              aria-label={aiOpen ? t('common.close') : t('practice.ask.title')}
              aria-expanded={aiOpen}
              title={aiOpen ? t('common.close') : t('practice.ask.title')}
            >
              {aiOpen ? <X size={16} /> : <Sparkles size={16} />}
            </button>
          </div>
        }
      />

      {error && <div className="card error" role="alert">{error}</div>}

      <div className={`practice-stage${aiOpen ? ' is-ai-open' : ''}`}>
        <div className="practice-main">
          <QuestionCard
            key={`${q.id}:${cardRevision}`}
            question={q}
            initialAnswer={currentAttempt?.userAnswer ?? ''}
            shortcuts={shortcuts}
            aiOpen={aiOpen}
            hasPrev={idx > 0}
            hasNext={idx < practiceList.length}
            onPrev={goPrev}
            onSubmit={(userAnswer, isCorrect, feedback) => {
              const record: AttemptRecord = {
                question: q,
                userAnswer,
                isCorrect,
                feedback,
                attemptedAt: Date.now(),
              };
              const nextMap = {
                ...attemptMap,
                [q.id]: record,
              };
              setAttemptMap(nextMap);
              saveStoredAttempts(Number(docId), Object.values(nextMap));
              window.api
                .saveAttempt(q.id, userAnswer, isCorrect)
                .catch((err) => console.error('saveAttempt failed', err));
            }}
            onNext={goNext}
          />
        </div>

        {aiOpen ? (
          <PracticeAsk docId={Number(docId)} open={aiOpen} question={q} review={currentAttempt} />
        ) : (
          <QuestionNav
            current={idx}
            total={practiceList.length}
            statuses={statuses}
            onJump={jumpToQuestion}
            correctCount={done.correct}
            wrongCount={done.wrong}
            remainingCount={remainingCount}
          />
        )}
      </div>
    </div>
  );
}
