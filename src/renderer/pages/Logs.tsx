import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ScrollText, Trash2, XCircle } from 'lucide-react';
import type { IdentifyLogEntry } from '@shared/types';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { PageHeader } from '../components/PageHeader';

function formatDateTime(value: number, locale: string): string {
  return new Date(value).toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Logs() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<IdentifyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  async function refresh(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      setError(null);
      setLogs(await window.api.listIdentifyLogs(undefined, 200));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
  }, []);

  const summary = useMemo(() => {
    const success = logs.filter((item) => item.status === 'success').length;
    const failed = logs.filter((item) => item.status === 'failed').length;
    return { success, failed };
  }, [logs]);

  async function onDelete(id: string) {
    setBusyId(id);
    try {
      await window.api.deleteIdentifyLog(id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function onClearAll() {
    if (!confirm(t('logs.clearConfirm'))) return;
    setClearing(true);
    try {
      await window.api.clearIdentifyLogs();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={t('logs.title')}
        actions={
          logs.length > 0 ? (
            <button
              className="danger icon-only"
              onClick={onClearAll}
              disabled={clearing}
              aria-label={clearing ? t('logs.clearing') : t('logs.clearAll')}
              title={clearing ? t('logs.clearing') : t('logs.clearAll')}
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
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t('logs.empty')}
          description={t('logs.emptyHint')}
        />
      ) : (
        <div className="logs-list">
          <div className="card logs-summary">
            <span className="badge success">
              <CheckCircle2 size={12} />
              {t('logs.summary.success', { count: summary.success })}
            </span>
            <span className="badge error">
              <XCircle size={12} />
              {t('logs.summary.failed', { count: summary.failed })}
            </span>
            <span className="badge muted">{t('logs.summary.total', { count: logs.length })}</span>
          </div>

          {logs.map((log) => (
            <article key={log.id} className="overview-log-card">
              <div className="overview-log-toolbar">
                <div className="overview-log-copy">
                  <div className="row gap-sm wrap">
                    <strong>{log.doc_title}</strong>
                    <span className={`badge ${log.status === 'failed' ? 'error' : 'success'}`}>
                      {log.status === 'failed' ? t('logs.failed') : t('logs.success')}
                    </span>
                    <span className="badge muted">{log.file_type.toUpperCase()}</span>
                  </div>
                  <div className="overview-log-meta">
                    {formatDateTime(log.created_at, i18n.language)} · {log.model_provider} · {log.model_name}
                  </div>
                </div>
                <button
                  className="icon-only ghost"
                  onClick={() => onDelete(log.id)}
                  disabled={busyId === log.id}
                  aria-label={t('logs.delete')}
                  title={t('logs.delete')}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="overview-log-message">{log.message}</div>

              <div className="overview-log-stats">
                {log.estimated_question_count != null && (
                  <span>{t('logs.estimated', { count: log.estimated_question_count })}</span>
                )}
                {log.identified_question_count != null && (
                  <span>{t('logs.identified', { count: log.identified_question_count })}</span>
                )}
                <span>{t('logs.events', { count: log.events.length })}</span>
              </div>

              {log.events.length > 0 && (
                <ul className="overview-log-events">
                  {log.events.map((event, index) => (
                    <li
                      key={`${log.id}-${index}`}
                      className={`overview-log-event ${event.severity}`}
                    >
                      {event.message}
                    </li>
                  ))}
                </ul>
              )}

              {log.markdown_preview && (
                <details className="overview-log-details">
                  <summary>{t('logs.details')}</summary>
                  <pre>{log.markdown_preview}</pre>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
