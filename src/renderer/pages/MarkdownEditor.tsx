import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeMarkdownStandardLanguage } from '@shared/markdown-standard';
import {
  Save, FileText, Edit3, Check, RefreshCw, Loader2, SearchCheck, ListChecks, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { analyzeMarkdownPrecheck } from '@shared/question-diagnostics';
import { useToast } from '../components/ToastProvider';

type View = 'edit' | 'preview';

export default function MarkdownEditor() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [markdown, setMarkdown] = useState('');
  const [original, setOriginal] = useState('');
  const [view, setView] = useState<View>('edit');
  const [source, setSource] = useState<'db' | 'fresh' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<null | {
    count: number;
    issues: { level: string; message: string }[];
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId || !window.api) return;
    let cancelled = false;
    setLoading(true);
    const standardLang = normalizeMarkdownStandardLanguage(i18n.language);
    Promise.all([
      window.api.getMarkdown(Number(docId), standardLang),
      window.api.listDocuments(),
    ])
      .then(([res, docs]) => {
        if (cancelled) return;
        setMarkdown(res.markdown);
        setOriginal(res.markdown);
        setSource(res.source);
        setDocTitle(
          docs.find((d) => d.id === Number(docId))?.title ?? '',
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

  const dirty = markdown !== original;
  const charCount = markdown.length;
  const lineCount = markdown.split('\n').length;
  const precheck = useMemo(() => analyzeMarkdownPrecheck(markdown), [markdown]);

  async function onSave() {
    if (!docId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await window.api.saveMarkdown(Number(docId), markdown);
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
      // 清空数据库已保存的，让其从源文件重新生成
      await window.api.saveMarkdown(Number(docId), '');
      const res2 = await window.api.getMarkdown(
        Number(docId),
        normalizeMarkdownStandardLanguage(i18n.language),
      );
      setMarkdown(res2.markdown);
      setOriginal(res2.markdown);
      setSource(res2.source);
    } catch (e) {
      setError((e as Error).message);
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
    if (dirty && !confirm(t('markdownEditor.leaveConfirm'))) return;
    navigate('/library');
  }

  if (!docId) return <Navigate to="/library" replace />;
  if (loading) {
    return (
      <div className="page">
        <PageHeader
          title={t('markdownEditor.title')}
          back={{ label: t('markdownEditor.saveAndBack'), onClick: goBack }}
        />
        <LoadingState label={t('markdownEditor.loading')} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        back={{ label: t('markdownEditor.saveAndBack'), onClick: goBack }}
        title={
          <>
            {t('markdownEditor.title')}
            <span
              className="muted"
              style={{ fontSize: 14, fontWeight: 'normal' }}
            >
              · {docTitle}
            </span>
          </>
        }
        actions={
        <div className="row gap-sm">
          {source && (
            <span className="badge muted">
              {source === 'db' ? t('markdownEditor.fromDb') : t('markdownEditor.fromFile')}
            </span>
          )}
          <button
            className={view === 'edit' ? 'primary' : ''}
            onClick={() => setView('edit')}
            title={t('markdownEditor.edit')}
          >
            <Edit3 size={16} />
            <span>{t('markdownEditor.edit')}</span>
          </button>
          <button
            className={view === 'preview' ? 'primary' : ''}
            onClick={() => setView('preview')}
            title={t('markdownEditor.preview')}
          >
            <FileText size={16} />
            <span>{t('markdownEditor.preview')}</span>
          </button>
        </div>
        }
      />

      {error && (
        <div className="card error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="muted mb-md" style={{ fontSize: 12 }}>
        {t('markdownEditor.stats', { lines: lineCount, chars: charCount })}
        {dirty && <span style={{ color: 'var(--warning)' }}> · {t('markdownEditor.unsaved')}</span>}
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
          <div className="muted" style={{ fontSize: 13 }}>
            {t('markdownEditor.precheck.noIssues')}
          </div>
        )}
      </div>

      {view === 'edit' ? (
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          style={{
            width: '100%',
            minHeight: 480,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 13,
            lineHeight: 1.6,
            resize: 'vertical',
          }}
        />
      ) : (
        <div
          className="card"
          style={{
            minHeight: 480,
            whiteSpace: 'pre-wrap',
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          {markdown || (
            <span className="muted">（空）</span>
          )}
        </div>
      )}

      <div className="row mt-md" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onReset} disabled={!dirty && source === 'db'}>
          <RefreshCw size={16} />
          <span>{t('markdownEditor.resetFromFile')}</span>
        </button>
        <button
          className="primary"
          disabled={!dirty || saving}
          onClick={onSave}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="spin" />
              <span>{t('markdownEditor.saving')}</span>
            </>
          ) : saved ? (
            <>
              <Check size={16} />
              <span>{t('markdownEditor.saved')}</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>{t('markdownEditor.save')}</span>
            </>
          )}
        </button>
      </div>

      <div className="muted mt-md" style={{ fontSize: 12 }}>
        {t('markdownEditor.hint')}
      </div>
    </div>
  );
}
