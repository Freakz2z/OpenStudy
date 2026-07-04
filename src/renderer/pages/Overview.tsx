import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Files,
} from 'lucide-react';
import type { Document, DocumentStats, OverallStats, WrongQuestion } from '@shared/types';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { PageHeader } from '../components/PageHeader';
import { formatPct } from '../utils/helpers';

type MetricTone = 'default' | 'primary' | 'success' | 'warning';

interface MetricCardProps {
  icon: typeof Files;
  label: string;
  value: string;
  tone?: MetricTone;
}

function MetricCard({ icon: Icon, label, value, tone = 'default' }: MetricCardProps) {
  return (
    <div className={`card overview-metric-card tone-${tone}`}>
      <div className="overview-metric-icon">
        <Icon size={18} />
      </div>
      <div className="overview-metric-copy">
        <div className="overview-metric-label">{label}</div>
        <div className="overview-metric-value">{value}</div>
      </div>
    </div>
  );
}

export default function Overview() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Document[]>([]);
  const [stats, setStats] = useState<Record<number, DocumentStats>>({});
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [wrongList, setWrongList] = useState<WrongQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await window.api.listDocuments();
        if (cancelled) return;
        setDocs(list);
        const [overallStats, wrongQuestions, statEntries] = await Promise.all([
          window.api.getOverallStats().catch(() => null),
          window.api.listWrongQuestions().catch(() => []),
          Promise.all(
            list.map((doc) =>
              window.api
                .getDocumentStats(doc.id)
                .then((value) => [doc.id, value] as const)
                .catch(() => [doc.id, null] as const),
            ),
          ),
        ]);
        if (cancelled) return;
        setOverall(overallStats);
        setWrongList(wrongQuestions);
        const nextStats: Record<number, DocumentStats> = {};
        for (const [docId, value] of statEntries) {
          if (value) nextStats[docId] = value;
        }
        setStats(nextStats);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const wrongByDoc = useMemo(() => {
    const docMap = new Map<number, { count: number; title: string; fileType: string }>();
    for (const item of wrongList) {
      const current = docMap.get(item.document_id) ?? {
        count: 0,
        title: item.document_title ?? `#${item.document_id}`,
        fileType: item.document_file_type ?? '',
      };
      current.count++;
      docMap.set(item.document_id, current);
    }
    return [...docMap.entries()]
      .map(([docId, value]) => ({ docId, ...value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [wrongList]);

  const progressRows = useMemo(
    () =>
      docs
        .map((doc) => {
          const docStats = stats[doc.id];
          return {
            doc,
            attempted: docStats?.attempted_count ?? 0,
            total: docStats?.question_count ?? doc.question_count,
            wrong: docStats?.wrong_count ?? 0,
            accuracy: docStats?.accuracy ?? null,
          };
        })
        .sort((a, b) => {
          if (b.attempted !== a.attempted) return b.attempted - a.attempted;
          return b.total - a.total;
        })
        .slice(0, 6),
    [docs, stats],
  );

  const activeDocCount = progressRows.filter((item) => item.attempted > 0).length;

  return (
    <div className="page">
      <PageHeader title={t('overview.title')} />

      {error && (
        <div className="card error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState label={t('common.loading')} />
      ) : (
        <>
          <div className="overview-metrics-grid">
            <MetricCard
              icon={Files}
              label={t('overview.metrics.documents')}
              value={String(overall?.document_count ?? docs.length)}
              tone="primary"
            />
            <MetricCard
              icon={BookOpen}
              label={t('overview.metrics.questions')}
              value={String(overall?.question_count ?? 0)}
            />
            <MetricCard
              icon={Activity}
              label={t('overview.metrics.attempted')}
              value={String(overall?.attempted_count ?? 0)}
            />
            <MetricCard
              icon={CheckCircle2}
              label={t('overview.metrics.accuracy')}
              value={formatPct(overall?.accuracy)}
              tone="success"
            />
            <MetricCard
              icon={CircleAlert}
              label={t('overview.metrics.wrong')}
              value={String(overall?.wrong_count ?? wrongList.length)}
              tone="warning"
            />
            <MetricCard
              icon={BarChart3}
              label={t('overview.metrics.activeDocs')}
              value={String(activeDocCount)}
            />
          </div>

          <div className="overview-panel-grid">
            <section className="card overview-panel">
              <div className="card-header">
                <h2>{t('overview.progress.title')}</h2>
              </div>
              {progressRows.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={t('overview.progress.empty')}
                  description={t('overview.progress.emptyHint')}
                />
              ) : (
                <div className="overview-list">
                  {progressRows.map(({ doc, attempted, total, wrong, accuracy }) => {
                    const ratio = total > 0 ? attempted / total : 0;
                    return (
                      <div key={doc.id} className="overview-list-row">
                        <div className="overview-list-copy">
                          <div className="row gap-sm wrap">
                            <strong>{doc.title}</strong>
                            <span className="badge muted">{doc.file_type.toUpperCase()}</span>
                          </div>
                          <div className="overview-list-meta">
                            {t('overview.progress.meta', {
                              attempted,
                              total,
                              wrong,
                              accuracy: formatPct(accuracy),
                            })}
                          </div>
                        </div>
                        <div className="overview-list-progress">
                          <div className="progress" aria-hidden="true">
                            <div
                              className="progress-bar"
                              style={{ width: `${Math.round(ratio * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="card overview-panel">
              <div className="card-header">
                <h2>{t('overview.wrong.title')}</h2>
              </div>
              {wrongByDoc.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title={t('overview.wrong.empty')}
                  description={t('overview.wrong.emptyHint')}
                />
              ) : (
                <div className="overview-list">
                  {wrongByDoc.map((item) => (
                    <div key={item.docId} className="overview-list-row">
                      <div className="overview-list-copy">
                        <div className="row gap-sm wrap">
                          <strong>{item.title}</strong>
                          {item.fileType && (
                            <span className="badge muted">{item.fileType.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="overview-list-meta">
                          {t('overview.wrong.meta', { count: item.count })}
                        </div>
                      </div>
                      <span className="badge error">
                        {t('overview.wrong.badge', { count: item.count })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
