import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeMarkdownStandardLanguage } from '@shared/markdown-standard';
import {
  Save, Check, RefreshCw, Loader2, SearchCheck,
  ScanLine, ScrollText, XCircle, CheckCircle2, Trash2, X,
} from 'lucide-react';
import type { IdentifyLogEntry, IdentifyQuestionsResult, Question } from '@shared/types';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { analyzeMarkdownPrecheck } from '@shared/question-diagnostics';
import { useToast } from '../components/ToastProvider';
import { formatDateTime } from '../utils/helpers';

function normalizeIdentifyResult(
  payload: Question[] | IdentifyQuestionsResult,
): IdentifyQuestionsResult {
  if (Array.isArray(payload)) {
    return {
      questions: payload,
      diagnostics: {
        estimatedQuestionCount: payload.length,
        identifiedQuestionCount: payload.length,
        coverageRatio: payload.length > 0 ? 1 : null,
        typeCounts: payload.reduce(
          (acc, q) => { acc[q.type]++; return acc; },
          { choice: 0, multiple: 0, judge: 0, fill: 0, short: 0, code: 0 },
        ),
        missingExplanationCount: payload.filter((q) => !q.explanation?.trim()).length,
        duplicateStemCount: 0,
        suspiciousQuestionCount: 0,
        issueCount: 0,
        issues: [],
      },
    };
  }
  return payload;
}


export default function MarkdownEditor() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [markdown, setMarkdown] = useState('');
  const [original, setOriginal] = useState('');
  const [source, setSource] = useState<'db' | 'fresh' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const [identifying, setIdentifying] = useState(false);
  const [identifyProgress, setIdentifyProgress] = useState<{
    message: string;
    current?: number;
    total?: number;
  } | null>(null);
  const [identifyReport, setIdentifyReport] = useState<{
    questionsFound: number;
    estimatedQuestionCount: number;
    coverageRatio: number | null;
    typeCounts: Record<string, number>;
    missingExplanationCount: number;
    issueCount: number;
    issues: { code: string; severity: string; message: string }[];
  } | null>(null);

  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<IdentifyLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [busyLogId, setBusyLogId] = useState<string | null>(null);

  const numDocId = Number(docId);

  useEffect(() => {
    if (!docId || !window.api) return;
    let cancelled = false;
    setLoading(true);
    const standardLang = normalizeMarkdownStandardLanguage(i18n.language);
    Promise.all([
      window.api.getMarkdown(numDocId, standardLang),
      window.api.listDocuments(),
    ])
      .then(([res, docs]) => {
        if (cancelled) return;
        setMarkdown(res.markdown);
        setOriginal(res.markdown);
        setSource(res.source);
        setDocTitle(
          docs.find((d) => d.id === numDocId)?.title ?? '',
        );
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
  }, [docId, i18n.language]);

  useEffect(() => {
    if (!window.api?.onIdentifyProgress) return;
    return window.api.onIdentifyProgress((p) => {
      if (p.phase === 'done') {
        setIdentifyProgress(null);
        setIdentifying(false);
      } else {
        setIdentifyProgress({
          message: p.message,
          current: p.current,
          total: p.total,
        });
      }
    });
  }, []);

  const dirty = markdown !== original;
  const charCount = markdown.length;
  const lineCount = markdown.split('\n').length;
  const precheck = useMemo(() => analyzeMarkdownPrecheck(markdown), [markdown]);

  async function onSave() {
    if (!docId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await window.api.saveMarkdown(numDocId, markdown);
      setOriginal(markdown);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    if (!docId) return;
    if (!confirm(t('markdownEditor.resetConfirm'))) return;
    setError(null);
    try {
      await window.api.saveMarkdown(numDocId, '');
      const res2 = await window.api.getMarkdown(
        numDocId,
        normalizeMarkdownStandardLanguage(i18n.language),
      );
      setMarkdown(res2.markdown);
      setOriginal(res2.markdown);
      setSource(res2.source);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onIdentify() {
    if (!docId || identifying) return;
    setIdentifying(true);
    setError(null);
    setIdentifyReport(null);
    setIdentifyProgress({ message: t('library.actions.identifying') });
    try {
      const payload = await window.api.identifyQuestions(
        numDocId,
        normalizeMarkdownStandardLanguage(i18n.language),
      );
      const result = normalizeIdentifyResult(payload);
      const diagnostics = result.diagnostics;
      setIdentifyReport({
        questionsFound: result.questions.length,
        estimatedQuestionCount: diagnostics.estimatedQuestionCount,
        coverageRatio: diagnostics.coverageRatio,
        typeCounts: diagnostics.typeCounts,
        missingExplanationCount: diagnostics.missingExplanationCount,
        issueCount: diagnostics.issueCount,
        issues: diagnostics.issues,
      });
      if (result.questions.length > 0) {
        toast.show('success', t('library.toast.identified', { count: result.questions.length }));
      } else {
        setError(t('library.errors.noQuestions'));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIdentifying(false);
      setIdentifyProgress(null);
    }
  }

  function openLogs() {
    setShowLogs(true);
    setLogsLoading(true);
    window.api.listIdentifyLogs(numDocId, 100)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }

  async function onDeleteLog(id: string) {
    setBusyLogId(id);
    try {
      await window.api.deleteIdentifyLog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setBusyLogId(null);
    }
  }

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function goBack() {
    if (showLogs) {
      setShowLogs(false);
      return;
    }
    if (dirty && !confirm(t('markdownEditor.leaveConfirm'))) return;
    navigate('/library');
  }

  if (!docId) return <Navigate to="/library" replace />;
  if (loading) {
    return (
      <div className="page">
        <PageHeader
          title={t('markdownEditor.title')}
          back={{ label: t('markdownEditor.saveAndBack'), onClick: () => navigate('/library') }}
        />
        <LoadingState label={t('markdownEditor.loading')} />
      </div>
    );
  }

  const backLabel = showLogs
    ? t('common.back')
    : t('markdownEditor.saveAndBack');

  return (
    <div className="page">
      <PageHeader
        back={{ label: backLabel, onClick: goBack }}
        title={
          <>
            {t('markdownEditor.title')}
            <span className="page-subtitle muted">
              · {docTitle}
            </span>
          </>
        }
        actions={
          <div className="row gap-sm">
            {!showLogs && source && (
              <span className="badge muted">
                {source === 'db' ? t('markdownEditor.fromDb') : t('markdownEditor.fromFile')}
              </span>
            )}
            {!showLogs && (
              <>
                <button
                  className="icon-only"
                  disabled={identifying}
                  onClick={() => { void onIdentify(); }}
                  title={identifying ? t('library.actions.identifying') : t('library.actions.identify')}
                >
                  {identifying ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <ScanLine size={16} />
                  )}
                </button>
                <button
                  className="icon-only"
                  onClick={openLogs}
                  title={t('nav.logs')}
                >
                  <ScrollText size={16} />
                </button>
                <button
                  className="icon-only"
                  onClick={onReset}
                  disabled={!dirty && source === 'db'}
                  title={t('markdownEditor.resetFromFile')}
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  className="primary icon-only"
                  disabled={!dirty || saving}
                  onClick={onSave}
                  title={saving ? t('markdownEditor.saving') : saved ? t('markdownEditor.saved') : t('markdownEditor.save')}
                >
                  {saving ? (
                    <Loader2 size={16} className="spin" />
                  ) : saved ? (
                    <Check size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                </button>
              </>
            )}
          </div>
        }
      />

      {error && (
        <div className="card error mb-md" role="alert">
          <span className="flex-1">{error}</span>
          <button
            className="icon-only ghost"
            onClick={() => setError(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showLogs ? (
        <div className="col gap-md">
          {logsLoading ? (
            <LoadingState label={t('common.loading')} />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={t('logs.emptyForDoc', { defaultValue: '本文档暂无识别日志' })}
            />
          ) : (
            <>
              <div className="card logs-summary">
                <span className="badge success">
                  <CheckCircle2 size={12} />
                  {t('logs.summary.success', { count: logs.filter((l) => l.status === 'success').length })}
                </span>
                <span className="badge error">
                  <XCircle size={12} />
                  {t('logs.summary.failed', { count: logs.filter((l) => l.status === 'failed').length })}
                </span>
                <span className="badge muted">{t('logs.summary.total', { count: logs.length })}</span>
              </div>

              {logs.map((log) => (
                <article key={log.id} className="overview-log-card">
                  <div className="overview-log-toolbar">
                    <div className="overview-log-copy">
                      <div className="row gap-sm wrap">
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
                      onClick={() => onDeleteLog(log.id)}
                      disabled={busyLogId === log.id}
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
            </>
          )}
        </div>
      ) : (
        <>
          <div className="muted mb-md" style={{ fontSize: 'var(--text-sm)' }}>
            {t('markdownEditor.stats', { lines: lineCount, chars: charCount })}
            {dirty && <span className="text-warning"> · {t('markdownEditor.unsaved')}</span>}
          </div>

          <div className="markdown-precheck card">
            <div className="markdown-precheck-header">
              <div className="row gap-sm">
                <SearchCheck size={16} />
                <strong>{t('markdownEditor.precheck.title')}</strong>
              </div>
              <span className={`badge ${precheck.issueCount > 0 ? 'warning' : 'success'}`}>
                {precheck.issueCount > 0
                  ? t('markdownEditor.precheck.needsReview')
                  : t('markdownEditor.precheck.looksGood')}
              </span>
            </div>
            <div className="markdown-precheck-stats">
              <span>{t('markdownEditor.precheck.estimatedQuestions', { count: precheck.estimatedQuestionCount })}</span>
              <span>{t('markdownEditor.precheck.answerLines', { count: precheck.answerLineCount })}</span>
              <span>{t('markdownEditor.precheck.optionLines', { count: precheck.optionLineCount })}</span>
              <span>{t('markdownEditor.precheck.explanations', { count: precheck.explanationLineCount })}</span>
            </div>
            {precheck.issues.length > 0 ? (
              <ul className="markdown-precheck-issues">
                {precheck.issues.slice(0, 6).map((issue, index) => (
                  <li key={`${issue.code}-${index}`} className={`markdown-precheck-issue ${issue.severity}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                {t('markdownEditor.precheck.noIssues')}
              </div>
            )}
          </div>

          {identifyProgress && (
            <div className="card mt-md">
              <div className="row gap-sm mb-sm" style={{ fontSize: 'var(--text-sm)' }}>
                <Loader2 size={14} className="spin" />
                <span className="muted">{identifyProgress.message}</span>
              </div>
              {identifyProgress.total && identifyProgress.total > 1 && (
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${Math.round(
                        ((identifyProgress.current ?? 0) / identifyProgress.total) * 100,
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {identifyReport && (
            <div className="card identify-report mt-md" role="status" aria-live="polite">
              <div className="identify-report-header">
                <strong>{t('library.diagnosis.title')}</strong>
                <span className={`badge ${identifyReport.issueCount > 0 ? 'warning' : 'success'}`}>
                  {identifyReport.issueCount > 0
                    ? t('library.diagnosis.needsReview')
                    : t('library.diagnosis.looksGood')}
                </span>
              </div>
              <div className="identify-report-stats">
                <span>{t('library.diagnosis.estimated', { count: identifyReport.estimatedQuestionCount })}</span>
                <span>{t('library.diagnosis.identified', { count: identifyReport.questionsFound })}</span>
                {identifyReport.typeCounts && Object.entries(identifyReport.typeCounts).map(([type, count]) => (
                  <span key={type}>{t(`library.diagnosis.${type}`, { count, defaultValue: `${type}: ${count}` })}</span>
                ))}
              </div>
              <div className="identify-report-stats muted" style={{ fontSize: 'var(--text-sm)' }}>
                <span>
                  {t('library.diagnosis.coverage', {
                    pct:
                      identifyReport.coverageRatio == null
                        ? '—'
                        : `${Math.round(identifyReport.coverageRatio * 100)}%`,
                  })}
                </span>
                <span>{t('library.diagnosis.missingExplanation', { count: identifyReport.missingExplanationCount })}</span>
              </div>
              {identifyReport.issues.length > 0 && (
                <ul className="identify-report-issues">
                  {identifyReport.issues.slice(0, 6).map((issue, index) => (
                    <li key={`${issue.code}-${index}`} className={`identify-report-issue ${issue.severity}`}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="markdown-editor-textarea"
          />

          <div className="muted mt-md" style={{ fontSize: 'var(--text-sm)' }}>
            {t('markdownEditor.hint')}
          </div>
        </>
      )}
    </div>
  );
}
