import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ClipboardCheck,
  MessageSquare,
  Pencil,
  Plus,
  Upload,
  Play,
  ScrollText,
  Trash2,
  X,
  AlertTriangle,
  Info,
  Loader2,
  Inbox,
  FileText,
  RotateCcw,
} from 'lucide-react';
import type {
  Document,
  DocumentStats,
  OverallStats,
} from '@shared/types';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ToastProvider';
import { listPracticeChatSessions } from '../utils/practice-chat';
import { clearStoredAttempts } from '../utils/practice-attempts';
import { clearPracticeChatSessionsByDocument } from '../utils/practice-chat';
import { Modal } from '../components/Modal';
import { formatPct } from '../utils/helpers';

type FlashKind = 'error' | 'warning';

export default function Library() {
  const { t, i18n } = useTranslation();
  const [docs, setDocs] = useState<Document[]>([]);
  const [stats, setStats] = useState<Record<number, DocumentStats>>({});
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<{
    kind: FlashKind;
    message: string;
    docId?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [wrongCounts, setWrongCounts] = useState<Record<number, number>>({});
  const [convCounts, setConvCounts] = useState<Record<number, number>>({});

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

      window.api.listWrongQuestions().then((wrongList) => {
        const wc: Record<number, number> = {};
        for (const w of wrongList) {
          wc[w.document_id] = (wc[w.document_id] || 0) + 1;
        }
        setWrongCounts(wc);
      }).catch(() => {});

      try {
        const sessions = listPracticeChatSessions();
        const cc: Record<number, number> = {};
        for (const s of sessions) {
          cc[s.docId] = (cc[s.docId] || 0) + 1;
        }
        setConvCounts(cc);
      } catch {}
    } catch (err) {
      setError({ kind: 'error', message: (err as Error).message });
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
  }, []);

  useEffect(() => {
    if (!error || error.kind !== 'warning') return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);

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
              onClick={() => navigate('/library/create')}
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
          <div className="row w-full">
            {error.kind === 'error' ? (
              <AlertTriangle size={16} />
            ) : (
              <Info size={16} />
            )}
            <div className="flex-1">{error.message}</div>
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
          <div className="flex-1" />
          {overall.question_count > 0 && <div className="row gap-md muted" style={{ fontSize: 'var(--text-sm)' }}>
            <span>
              {t('library.stats.attempted', {
                done: overall.attempted_count,
                total: overall.question_count,
              })}
            </span>
            <span>·</span>
            <span className="text-success">
              {t('library.stats.accuracy', { pct: formatPct(overall.accuracy) })}
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
        const isDeleting = deleting === d.id;
        return (
          <div key={d.id} className="card">
            <div className="card-header">
              <div className="flex-1" style={{ minWidth: 0 }}>
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
                    className="ghost icon-only icon-sm"
                    onClick={() => openEdit(d)}
                    aria-label={t('library.actions.rename')}
                    title={t('library.actions.rename')}
                  >
                    <Pencil size={12} />
                  </button>
                  <span className="badge">{d.file_type.toUpperCase()}</span>
                </div>
                <div className="muted mt-xs" style={{ fontSize: 'var(--text-sm)' }}>
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
                  {t('library.stats.accuracy', { pct: formatPct(s.accuracy) })}
                </span>
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
                disabled={d.question_count === 0}
                onClick={() => navigate(`/practice/${d.id}`)}
                title={t('library.actions.practice')}
                aria-label={t('library.actions.practice')}
              >
                <Play size={16} />
              </button>
              <button
                className="icon-only"
                disabled={d.question_count === 0}
                onClick={() => navigate(`/exam/${d.id}`)}
                title={t('exam.title')}
                aria-label={t('exam.title')}
              >
                <ClipboardCheck size={16} />
              </button>
              <button
                disabled={isDeleting}
                onClick={() => navigate(`/records/${d.id}`)}
                title={t('library.actions.viewRecords')}
                aria-label={t('library.actions.viewRecords')}
                className="icon-only"
              >
                <ScrollText size={16} />
              </button>
              <button
                disabled={isDeleting}
                onClick={() => navigate(`/wrong/${d.id}`)}
                title={t('library.actions.wrongBook', { count: wrongCounts[d.id] || 0 })}
                aria-label={t('library.actions.wrongBook', { count: wrongCounts[d.id] || 0 })}
                className="icon-only"
              >
                <AlertCircle size={16} />
              </button>
              <button
                disabled={isDeleting}
                onClick={() => navigate(`/conversations/${d.id}`)}
                title={t('library.actions.conversations', { count: convCounts[d.id] || 0 })}
                aria-label={t('library.actions.conversations', { count: convCounts[d.id] || 0 })}
                className="icon-only"
              >
                <MessageSquare size={16} />
              </button>
              <div className="flex-1" />
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
