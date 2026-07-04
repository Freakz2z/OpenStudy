import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';
import {
  listPracticeChatSessions,
  deletePracticeChatSession,
  clearPracticeChatSessionsByDocument,
  type PracticeChatSession,
} from '../utils/practice-chat';
import { Modal } from './Modal';

interface ConversationsModalProps {
  open: boolean;
  docId: number;
  docTitle: string;
  onClose: () => void;
}

export function ConversationsModal({ open, docId, docTitle, onClose }: ConversationsModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<PracticeChatSession[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const all = listPracticeChatSessions();
    setSessions(
      all
        .filter((s) => s.docId === docId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  }, [open, docId]);

  function handleDelete(key: string) {
    setDeleting(key);
    deletePracticeChatSession(
      sessions.find((s) => s.key === key)!.docId,
      sessions.find((s) => s.key === key)!.questionId,
    );
    setSessions((prev) => prev.filter((s) => s.key !== key));
    setDeleting(null);
  }

  function handleClearAll() {
    setClearing(true);
    clearPracticeChatSessionsByDocument(docId);
    setSessions([]);
    setClearing(false);
  }

  return (
    <Modal
      open={open}
      title={t('conversations.title', { defaultValue: '对话记录' }) + ' - ' + docTitle}
      onClose={onClose}
      width={640}
    >
      <div className="modal-scroll-body">
        {sessions.length === 0 ? (
          <div className="muted text-center" style={{ padding: 24 }}>
            {t('conversations.emptyForDoc', { defaultValue: '本文档没有对话记录' })}
          </div>
        ) : (
          <div className="modal-list">
            {sessions.map((s) => (
              <div key={s.key} className="card" style={{ padding: '14px 16px' }}>
                <div className="row gap-sm mb-sm">
                  <span className="badge">{s.questionType}</span>
                  <span className="tiny muted">
                    {new Date(s.updatedAt).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.5,
                    marginBottom: 4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {s.questionStem}
                </div>
                <div className="tiny muted mb-sm">
                  {s.messages.length}{' '}
                  {t('conversations.msgCount', { defaultValue: '条消息' })}
                </div>
                <div className="row gap-sm">
                  <button
                    className="ghost sm"
                    onClick={() => {
                      navigate(`/practice/${s.docId}?q=${s.questionId}&ai=1`);
                      onClose();
                    }}
                  >
                    <MessageSquare size={14} />
                    <span>{t('conversations.open', { defaultValue: '查看' })}</span>
                  </button>
                  <button
                    className="ghost sm danger"
                    disabled={deleting === s.key}
                    onClick={() => handleDelete(s.key)}
                  >
                    {deleting === s.key ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    <span>{t('conversations.delete', { defaultValue: '删除' })}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="modal-footer">
          <button className="danger sm" disabled={clearing} onClick={handleClearAll}>
            {clearing && <Loader2 size={14} className="spin" />}
            {t('conversations.clearDoc', { defaultValue: '清空本文档对话' })}
          </button>
        </div>
      )}
    </Modal>
  );
}
