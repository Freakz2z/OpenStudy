import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  Trash2,
  Inbox,
  Loader2,
} from 'lucide-react';
import type { WrongQuestion } from '@shared/types';
import { formatQuestionAnswerDisplay } from '@shared/question-format';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ToastProvider';

export default function WrongBook() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { docId } = useParams<{ docId: string }>();
  const [list, setList] = useState<WrongQuestion[]>([]);
  const [docTitle, setDocTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  async function refresh(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const all = await window.api.listWrongQuestions();
      const id = Number(docId);
      setList(all.filter((q) => q.document_id === id));
      const title = all.find((q) => q.document_id === id)?.document_title;
      if (title) setDocTitle(title);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
  }, [docId]);

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

  async function onClearDoc() {
    if (!confirm(t('wrongbook.clearDocConfirm', { count: list.length, title: docTitle }))) return;
    try {
      for (const q of list) {
        await window.api.removeWrongQuestion(q.id);
      }
      await refresh();
      toast.show('success', t('wrongbook.clearedDoc', { title: docTitle }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={
          <>
            {t('wrongbook.title')}
            {docTitle && (
              <span className="page-subtitle muted">
                {' · '}
                {docTitle}
              </span>
            )}
          </>
        }
        back={{ label: t('common.back'), onClick: () => navigate('/library') }}
        actions={
          list.length > 0 ? (
            <button
              className="danger icon-only"
              onClick={onClearDoc}
              aria-label={t('wrongbook.clearDoc', { count: list.length })}
              title={t('wrongbook.clearDoc', { count: list.length })}
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
          title={t('wrongbook.emptyForDoc')}
          description={t('wrongbook.emptyForDocHint')}
        />
      ) : (
        <div className="col gap-md">
          {list.map((q) => (
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
            <button className="ghost sm" onClick={onClearDoc}>
              <Trash2 size={14} />
              <span>{t('wrongbook.clearDoc', { count: list.length })}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
