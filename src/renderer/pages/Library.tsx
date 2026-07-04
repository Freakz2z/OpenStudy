import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardCheck,
  Pencil,
  Plus,
  Upload,
  ScanLine,
  Play,
  Trash2,
  X,
  AlertTriangle,
  Info,
  Loader2,
  Inbox,
  FileText,
  RotateCcw,
  Copy,
  Download,
} from 'lucide-react';
import { normalizeMarkdownStandardLanguage } from '@shared/markdown-standard';
import type {
  Document,
  DocumentStats,
  IdentifyQualityReport,
  IdentifyQuestionsResult,
  OverallStats,
  Question,
} from '@shared/types';
import { renderPracticeResultsMarkdown } from '@shared/openstudy-standard';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ToastProvider';
import { clearStoredAttempts } from '../utils/practice-attempts';
import { clearPracticeChatSessionsByDocument } from '../utils/practice-chat';
import { Modal } from '../components/Modal';

function pct(n: number | null): string {
  if (n == null) return '—';
  return `${Math.round(n * 100)}%`;
}

interface ProgressState {
  docId: number;
  message: string;
  current?: number;
  total?: number;
}

type FlashKind = 'error' | 'warning';

export default function Library() {
  const { t, i18n } = useTranslation();
  const [docs, setDocs] = useState<Document[]>([]);
  const [stats, setStats] = useState<Record<number, DocumentStats>>({});
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [busyIds, setBusyIds] = useState<Record<number, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<{
    kind: FlashKind;
    message: string;
    docId?: number;
  } | null>(null);
  const [progressByDoc, setProgressByDoc] = useState<Record<number, ProgressState>>({});
  const [identifyReports, setIdentifyReports] = useState<Record<number, IdentifyQualityReport>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createMd, setCreateMd] = useState('');
  const [creating, setCreating] = useState(false);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();

  async function refresh(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const list = await window.api.listDocuments();
      setDocs(list);
      const o = await window.api.getOverallStats().catch(() => null);
      setOverall(o);
      const entries = await Promise.all(
        list.map((d) =>
          window.api
            .getDocumentStats(d.id)
            .then((s) => [d.id, s] as const)
            .catch(() => [d.id, null] as const),
        ),
      );
      const next: Record<number, DocumentStats> = {};
      for (const [id, s] of entries) {
        if (s) next[id] = s;
      }
      setStats(next);
    } catch (err) {
      setError({ kind: 'error', message: (err as Error).message });
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
  }, []);

  function setDocBusy(docId: number, value: boolean) {
    setBusyIds((current) => {
      if (value) return { ...current, [docId]: true };
      const next = { ...current };
      delete next[docId];
      return next;
    });
  }

  function setDocProgress(docId: number, value: ProgressState | null) {
    setProgressByDoc((current) => {
      if (value) return { ...current, [docId]: value };
      const next = { ...current };
      delete next[docId];
      return next;
    });
  }

  useEffect(() => {
    if (!window.api?.onIdentifyProgress) return;
    return window.api.onIdentifyProgress((p) => {
      if (p.phase === 'done') {
        setDocProgress(p.docId, null);
        setDocBusy(p.docId, false);
      } else {
        setDocProgress(p.docId, {
          docId: p.docId,
          message: p.message,
          current: p.current,
          total: p.total,
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!error || error.kind !== 'warning') return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);

  async function onIdentify(docId: number) {
    setDocBusy(docId, true);
    setError(null);
    setDocProgress(docId, { docId, message: t('library.actions.identifying') });
    try {
      const payload = await window.api.identifyQuestions(
        docId,
        normalizeMarkdownStandardLanguage(i18n.language),
      );
      const normalized = normalizeIdentifyResult(payload);
      setIdentifyReports((current) => ({
        ...current,
        [docId]: normalized.diagnostics,
      }));
      if (normalized.questions.length === 0) {
        setError({
          kind: 'warning',
          message: t('library.errors.noQuestions'),
          docId,
        });
      } else {
        toast.show('success', t('library.toast.identified', { count: normalized.questions.length }));
      }
      await refresh();
    } catch (e) {
      setError({ kind: 'error', message: (e as Error).message, docId });
    } finally {
      setDocBusy(docId, false);
      setDocProgress(docId, null);
    }
  }

  async function onImport() {
    setImporting(true);
    setError(null);
    try {
      const doc = await window.api.importFile();
      if (doc) {
        toast.show('success', t('library.toast.imported', { title: doc.title }));
        await refresh();
      }
    } catch (e) {
      setError({ kind: 'error', message: (e as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function onDelete(docId: number) {
    if (!confirm(t('library.delete.confirm'))) return;
    setDeleting(docId);
    setError(null);
    try {
      await window.api.deleteDocument(docId);
      await refresh();
    } catch (e) {
      setError({ kind: 'error', message: (e as Error).message });
    } finally {
      setDeleting(null);
    }
  }

  async function onExportMarkdown(doc: Document, mode: 'copy' | 'download') {
    try {
      const [questions, snapshots] = await Promise.all([
        window.api.getQuestionsByDocument(doc.id),
        window.api.listAttemptsByDocument?.(doc.id) ?? [],
      ]);
      const attemptMap: Record<number, { userAnswer: string; isCorrect: boolean }> = {};
      let correct = 0;
      let wrong = 0;
      for (const a of snapshots) {
        attemptMap[a.question_id] = { userAnswer: a.user_answer, isCorrect: a.is_correct };
        if (a.is_correct) correct++;
        else wrong++;
      }
      const md = renderPracticeResultsMarkdown(doc.title, questions, attemptMap, {
        correct,
        wrong,
        total: correct + wrong,
      });

      if (mode === 'copy') {
        await navigator.clipboard.writeText(md);
        toast.show('success', t('practice.completion.copied'));
      } else {
        const filename = `${doc.title.replace(/[/\\?%*:|"<>]/g, '_')}-practice.md`;
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.show('success', t('practice.completion.exported'));
      }
    } catch (e) {
      toast.show('error', t('templates.copyFailed'));
    }
  }

  async function onResetProgress(docId: number) {
    if (!confirm(t('library.reset.confirm'))) return;
    try {
      await window.api.resetDocumentProgress?.(docId);
      clearStoredAttempts(docId);
      clearPracticeChatSessionsByDocument(docId);
      await refresh();
    } catch (e) {
      setError({ kind: 'error', message: (e as Error).message });
    }
  }

  function openCreate() {
    setCreateName('');
    setCreateDesc('');
    setCreateMd('');
    setCreateOpen(true);
  }

  async function onCreateDocument() {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await window.api.createDocumentFromMarkdown(createName.trim(), createMd, createDesc.trim() || undefined);
      setCreateOpen(false);
      toast.show('success', t('library.toast.imported', { title: createName.trim() }));
      await refresh();
    } catch (e) {
      setError({ kind: 'error', message: (e as Error).message });
    } finally {
      setCreating(false);
    }
  }

  function openEdit(doc: Document) {
    setEditDoc(doc);
    setEditName(doc.title);
    setEditDesc(doc.description ?? '');
  }

  async function onSaveEdit() {
    if (!editDoc || !editName.trim()) return;
    setSaving(true);
    try {
      await window.api.updateDocument(editDoc.id, {
        title: editName.trim(),
        description: editDesc.trim() || null,
      });
      setEditDoc(null);
      await refresh();
    } catch (e) {
      setError({ kind: 'error', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={t('library.title')}
        actions={
          <>
            <button
              className="primary icon-only"
              disabled={importing}
              onClick={onImport}
              aria-label={importing ? t('library.importing') : t('library.import')}
              title={importing ? t('library.importing') : t('library.import')}
            >
              {importing ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Upload size={16} />
              )}
            </button>
            <button
              className="primary icon-only"
              onClick={openCreate}
              aria-label={t('library.actions.createDoc')}
              title={t('library.actions.createDoc')}
            >
              <Plus size={16} />
            </button>
            <span className="sr-only" aria-live="polite">
              {importing ? t('library.importing') : ''}
            </span>
          </>
        }
      />

      {loading && <LoadingState label={t('library.loading')} />}

      {!loading && error && (
        <div
          className={error.kind === 'error' ? 'card error' : 'card warning'}
        >
          <div className="row" style={{ width: '100%' }}>
            {error.kind === 'error' ? (
              <AlertTriangle size={16} />
            ) : (
              <Info size={16} />
            )}
            <div style={{ flex: 1 }}>{error.message}</div>
            {error.kind === 'error' &&
              Object.keys(busyIds).length === 0 &&
              error.message.includes('LLM 输出无法解析') &&
              error.docId !== undefined && (
                <button
                  onClick={() => {
                    if (error.docId !== undefined) onIdentify(error.docId);
                  }}
                >
                  {t('common.retry')}
                </button>
              )}
            <button
              className="icon-only ghost"
              onClick={() => setError(null)}
              aria-label={t('common.close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {!loading && overall && overall.document_count > 0 && (
        <div
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
          }}
        >
          <div className="row gap-sm">
            <span className="badge primary">
              {t('library.stats.documentCount', { count: overall.document_count })}
            </span>
            <span className="badge">
              {t('library.stats.questionCount', { count: overall.question_count })}
            </span>
            {overall.wrong_count > 0 && (
              <span className="badge error">
                {overall.wrong_count} {t('nav.wrongbook')}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {overall.question_count > 0 && <div className="row gap-md muted" style={{ fontSize: 'var(--text-sm)' }}>
            <span>
              {t('library.stats.attempted', {
                done: overall.attempted_count,
                total: overall.question_count,
              })}
            </span>
            <span>·</span>
            <span className="text-success">
              {t('library.stats.accuracy', { pct: pct(overall.accuracy) })}
            </span>
          </div>}
        </div>
      )}

      {!loading && docs.length === 0 && (
        <EmptyState
          icon={Inbox}
          title={t('library.empty')}
          description={t('library.emptyHint')}
          action={{
            label: t('library.importEmpty'),
            onClick: onImport,
            disabled: importing,
            loadingLabel: t('library.importingEmpty'),
          }}
        />
      )}

      {!loading && docs.map((d) => {
        const s = stats[d.id];
        const prog = progressByDoc[d.id] ?? null;
        const isBusy = !!busyIds[d.id];
        const isDeleting = deleting === d.id;
        const report = identifyReports[d.id];
        return (
          <div key={d.id} className="card">
            <div className="card-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row gap-sm">
                  <strong
                    style={{
                      fontSize: 'var(--text-lg)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.title}
                  </strong>
                  <button
                    className="ghost icon-only"
                    onClick={() => openEdit(d)}
                    aria-label={t('library.actions.rename')}
                    title={t('library.actions.rename')}
                    style={{ padding: 2 }}
                  >
                    <Pencil size={12} />
                  </button>
                  <span className="badge">{d.file_type.toUpperCase()}</span>
                </div>
                <div
                  className="muted"
                  style={{ marginTop: 4, fontSize: 'var(--text-sm)' }}
                >
                  {t('library.questionCount', { count: d.question_count })} ·{' '}
                  {t('library.importedAt', {
                    time: new Date(d.imported_at).toLocaleString(i18n.language),
                  })}
                </div>
                {d.description && (
                  <div style={{ marginTop: 2, fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
                    {d.description}
                  </div>
                )}
              </div>
            </div>

            {s && s.question_count > 0 && (
              <div
                className="row gap-md mb-md"
                style={{ fontSize: 'var(--text-sm)' }}
              >
                <span className="muted">
                  {t('library.stats.attempted', {
                    done: s.attempted_count,
                    total: s.question_count,
                  })}
                </span>
                <span className="text-success">
                  {t('library.stats.correctCount', { count: s.correct_count })}
                </span>
                <span className="text-error">
                  {t('library.stats.wrongCount', { count: s.wrong_count })}
                </span>
                <span className="muted">
                  {t('library.stats.accuracy', { pct: pct(s.accuracy) })}
                </span>
              </div>
            )}

            {prog && (
              <div className="mb-md">
                <div
                  className="row gap-sm"
                  style={{ marginBottom: 6, fontSize: 'var(--text-sm)' }}
                >
                  <Loader2 size={14} className="spin" />
                  <span className="muted">{prog.message}</span>
                </div>
                {prog.total && prog.total > 1 && (
                  <div className="progress">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${Math.round(
                          ((prog.current ?? 0) / prog.total) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {report && (
              <div className="identify-report mb-md" role="status" aria-live="polite">
                <div className="identify-report-header">
                  <strong>{t('library.diagnosis.title')}</strong>
                  <span className={`badge ${report.issueCount > 0 ? 'warning' : 'success'}`}>
                    {report.issueCount > 0
                      ? t('library.diagnosis.needsReview')
                      : t('library.diagnosis.looksGood')}
                  </span>
                </div>
                <div className="identify-report-stats">
                  <span>{t('library.diagnosis.estimated', { count: report.estimatedQuestionCount })}</span>
                  <span>{t('library.diagnosis.identified', { count: report.identifiedQuestionCount })}</span>
                  <span>{t('library.diagnosis.choice', { count: report.typeCounts.choice })}</span>
                  <span>{t('library.diagnosis.multiple', { count: report.typeCounts.multiple })}</span>
                  <span>{t('library.diagnosis.judge', { count: report.typeCounts.judge })}</span>
                  <span>{t('library.diagnosis.fill', { count: report.typeCounts.fill })}</span>
                  <span>{t('library.diagnosis.short', { count: report.typeCounts.short })}</span>
                </div>
                <div className="identify-report-stats muted" style={{ fontSize: 'var(--text-sm)' }}>
                  <span>
                    {t('library.diagnosis.coverage', {
                      pct:
                        report.coverageRatio == null
                          ? '—'
                          : `${Math.round(report.coverageRatio * 100)}%`,
                    })}
                  </span>
                  <span>{t('library.diagnosis.missingExplanation', { count: report.missingExplanationCount })}</span>
                  <span>{t('library.diagnosis.suspicious', { count: report.suspiciousQuestionCount })}</span>
                </div>
                {report.issues.length > 0 && (
                  <ul className="identify-report-issues">
                    {report.issues.slice(0, 4).map((issue, index) => (
                      <li key={`${issue.code}-${index}`} className={`identify-report-issue ${issue.severity}`}>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div
              className="row"
              style={{
                paddingTop: 'var(--space-3)',
                borderTop: '1px solid var(--border)',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              <button
                className="primary icon-only"
                disabled={d.question_count === 0 || isBusy}
                onClick={() => navigate(`/practice/${d.id}`)}
                title={t('library.actions.practice')}
                aria-label={t('library.actions.practice')}
              >
                <Play size={16} />
              </button>
              <button
                className="icon-only"
                disabled={d.question_count === 0 || isBusy}
                onClick={() => navigate(`/exam/${d.id}`)}
                title={t('exam.title')}
                aria-label={t('exam.title')}
              >
                <ClipboardCheck size={16} />
              </button>
              <button
                className="icon-only"
                disabled={isBusy || isDeleting}
                onClick={() => onIdentify(d.id)}
                title={
                  isBusy
                    ? t('library.actions.identifying')
                    : t('library.actions.identify')
                }
                aria-label={
                  isBusy
                    ? t('library.actions.identifying')
                    : t('library.actions.identify')
                }
              >
                {isBusy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <ScanLine size={16} />
                )}
              </button>
              <button
                disabled={isDeleting}
                onClick={() => navigate(`/markdown/${d.id}`)}
                title={t('library.actions.edit')}
                aria-label={t('library.actions.edit')}
                className="icon-only"
              >
                <FileText size={16} />
              </button>
              <button
                disabled={isDeleting}
                onClick={() => onResetProgress(d.id)}
                title={t('library.actions.reset')}
                aria-label={t('library.actions.reset')}
                className="icon-only"
              >
                <RotateCcw size={16} />
              </button>
              <button
                disabled={isDeleting}
                onClick={() => onExportMarkdown(d, 'copy')}
                title={t('practice.completion.copyMarkdown')}
                aria-label={t('practice.completion.copyMarkdown')}
                className="icon-only"
              >
                <Copy size={16} />
              </button>
              <button
                disabled={isDeleting}
                onClick={() => onExportMarkdown(d, 'download')}
                title={t('practice.completion.exportMarkdown')}
                aria-label={t('practice.completion.exportMarkdown')}
                className="icon-only"
              >
                <Download size={16} />
              </button>
              <div style={{ flex: 1 }} />
              <button
                className="danger icon-only"
                disabled={isDeleting}
                onClick={() => onDelete(d.id)}
                title={
                  isDeleting
                    ? t('library.actions.deleting')
                  : t('library.actions.delete')
                }
                aria-label={isDeleting ? t('library.actions.deleting') : t('library.actions.delete')}
              >
                {isDeleting ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          </div>
        );
      })}

      <Modal open={createOpen} title={t('library.create.title')} onClose={() => setCreateOpen(false)}>
        <label className="modal-label">{t('library.create.nameLabel')}</label>
        <input
          className="input"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder={t('library.create.namePlaceholder')}
          autoFocus
        />
        <label className="modal-label">{t('library.create.descLabel')}</label>
        <input
          className="input"
          value={createDesc}
          onChange={(e) => setCreateDesc(e.target.value)}
          placeholder={t('library.create.descPlaceholder')}
        />
        <label className="modal-label">{t('library.create.markdownLabel')}</label>
        <textarea
          className="input"
          value={createMd}
          onChange={(e) => setCreateMd(e.target.value)}
          placeholder={t('library.create.markdownPlaceholder')}
          rows={12}
        />
        <div className="modal-actions">
          <button className="ghost" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</button>
          <button className="primary" disabled={creating || !createName.trim()} onClick={onCreateDocument}>
            {creating ? t('library.create.creating') : t('library.create.create')}
          </button>
        </div>
      </Modal>

      <Modal open={editDoc !== null} title={t('library.edit.title')} onClose={() => setEditDoc(null)}>
        <label className="modal-label">{t('library.edit.nameLabel')}</label>
        <input
          className="input"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder={t('library.create.namePlaceholder')}
          autoFocus
        />
        <label className="modal-label">{t('library.edit.descLabel')}</label>
        <input
          className="input"
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          placeholder={t('library.edit.descPlaceholder')}
        />
        <div className="modal-actions">
          <button className="ghost" onClick={() => setEditDoc(null)}>{t('common.cancel')}</button>
          <button className="primary" disabled={saving || !editName.trim()} onClick={onSaveEdit}>
            {saving ? t('library.edit.saving') : t('library.edit.save')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

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
          (acc, q) => {
            acc[q.type]++;
            return acc;
          },
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
