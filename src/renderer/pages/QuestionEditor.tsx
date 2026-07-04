import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import type { Question, QuestionType } from '@shared/types';
import { type ShortcutBinding } from '@shared/shortcuts';
import {
  isOptionQuestion,
  normalizeChoiceAnswer,
  normalizeChoiceOptions,
} from '@shared/question-format';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { formatShortcut, matchesShortcut } from '../utils/shortcuts';

const EDITOR_SAVE_CURRENT_SHORTCUT: ShortcutBinding = { key: 'S', mod: true };
const EDITOR_SAVE_ALL_SHORTCUT: ShortcutBinding = { key: 'S', mod: true, shift: true };

type DraftQuestion = {
  type: QuestionType;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
};

function toDraft(q: Question): DraftQuestion {
  const normalizedOptions =
    isOptionQuestion(q.type)
      ? normalizeChoiceOptions(q.options) ?? ['', '', '', '']
      : ['', '', '', ''];
  return {
    type: q.type,
    stem: q.stem,
    options: normalizedOptions,
    answer:
      isOptionQuestion(q.type)
        ? normalizeChoiceAnswer(q.answer, normalizedOptions)
        : q.answer,
    explanation: q.explanation ?? '',
  };
}

function getOptionLabel(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

export default function QuestionEditor() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftQuestion>>({});
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (!docId) return;
    if (!window.api) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      window.api.getQuestionsByDocument(Number(docId)),
      window.api.listDocuments(),
    ])
      .then(([qs, docs]) => {
        if (cancelled) return;
        setQuestions(qs);
        const next: Record<number, DraftQuestion> = {};
        for (const q of qs) next[q.id] = toDraft(q);
        setDrafts(next);
        setDirtyIds(new Set());
        setSavedIds(new Set());
        setCurrentIdx(0);
        setDocTitle(docs.find((d) => d.id === Number(docId))?.title ?? '');
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    if (questions.length === 0) return;
    setCurrentIdx((current) => Math.min(current, questions.length - 1));
  }, [questions.length]);

  function markDirty(id: number) {
    setDirtyIds((current) => new Set(current).add(id));
    setSavedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function patch(id: number, p: Partial<DraftQuestion>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...p } }));
    markDirty(id);
  }

  function setOption(id: number, idx: number, value: string) {
    setDrafts((current) => {
      const draft = current[id];
      const options = [...draft.options];
      options[idx] = value;
      return { ...current, [id]: { ...draft, options } };
    });
    markDirty(id);
  }

  function addOption(id: number) {
    setDrafts((current) => {
      const draft = current[id];
      return { ...current, [id]: { ...draft, options: [...draft.options, ''] } };
    });
    markDirty(id);
  }

  function removeOption(id: number, idx: number) {
    setDrafts((current) => {
      const draft = current[id];
      const options = draft.options.filter((_, optionIndex) => optionIndex !== idx);
      return { ...current, [id]: { ...draft, options: options.length ? options : [''] } };
    });
    markDirty(id);
  }

  async function saveOne(id: number) {
    const draft = drafts[id];
    if (!draft || savingIds.has(id)) return;
    setError(null);
    setSavingIds((current) => new Set(current).add(id));
    try {
      const normalizedOptions =
        isOptionQuestion(draft.type)
          ? normalizeChoiceOptions(draft.options.map((option) => option.trim()).filter(Boolean))
          : null;
      await window.api.updateQuestion(id, {
        type: draft.type,
        stem: draft.stem.trim(),
        options: normalizedOptions,
        answer:
          isOptionQuestion(draft.type)
            ? normalizeChoiceAnswer(draft.answer.trim(), normalizedOptions)
            : draft.answer.trim(),
        explanation: draft.explanation.trim() || null,
      });
      setSavedIds((current) => new Set(current).add(id));
      setDirtyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function saveAll() {
    const dirtyQuestions = questions.filter((question) => {
      const draft = drafts[question.id];
      if (!draft) return false;
      return dirtyIds.has(question.id) && draft.stem.trim() && draft.answer.trim();
    });

    if (dirtyQuestions.length === 0) {
      setError(t('editor.noChanges'));
      return;
    }

    for (const question of dirtyQuestions) {
      await saveOne(question.id);
    }
  }

  const dirtyCount = dirtyIds.size;

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyCount === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirtyCount]);

  function goBack() {
    if (dirtyCount > 0 && !window.confirm(t('editor.leaveConfirm'))) return;
    navigate('/library');
  }

  const currentQuestion = questions[currentIdx];
  const currentDraft = currentQuestion ? drafts[currentQuestion.id] : null;
  const savedCount = savedIds.size;
  const idleCount = Math.max(questions.length - dirtyCount - savedCount, 0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (matchesShortcut(event, EDITOR_SAVE_ALL_SHORTCUT)) {
        event.preventDefault();
        void saveAll();
        return;
      }
      if (matchesShortcut(event, EDITOR_SAVE_CURRENT_SHORTCUT)) {
        event.preventDefault();
        if (currentQuestion) {
          void saveOne(currentQuestion.id);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentQuestion, drafts, dirtyIds, savingIds, questions]);

  const typeOptions = useMemo(
    () => ([
      { value: 'choice', label: t('editor.types.choice') },
      { value: 'multiple', label: t('editor.types.multiple') },
      { value: 'judge', label: t('editor.types.judge') },
      { value: 'fill', label: t('editor.types.fill') },
      { value: 'short', label: t('editor.types.short') },
    ]) satisfies Array<{ value: QuestionType; label: string }>,
    [t],
  );

  const typeLabelMap = useMemo(
    () => Object.fromEntries(typeOptions.map((item) => [item.value, item.label])) as Record<
      QuestionType,
      string
    >,
    [typeOptions],
  );

  function getEditorStatus(id: number): 'saving' | 'dirty' | 'saved' | 'idle' {
    if (savingIds.has(id)) return 'saving';
    if (dirtyIds.has(id)) return 'dirty';
    if (savedIds.has(id)) return 'saved';
    return 'idle';
  }

  function getStatusLabel(status: ReturnType<typeof getEditorStatus>) {
    return t(`editor.status.${status}`);
  }

  if (!docId) return <Navigate to="/library" replace />;

  if (loading) {
    return (
      <div className="page">
        <PageHeader
          title={t('editor.title')}
          back={{ label: t('editor.back'), onClick: goBack }}
        />
        <LoadingState label={t('editor.loading')} />
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="page">
        <PageHeader
          title={t('editor.title')}
          back={{ label: t('editor.back'), onClick: goBack }}
        />
        <EmptyState
          icon={FileText}
          title={t('editor.empty')}
          description={t('editor.emptyHint')}
        />
      </div>
    );
  }

  if (!currentQuestion || !currentDraft) return <Navigate to="/library" replace />;

  const currentStatus = getEditorStatus(currentQuestion.id);
  const currentSaving = savingIds.has(currentQuestion.id);
  const canSaveCurrent = Boolean(currentDraft.stem.trim() && currentDraft.answer.trim());

  return (
    <div className="page">
      <PageHeader
        back={{ label: t('editor.back'), onClick: goBack }}
        title={
          <>
            {t('editor.title')}
            <span className="page-subtitle muted">
              {' · '}
              {docTitle || `#${docId}`}
            </span>
          </>
        }
        actions={(
          <div className="row gap-sm">
            <span className={`badge ${dirtyCount > 0 ? 'warning' : 'muted'}`}>
              {t('editor.dirtyCount', { count: dirtyCount })}
            </span>
            <button
              className="icon-only primary"
              onClick={() => void saveAll()}
              disabled={dirtyCount === 0}
              aria-label={t('editor.saveAll')}
              title={t('editor.saveAll')}
            >
              <Save size={16} />
            </button>
          </div>
        )}
      />

      {error && (
        <div className="card error mb-md" role="alert">
          <div className="row gap-sm">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="card editor-summary">
        <div className="row gap-sm wrap">
          <span className="badge primary">
            {t('editor.progress', { current: currentIdx + 1, total: questions.length })}
          </span>
          <span className="badge">{typeLabelMap[currentDraft.type]}</span>
          <span
            className={`badge ${
              currentStatus === 'saved'
                ? 'success'
                : currentStatus === 'dirty'
                  ? 'warning'
                  : currentStatus === 'saving'
                    ? 'info'
                    : 'muted'
            }`}
          >
            {getStatusLabel(currentStatus)}
          </span>
          <span className="badge muted">#{currentQuestion.id}</span>
        </div>
        <div className="tiny">
          {t('editor.shortcutHint', {
            saveCurrent: formatShortcut(EDITOR_SAVE_CURRENT_SHORTCUT),
            saveAll: formatShortcut(EDITOR_SAVE_ALL_SHORTCUT),
          })}
        </div>
      </div>

      <div className="editor-stage">
        <section className="editor-main">
          <div className="editor-toolbar">
            <div className="editor-toolbar-copy">
              <h2>{currentDraft.stem.trim() || t('editor.untitledQuestion')}</h2>
              <div className="row gap-sm wrap tiny">
                <span>{typeLabelMap[currentDraft.type]}</span>
                <span>·</span>
                <span>{getStatusLabel(currentStatus)}</span>
                {currentSaving && (
                  <>
                    <span>·</span>
                    <span className="row gap-xs">
                      <Loader2 size={12} className="spin" />
                      {t('editor.buttons.saving')}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="row gap-sm">
              <button
                className="icon-only ghost"
                onClick={() => setCurrentIdx((index) => Math.max(index - 1, 0))}
                disabled={currentIdx === 0}
                aria-label={t('practice.actions.prev')}
                title={t('practice.actions.prev')}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="icon-only primary"
                onClick={() => void saveOne(currentQuestion.id)}
                disabled={currentSaving || !canSaveCurrent}
                aria-label={t('editor.buttons.save')}
                title={t('editor.buttons.save')}
              >
                {currentSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              </button>
              <button
                className="icon-only ghost"
                onClick={() => setCurrentIdx((index) => Math.min(index + 1, questions.length - 1))}
                disabled={currentIdx === questions.length - 1}
                aria-label={t('practice.actions.next')}
                title={t('practice.actions.next')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="editor-form">
            <div className="editor-field">
              <label htmlFor="editor-type">{t('editor.fields.type')}</label>
              <select
                id="editor-type"
                value={currentDraft.type}
                onChange={(event) =>
                  patch(currentQuestion.id, { type: event.target.value as QuestionType })
                }
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="editor-field">
              <label htmlFor="editor-stem">{t('editor.fields.stem')}</label>
              <textarea
                id="editor-stem"
                value={currentDraft.stem}
                onChange={(event) => patch(currentQuestion.id, { stem: event.target.value })}
                rows={8}
              />
            </div>

            {isOptionQuestion(currentDraft.type) && (
              <div className="editor-field">
                <div className="row between editor-field-header">
                  <label>{t('editor.fields.options')}</label>
                  <button
                    className="icon-only ghost"
                    onClick={() => addOption(currentQuestion.id)}
                    aria-label={t('editor.buttons.addOption')}
                    title={t('editor.buttons.addOption')}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="editor-options">
                  {currentDraft.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="editor-option-row">
                      <span className="editor-option-prefix">{getOptionLabel(optionIndex)}</span>
                      <input
                        value={option}
                        onChange={(event) =>
                          setOption(currentQuestion.id, optionIndex, event.target.value)
                        }
                      />
                      <button
                        className="icon-only ghost"
                        onClick={() => removeOption(currentQuestion.id, optionIndex)}
                        aria-label={t('editor.buttons.remove')}
                        title={t('editor.buttons.remove')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="editor-field">
              <label htmlFor="editor-answer">{t('editor.fields.answer')}</label>
              <input
                id="editor-answer"
                value={currentDraft.answer}
                onChange={(event) => patch(currentQuestion.id, { answer: event.target.value })}
              />
            </div>

            <div className="editor-field">
              <label htmlFor="editor-explanation">{t('editor.fields.explanation')}</label>
              <textarea
                id="editor-explanation"
                value={currentDraft.explanation}
                onChange={(event) =>
                  patch(currentQuestion.id, { explanation: event.target.value })
                }
                rows={6}
              />
            </div>
          </div>
        </section>

        <aside className="question-nav editor-nav" aria-label={t('editor.nav.title')}>
          <div className="question-nav-header">
            <span className="muted">{t('editor.nav.title')}</span>
          </div>
          <div className="question-nav-stats editor-nav-stats">
            <div className="question-nav-stat">
              <span className="question-nav-stat-label">{t('editor.nav.saved')}</span>
              <strong>{savedCount}</strong>
            </div>
            <div className="question-nav-stat">
              <span className="question-nav-stat-label">{t('editor.nav.dirty')}</span>
              <strong>{dirtyCount}</strong>
            </div>
            <div className="question-nav-stat">
              <span className="question-nav-stat-label">{t('editor.nav.idle')}</span>
              <strong>{idleCount}</strong>
            </div>
          </div>
          <div className="question-nav-scroll">
            <div className="question-nav-grid">
              {questions.map((question, index) => {
                const status = getEditorStatus(question.id);
                return (
                  <button
                    key={question.id}
                    type="button"
                    className={`editor-qnav-cell editor-qnav-${status}${
                      index === currentIdx ? ' editor-qnav-current' : ''
                    }`}
                    onClick={() => setCurrentIdx(index)}
                    aria-label={`${t('editor.nav.jumpTo')} ${index + 1}`}
                    aria-current={index === currentIdx ? 'step' : undefined}
                    title={`${index + 1}. ${typeLabelMap[drafts[question.id]?.type ?? question.type]}`}
                  >
                    {status === 'saving' ? (
                      <Loader2 size={12} className="spin" />
                    ) : status === 'saved' ? (
                      <Check size={12} />
                    ) : (
                      <span className="qnav-num">{index + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="question-nav-legend editor-nav-legend">
            <span className="qnav-legend-item">
              <span className="editor-nav-dot saved" />
              {t('editor.nav.saved')}
            </span>
            <span className="qnav-legend-item">
              <span className="editor-nav-dot dirty" />
              {t('editor.nav.dirty')}
            </span>
            <span className="qnav-legend-item">
              <span className="editor-nav-dot idle" />
              {t('editor.nav.idle')}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
