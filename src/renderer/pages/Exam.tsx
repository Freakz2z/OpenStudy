import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ClipboardCheck, Copy, Download, RotateCcw } from 'lucide-react';
import type { AppSettings, Question, QuestionAttemptSnapshot } from '@shared/types';
import { DEFAULT_SHORTCUTS, normalizeShortcutSettings } from '@shared/shortcuts';
import { renderPracticeResultsMarkdown } from '@shared/openstudy-standard';
import {
  isAiAssistedQuestion,
  isExactFillMatch,
  localCheckAnswer,
  localGradeAnswer,
} from '@shared/practice-grading';
import QuestionCard from '../components/QuestionCard';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { QuestionNav, type QuestionStatus } from '../components/QuestionNav';
import { useToast } from '../components/ToastProvider';
import {
  clearExamState,
  loadExamAnswers,
  loadExamStartTime,
  saveExamAnswers,
  saveExamStartTime,
} from '../utils/practice-attempts';
import { downloadMarkdownFile } from '../utils/helpers';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Exam() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();

  const [idx, setIdx] = useState(0);
  const [examList, setExamList] = useState<Question[]>([]);
  const [examAnswerMap, setExamAnswerMap] = useState<Record<number, string>>({});
  const [examStartTime, setExamStartTime] = useState<number>(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<Record<number, { isCorrect: boolean; feedback?: string | null }>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [docTitle, setDocTitle] = useState('');
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [cardRevision, setCardRevision] = useState(0);

  const answeredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const settings = (await window.api.getSettings()) as AppSettings;
        if (!cancelled) setShortcuts(normalizeShortcutSettings(settings.shortcuts));
      } catch {
        if (!cancelled) setShortcuts(DEFAULT_SHORTCUTS);
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
    let cancelled = false;
    setError(null);
    setLoading(true);
    const load = async () => {
      try {
        const [questions, snapshots] = await Promise.all([
          window.api.getQuestionsByDocument(Number(docId)),
          Promise.resolve(window.api.listAttemptsByDocument?.(Number(docId)) ?? []).catch(() => []),
        ]);
        window.api.listDocuments().then((docs) => {
          const doc = docs.find((d) => d.id === Number(docId));
          if (doc && !cancelled) setDocTitle(doc.title);
        }).catch(() => {});

        if (cancelled) return;

        // Restore saved exam state
        const savedAnswers = loadExamAnswers(Number(docId));
        const savedStartTime = loadExamStartTime(Number(docId));

        if (Object.keys(savedAnswers).length > 0 && savedStartTime) {
          setExamAnswerMap(savedAnswers);
          setExamStartTime(savedStartTime);
          answeredRef.current = true;
        } else {
          const now = Date.now();
          setExamStartTime(now);
          saveExamStartTime(Number(docId), now);
        }

        setExamList(questions);
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
  }, [docId]);

  // Timer
  useEffect(() => {
    if (submitted) return;
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - examStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [examStartTime, submitted]);

  // Leave guard
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!submitted && Object.keys(examAnswerMap).length > 0) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [submitted, examAnswerMap]);

  function handleLeave() {
    if (!submitted && Object.keys(examAnswerMap).length > 0) {
      if (!confirm(t('exam.confirm.leave'))) return;
    }
    clearExamState(Number(docId));
    navigate('/library');
  }

  function handleAnswerChange(questionId: number, userAnswer: string) {
    const next = { ...examAnswerMap, [questionId]: userAnswer };
    setExamAnswerMap(next);
    saveExamAnswers(Number(docId!), next);
  }

  async function handleSubmitExam() {
    if (!confirm(t('exam.confirm.submit'))) return;
    setGrading(true);

    const resultMap: Record<number, { isCorrect: boolean; feedback?: string | null }> = {};

    for (const q of examList) {
      const ua = examAnswerMap[q.id]?.trim();
      if (!ua) continue;

      if (isExactFillMatch(q, ua)) {
        resultMap[q.id] = { isCorrect: true, feedback: '答案与参考答案完全一致，已直接判定正确。' };
      } else if (isAiAssistedQuestion(q.type)) {
        const fallback = localGradeAnswer(q, ua);
        const graded = await window.api.gradePracticeAnswer({
          question: { type: q.type, stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation },
          userAnswer: ua,
        }).catch(() => ({ ...fallback, mode: 'fallback' as const }));
        resultMap[q.id] = { isCorrect: graded.isCorrect, feedback: graded.reason || fallback.reason };
      } else {
        const ok = localCheckAnswer(q, ua);
        resultMap[q.id] = { isCorrect: ok, feedback: null };
      }

      window.api.saveAttempt(q.id, ua, resultMap[q.id].isCorrect).catch((err) => console.error(err));
    }

    setResults(resultMap);
    setGrading(false);
    setSubmitted(true);
    clearExamState(Number(docId));
  }

  function retake() {
    const now = Date.now();
    setExamAnswerMap({});
    setExamStartTime(now);
    saveExamStartTime(Number(docId!), now);
    clearExamState(Number(docId!));
    setSubmitted(false);
    setResults({});
    setIdx(0);
    setCardRevision((c) => c + 1);
    answeredRef.current = false;
  }

  const statuses = useMemo<QuestionStatus[]>(
    () => examList.map((q) => (examAnswerMap[q.id]?.trim() ? 'answered' : 'unanswered')),
    [examList, examAnswerMap],
  );

  const answeredCount = useMemo(
    () => Object.values(examAnswerMap).filter((v) => v.trim()).length,
    [examAnswerMap],
  );
  const unansweredCount = examList.length - answeredCount;

  // Results
  const correctCount = useMemo(
    () => Object.values(results).filter((r) => r.isCorrect).length,
    [results],
  );
  const wrongCount = useMemo(
    () => Object.values(results).filter((r) => !r.isCorrect).length,
    [results],
  );

  const exportMarkdown = useMemo(() => {
    const title = docTitle || t('exam.result.docLabel', { id: Number(docId) });
    const md = renderPracticeResultsMarkdown(
      title,
      examList,
      Object.fromEntries(
        Object.entries(results).map(([qid, r]) => [
          Number(qid),
          { userAnswer: examAnswerMap[Number(qid)] ?? '', isCorrect: r.isCorrect },
        ]),
      ),
      { correct: correctCount, wrong: wrongCount, total: answeredCount },
    );
    return `> 用时：${formatTime(elapsedSec)}\n\n${md}`;
  }, [docTitle, examList, results, examAnswerMap, correctCount, wrongCount, answeredCount, elapsedSec, docId, t]);

  function handleCopyMarkdown() {
    navigator.clipboard.writeText(exportMarkdown)
      .then(() => toast.show('success', t('exam.result.copied')))
      .catch(() => toast.show('error', t('templates.copyFailed')));
  }

  function handleExportMarkdown() {
    const title = docTitle || `doc-${docId}`;
    const filename = `${title.replace(/[/\\?%*:|"<>]/g, '_')}-exam.md`;
    downloadMarkdownFile(exportMarkdown, filename);
    toast.show('success', t('exam.result.exported'));
  }

  if (!docId) return <Navigate to="/library" replace />;

  if (loading) {
    return (
      <div className="page practice-page">
        <PageHeader
          title={t('exam.title')}
          back={{ label: t('common.back'), onClick: () => navigate('/library') }}
        />
        <LoadingState label={t('exam.loading')} />
      </div>
    );
  }

  if (examList.length === 0) {
    return (
      <div className="page practice-page">
        <PageHeader
          title={t('exam.title')}
          back={{ label: t('common.back'), onClick: () => navigate('/library') }}
        />
        {error ? (
          <div className="card error" role="alert">{error}</div>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title={t('exam.noQuestions')}
            description={t('exam.noQuestionsHint')}
            action={{ label: t('exam.buttons.backToLibrary'), onClick: () => navigate('/library') }}
          />
        )}
      </div>
    );
  }

  // Results screen
  if (submitted) {
    const unansweredResults = examList.filter((q) => !examAnswerMap[q.id]?.trim());
    const wrongResults = examList.filter((q) => {
      const r = results[q.id];
      return r && !r.isCorrect;
    });

    return (
      <div className="page practice-page">
        <PageHeader
          title={t('exam.result.title')}
          back={{ label: t('common.back'), onClick: () => navigate('/library') }}
        />

        <div className="card">
          <div className="row gap-md wrap">
            <span className="badge success">{t('exam.result.correctCount', { count: correctCount })}</span>
            <span className="badge error">{t('exam.result.wrongCount', { count: wrongCount })}</span>
            <span className="badge muted">{t('exam.result.unansweredCount', { count: unansweredCount })}</span>
          </div>
          <div className="row gap-sm mt-md wrap">
            <span className="muted">{t('exam.result.timeTaken', { time: formatTime(elapsedSec) })}</span>
            {answeredCount > 0 && (
              <span className="muted">
                {t('exam.result.accuracy', {
                  pct: `${Math.round((correctCount / Math.max(answeredCount, 1)) * 100)}%`,
                })}
              </span>
            )}
          </div>

          <div className="row gap-sm mt-md wrap">
            <button onClick={retake}>
              <RotateCcw size={16} />
              <span>{t('exam.buttons.again')}</span>
            </button>
            <button onClick={handleCopyMarkdown}>
              <Copy size={16} />
              <span>{t('exam.buttons.copyMarkdown')}</span>
            </button>
            <button onClick={handleExportMarkdown}>
              <Download size={16} />
              <span>{t('exam.buttons.exportMarkdown')}</span>
            </button>
            <button onClick={() => navigate('/library')}>
              <ArrowLeft size={16} />
              <span>{t('exam.buttons.backToLibrary')}</span>
            </button>
          </div>
        </div>

        {wrongResults.length > 0 && (
          <>
            <h2 className="mt-xl">{t('exam.result.wrongListTitle', { count: wrongResults.length })}</h2>
            {wrongResults.map((q) => {
              const r = results[q.id];
              return (
                <div key={q.id} className="card">
                  <div className="row gap-sm mb-sm">
                    <span className="badge muted">{t(`practice.types.${q.type}`)}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{q.stem}</div>
                  <div className="error mt-md">{t('wrongbook.yourAnswer', { text: examAnswerMap[q.id] || t('practice.result.yourAnswerEmpty') })}</div>
                  <div className="success mt-md">{t('wrongbook.reference', { text: q.answer })}</div>
                  {r?.feedback && <div className="muted mt-md">{r.feedback}</div>}
                </div>
              );
            })}
          </>
        )}

        {unansweredResults.length > 0 && (
          <>
            <h2 className="mt-xl">{t('exam.result.unansweredCount', { count: unansweredResults.length })}</h2>
            {unansweredResults.map((q) => (
              <div key={q.id} className="card">
                <div className="row gap-sm mb-sm">
                  <span className="badge muted">{t(`practice.types.${q.type}`)}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{q.stem}</div>
                <div className="success mt-md">{t('wrongbook.reference', { text: q.answer })}</div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // Active exam
  const q = examList[idx];

  return (
    <div className="page practice-page practice-page-active">
      <PageHeader
        title={t('exam.title')}
        back={{ label: t('exam.back'), onClick: handleLeave }}
        actions={
          <div className="row gap-sm">
            <span className="exam-timer">
              {formatTime(elapsedSec)}
            </span>
          </div>
        }
      />

      {error && <div className="card error" role="alert">{error}</div>}

      <div className="practice-stage">
        <div className="practice-main">
          <QuestionCard
            key={`${q.id}:${cardRevision}`}
            question={q}
            initialAnswer={examAnswerMap[q.id] ?? ''}
            shortcuts={shortcuts}
            examMode
            onAnswerChange={(ua) => handleAnswerChange(q.id, ua)}
            hasPrev={idx > 0}
            hasNext={idx < examList.length}
            onPrev={() => setIdx((c) => Math.max(c - 1, 0))}
            onNext={() => setIdx((c) => Math.min(c + 1, examList.length))}
          />
        </div>

        <QuestionNav
          current={idx}
          total={examList.length}
          statuses={statuses}
          onJump={(i) => { setIdx(i); setCardRevision((c) => c + 1); }}
          examMode
          answeredCount={answeredCount}
          unansweredCount={unansweredCount}
        />
      </div>

      {idx >= examList.length - 1 && (
        <div className="exam-final-submit-bar">
          <button
            className="primary"
            disabled={grading}
            onClick={() => { void handleSubmitExam(); }}
          >
            {grading ? t('exam.buttons.submitting') : t('exam.buttons.submitExam')}
          </button>
        </div>
      )}
    </div>
  );
}
