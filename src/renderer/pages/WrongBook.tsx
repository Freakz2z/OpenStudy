import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Inbox,
  Loader2,
  ChevronRight,
  FileText,
} from 'lucide-react';
import type { WrongQuestion } from '@shared/types';
import { formatQuestionAnswerDisplay } from '@shared/question-format';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ToastProvider';

interface DocGroup {
  id: number;
  title: string;
  file_type: string;
  questions: WrongQuestion[];
}

export default function WrongBook() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<WrongQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);

  async function refresh(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      setList(await window.api.listWrongQuestions());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
  }, []);

  // 按文档分组
  const groups: DocGroup[] = useMemo(() => {
    const map = new Map<number, DocGroup>();
    for (const q of list) {
      let g = map.get(q.document_id);
      if (!g) {
        g = {
          id: q.document_id,
          title: q.document_title ?? '',
          file_type: q.document_file_type ?? '',
          questions: [],
        };
        map.set(q.document_id, g);
      }
      g.questions.push(q);
    }
    return [...map.values()].sort((a, b) => b.questions.length - a.questions.length);
  }, [list]);
  const activeGroup = groups.find((group) => group.id === activeDocId) ?? null;

  useEffect(() => {
    if (activeDocId != null && !groups.some((group) => group.id === activeDocId)) {
      setActiveDocId(null);
    }
  }, [activeDocId, groups]);

  async function onRemoveOne(qId: number) {
    if (!confirm(t('wrongbook.removeConfirm'))) return;
    setRemoving(qId);
    try {
      await window.api.removeWrongQuestion(qId);
      await refresh();
      toast.show('success', t('wrongbook.removed'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemoving(null);
    }
  }

  async function onClearDoc(docId: number) {
    const g = groups.find((x) => x.id === docId);
    if (!g) return;
    if (
      !confirm(
        t('wrongbook.clearDocConfirm', { count: g.questions.length, title: g.title }),
      )
    )
      return;
    try {
      // 逐题删除（清空该文档下所有错题）
      for (const q of g.questions) {
        await window.api.removeWrongQuestion(q.id);
      }
      await refresh();
      toast.show('success', t('wrongbook.clearedDoc', { title: g.title }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onClearAll() {
    if (!confirm(t('wrongbook.clearAllConfirm'))) return;
    try {
      await window.api.clearWrongBook();
      await refresh();
      toast.show('success', t('wrongbook.clearedAll'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title={
          activeGroup ? (
            <>
              {t('wrongbook.title')}
              <span className="muted" style={{ fontSize: 14, fontWeight: 'normal' }}>
                {' · '}
                {activeGroup.title}
              </span>
            </>
          ) : (
            t('wrongbook.title')
          )
        }
        back={
          activeGroup
            ? { label: t('common.back'), onClick: () => setActiveDocId(null) }
            : undefined
        }
        actions={
          list.length > 0 ? (
            <button
              className="danger icon-only"
              onClick={onClearAll}
              aria-label={t('wrongbook.clearAll')}
              title={t('wrongbook.clearAll')}
            >
              <Trash2 size={16} />
            </button>
          ) : null
        }
      />
      {error && (
        <div className="card error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <LoadingState label={t('common.loading')} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t('wrongbook.empty')}
          description={t('wrongbook.emptyHint')}
        />
      ) : activeGroup ? (
        <div className="col gap-md">
          {activeGroup.questions.map((q) => (
            <div key={q.id} className="card wrongbook-q-card">
              <div className="row gap-sm mb-md">
                <span className="badge muted">
                  {q.type === 'choice'
                    ? t('practice.types.choice')
                    : q.type === 'multiple'
                      ? t('practice.types.multiple')
                    : q.type === 'judge'
                      ? t('practice.types.judge')
                    : q.type === 'fill'
                      ? t('practice.types.fill')
                      : t('practice.types.short')}
                </span>
                <span className="muted tiny">
                  {t('wrongbook.lastWrong', {
                    time: new Date(q.last_wrong_at).toLocaleString(),
                  })}
                </span>
              </div>
              <div className="wrongbook-question-stem">{q.stem}</div>
              <div className="wrongbook-answer-grid mt-md">
                <div className="wrongbook-answer-card wrong">
                  <div className="wrongbook-answer-label">
                    {t('wrongbook.yourAnswerLabel')}
                  </div>
                  <div className="wrongbook-answer-text">
                    {q.last_wrong_answer
                      ? formatQuestionAnswerDisplay(
                          q.type,
                          q.last_wrong_answer,
                          q.options,
                        )
                      : t('practice.result.yourAnswerEmpty')}
                  </div>
                </div>
                <div className="wrongbook-answer-card correct">
                  <div className="wrongbook-answer-label">
                    {t('wrongbook.referenceLabel')}
                  </div>
                  <div className="wrongbook-answer-text">
                    {formatQuestionAnswerDisplay(q.type, q.answer, q.options)}
                  </div>
                </div>
              </div>
              <div className="row gap-sm mt-md wrongbook-actions">
                <button
                  className="primary sm"
                  onClick={() => navigate(`/practice/${q.document_id}?from=wrong`)}
                >
                  <RefreshCw size={14} />
                  <span>{t('wrongbook.redo')}</span>
                </button>
                <button
                  className="ghost sm"
                  onClick={() => onRemoveOne(q.id)}
                  disabled={removing === q.id}
                >
                  {removing === q.id ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  <span>{t('wrongbook.remove')}</span>
                </button>
              </div>
            </div>
          ))}
          <div className="card wrongbook-doc-footer">
            <div className="row gap-sm" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button className="ghost sm" onClick={() => setActiveDocId(null)}>
                <ArrowLeft size={14} />
                <span>{t('common.back')}</span>
              </button>
              <button className="ghost sm" onClick={() => onClearDoc(activeGroup.id)}>
                <Trash2 size={14} />
                <span>{t('wrongbook.clearDoc', { count: activeGroup.questions.length })}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="col gap-md">
          {groups.map((g) => {
            return (
              <div key={g.id} className="card wrongbook-doc">
                <button
                  className="wrongbook-doc-header"
                  onClick={() => setActiveDocId(g.id)}
                >
                  <FileText size={18} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {g.title}
                    </div>
                    <div
                      className="tiny"
                      style={{ marginTop: 2 }}
                    >
                      <span className="badge muted" style={{ marginRight: 6 }}>
                        {g.file_type.toUpperCase()}
                      </span>
                      {t('wrongbook.docCount', {
                        count: g.questions.length,
                      })}
                    </div>
                  </div>
                  <ChevronRight size={16} className="chevron-right" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
