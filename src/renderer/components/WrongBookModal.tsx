import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Play, Trash2 } from 'lucide-react';
import type { WrongQuestion } from '@shared/types';
import { formatQuestionAnswerDisplay } from '@shared/question-format';
import { Modal } from './Modal';

interface WrongBookModalProps {
  open: boolean;
  docId: number;
  docTitle: string;
  onClose: () => void;
}

export function WrongBookModal({ open, docId, docTitle, onClose }: WrongBookModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    window.api
      .listWrongQuestions()
      .then((list) => setQuestions(list.filter((w) => w.document_id === docId)))
      .finally(() => setLoading(false));
  }, [open, docId]);

  async function handleRemove(qId: number) {
    setRemoving(qId);
    try {
      await window.api.removeWrongQuestion(qId);
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
    } finally {
      setRemoving(null);
    }
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      await window.api.resetDocumentProgress(docId);
      setQuestions([]);
    } finally {
      setClearing(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('wrongbook.title') + ' - ' + docTitle}
      onClose={onClose}
      width={640}
    >
      <div className="modal-scroll-body">
        {loading ? (
          <div className="text-center" style={{ padding: 24 }}>
            <Loader2 size={20} className="spin" />
          </div>
        ) : questions.length === 0 ? (
          <div className="muted text-center" style={{ padding: 24 }}>
            {t('wrongbook.emptyForDoc', { defaultValue: '本文档没有错题' })}
          </div>
        ) : (
          <div className="modal-list">
            {questions.map((q) => (
              <div key={q.id} className="card" style={{ padding: '14px 16px' }}>
                <div className="row gap-sm mb-sm">
                  <span className="badge">{q.type}</span>
                  <span className="tiny muted">
                    {q.last_wrong_at
                      ? new Date(q.last_wrong_at).toLocaleString()
                      : ''}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, marginBottom: 8 }}>
                  {q.stem}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--danger)' }}>
                    {t('wrongbook.yourAnswerLabel', { defaultValue: '你的答案' })}:{' '}
                    {formatQuestionAnswerDisplay(q.type, q.last_wrong_answer, q.options)}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', marginBottom: 10 }}>
                  <span style={{ color: 'var(--success)' }}>
                    {t('wrongbook.referenceLabel', { defaultValue: '参考答案' })}:{' '}
                    {formatQuestionAnswerDisplay(q.type, q.answer, q.options)}
                  </span>
                </div>
                <div className="row gap-sm">
                  <button
                    className="ghost sm"
                    onClick={() => {
                      navigate(`/practice/${docId}?from=wrong`);
                      onClose();
                    }}
                  >
                    <Play size={14} />
                    <span>{t('wrongbook.redo', { defaultValue: '重做' })}</span>
                  </button>
                  <button
                    className="ghost sm danger"
                    disabled={removing === q.id}
                    onClick={() => handleRemove(q.id)}
                  >
                    {removing === q.id ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    <span>{t('wrongbook.remove', { defaultValue: '移除' })}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {questions.length > 0 && (
        <div className="modal-footer">
          <button className="danger sm" disabled={clearing} onClick={handleClearAll}>
            {clearing && <Loader2 size={14} className="spin" />}
            {t('wrongbook.clearDoc', { defaultValue: '清空本文档错题' })}
          </button>
        </div>
      )}
    </Modal>
  );
}
