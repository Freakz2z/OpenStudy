import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, MessageSquare, Trash2 } from 'lucide-react';
import type { Document } from '@shared/types';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { MarkdownContent } from '../components/MarkdownContent';
import {
  clearPracticeChatSessionsByDocument,
  deletePracticeChatSession,
  listPracticeChatSessions,
  type PracticeChatSession,
} from '../utils/practice-chat';
import { formatDateTime } from '../utils/helpers';

export default function Conversations() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { docId } = useParams<{ docId: string }>();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sessions, setSessions] = useState<PracticeChatSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    void window.api.listDocuments().then((items) => {
      if (!cancelled) setDocuments(items);
    });
    setSessions(listPracticeChatSessions());
    return () => {
      cancelled = true;
    };
  }, []);

  const id = Number(docId);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => s.docId === id);
  }, [sessions, id]);

  const docTitle = useMemo(() => {
    const doc = documents.find((d) => d.id === id);
    return doc?.title ?? t('conversations.docFallback', { id });
  }, [id, documents, t]);

  function refreshSessions() {
    setSessions(listPracticeChatSessions());
  }

  function onDelete(session: PracticeChatSession) {
    deletePracticeChatSession(session.docId, session.questionId);
    refreshSessions();
  }

  function onClearAll() {
    if (!confirm(t('conversations.clearConfirm'))) return;
    clearPracticeChatSessionsByDocument(id);
    refreshSessions();
  }

  return (
    <div className="page">
      <PageHeader
        title={`${t('conversations.title')} · ${docTitle}`}
        back={{ label: t('common.back'), onClick: () => navigate('/library') }}
        actions={
          filteredSessions.length > 0 ? (
            <button
              className="danger icon-only"
              onClick={onClearAll}
              aria-label={t('conversations.clearAll')}
              title={t('conversations.clearAll')}
            >
              <Trash2 size={16} />
            </button>
          ) : null
        }
      />

      {filteredSessions.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t('conversations.emptyForDoc')}
          description=""
        />
      ) : (
        <div className="conversations-list">
          {filteredSessions.map((session) => (
            <article key={session.key} className="conversation-card card">
              <div className="conversation-card-header">
                <div className="row gap-sm wrap">
                  <span className="badge muted">
                    {t(`practice.types.${session.questionType}`)}
                  </span>
                  <span className="conversation-card-time">
                    {formatDateTime(session.updatedAt, i18n.language)}
                  </span>
                </div>

                <div className="row gap-sm">
                  <button
                    className="icon-only ghost"
                    onClick={() =>
                      navigate(`/practice/${session.docId}?q=${session.questionId}&ai=1`)
                    }
                    aria-label={t('conversations.open')}
                    title={t('conversations.open')}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                  <button
                    className="icon-only ghost"
                    onClick={() => onDelete(session)}
                    aria-label={t('conversations.delete')}
                    title={t('conversations.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="conversation-question-stem">{session.questionStem}</div>

              <div className="conversation-thread">
                {session.messages.map((message, index) => (
                  <div
                    key={`${session.key}-${message.role}-${index}`}
                    className={`conversation-message ${message.role}`}
                  >
                    <div className="conversation-message-bubble">
                      <MarkdownContent content={message.content} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
