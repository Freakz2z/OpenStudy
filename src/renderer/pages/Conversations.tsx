import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, MessageSquare, Trash2 } from 'lucide-react';
import type { Document } from '@shared/types';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { MarkdownContent } from '../components/MarkdownContent';
import {
  clearPracticeChatSessions,
  deletePracticeChatSession,
  listPracticeChatSessions,
  type PracticeChatSession,
} from '../utils/practice-chat';

function formatDateTime(value: number, locale: string): string {
  return new Date(value).toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Conversations() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

  const groups = useMemo(() => {
    const titleMap = new Map(documents.map((item) => [item.id, item.title]));
    const map = new Map<number, { docId: number; title: string; sessions: PracticeChatSession[] }>();
    for (const session of sessions) {
      const current = map.get(session.docId);
      if (current) {
        current.sessions.push(session);
        continue;
      }
      map.set(session.docId, {
        docId: session.docId,
        title:
          titleMap.get(session.docId) ?? t('conversations.docFallback', { id: session.docId }),
        sessions: [session],
      });
    }
    return [...map.values()].sort(
      (a, b) => (b.sessions[0]?.updatedAt ?? 0) - (a.sessions[0]?.updatedAt ?? 0),
    );
  }, [documents, sessions, t]);

  function refreshSessions() {
    setSessions(listPracticeChatSessions());
  }

  function onDelete(session: PracticeChatSession) {
    deletePracticeChatSession(session.docId, session.questionId);
    refreshSessions();
  }

  function onClearAll() {
    if (!confirm(t('conversations.clearConfirm'))) return;
    clearPracticeChatSessions();
    refreshSessions();
  }

  return (
    <div className="page">
      <PageHeader
        title={t('conversations.title')}
        actions={
          sessions.length > 0 ? (
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

      {sessions.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t('conversations.empty')}
          description={t('conversations.emptyHint')}
        />
      ) : (
        <div className="conversations-list">
          {groups.map((group) => (
            <section key={group.docId} className="card conversation-doc">
              <div className="conversation-doc-header">
                <div className="panel-card-copy">
                  <h2>{group.title}</h2>
                  <p>{t('conversations.docCount', { count: group.sessions.length })}</p>
                </div>
              </div>

              <div className="conversation-doc-body">
                {group.sessions.map((session) => (
                  <article key={session.key} className="conversation-card">
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
