import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type {
  PracticeAskRequest,
  RecentAttemptDetail,
  StudyInsightsResult,
} from '@shared/types';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { PageHeader } from '../components/PageHeader';

const INSIGHTS_CACHE_KEY = 'openstudy:insights:cache:v1';

interface CachedInsightsPayload {
  signature: string;
  language: 'zh' | 'en';
  generatedAt: number;
  result: StudyInsightsResult;
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function buildRecentDays(days: number) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const current = new Date(now);
    current.setDate(now.getDate() - (days - index - 1));
    return current.getTime();
  });
}

function getStudyWindowKey(hour: number): 'lateNight' | 'morning' | 'afternoon' | 'evening' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'lateNight';
}

function getQuestionTypeLabel(
  type: RecentAttemptDetail['question_type'],
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (type) {
    case 'choice':
    case 'multiple':
    case 'judge':
    case 'fill':
    case 'short':
    case 'code':
      return t(`practice.types.${type}`);
    default:
      return type;
  }
}

type CompatAPI = typeof window.api & {
  listRecentAttempts?: (limit?: number) => Promise<RecentAttemptDetail[]>;
  generateStudyInsights?: typeof window.api.generateStudyInsights;
  askPracticeQuestion?: typeof window.api.askPracticeQuestion;
};

function shouldFallbackRecentAttempts(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes("No handler registered for 'attempt:listRecent'") ||
    message.includes("No handler registered for \"attempt:listRecent\"") ||
    message.includes('attempt:listRecent')
  );
}

async function listRecentAttemptsCompat(limit: number): Promise<RecentAttemptDetail[]> {
  const api = window.api as CompatAPI;
  if (typeof api.listRecentAttempts === 'function') {
    try {
      return await api.listRecentAttempts(limit);
    } catch (error) {
      if (!shouldFallbackRecentAttempts(error)) {
        throw error;
      }
    }
  }

  const documents = await api.listDocuments();
  const perDocument = await Promise.all(
    documents.map(async (doc) => {
      const [questions, snapshots] = await Promise.all([
        api.getQuestionsByDocument(doc.id),
        api.listAttemptsByDocument(doc.id),
      ]);
      return { doc, questions, snapshots };
    }),
  );

  const merged: RecentAttemptDetail[] = [];
  for (const { doc, questions, snapshots } of perDocument) {
    const questionMap = new Map(questions.map((question) => [question.id, question]));
    for (const snapshot of snapshots) {
      const question = questionMap.get(snapshot.question_id);
      if (!question) continue;
      merged.push({
        ...snapshot,
        document_id: doc.id,
        document_title: doc.title,
        question_type: question.type,
        question_stem: question.stem,
        reference_answer: question.answer,
      });
    }
  }

  return merged
    .sort((a, b) => b.attempted_at - a.attempted_at)
    .slice(0, limit);
}

function shouldFallbackStudyInsights(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('llm:studyInsights') && message.includes('No handler registered');
}

function parseLegacyStudyInsights(
  raw: string,
  attempts: RecentAttemptDetail[],
  language: 'zh' | 'en',
): StudyInsightsResult {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const candidates = [
    fenced,
    firstBrace >= 0 && lastBrace > firstBrace
      ? trimmed.slice(firstBrace, lastBrace + 1)
      : undefined,
    trimmed,
  ].filter((item): item is string => Boolean(item));

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as Partial<StudyInsightsResult>;
      if (
        typeof value.summary === 'string' &&
        Array.isArray(value.highlights) &&
        Array.isArray(value.risks) &&
        Array.isArray(value.actions)
      ) {
        return {
          summary: value.summary.trim(),
          highlights: value.highlights.filter((item): item is string => typeof item === 'string'),
          risks: value.risks.filter((item): item is string => typeof item === 'string'),
          actions: value.actions.filter((item): item is string => typeof item === 'string'),
        };
      }
    } catch {
      // Older models may return prose. Keep it as the summary and supplement it below.
    }
  }

  const correct = attempts.filter((item) => item.is_correct).length;
  const accuracy = Math.round((correct / attempts.length) * 100);
  return {
    summary:
      trimmed ||
      (language === 'en'
        ? `Your recent accuracy is ${accuracy}%.`
        : `近期练习正确率为 ${accuracy}%。`),
    highlights: [
      language === 'en'
        ? `${correct} of ${attempts.length} recent answers were correct.`
        : `最近 ${attempts.length} 次作答中答对 ${correct} 次。`,
    ],
    risks: [],
    actions: [
      language === 'en'
        ? 'Review incorrect answers first, then practise the same question types again.'
        : '优先复盘错题，再针对相同题型进行一轮练习。',
    ],
  };
}

async function generateStudyInsightsCompat(
  attempts: RecentAttemptDetail[],
  language: 'zh' | 'en',
): Promise<StudyInsightsResult> {
  const api = window.api as CompatAPI;
  if (typeof api.generateStudyInsights === 'function') {
    try {
      return await api.generateStudyInsights({ attempts, language });
    } catch (error) {
      if (!shouldFallbackStudyInsights(error)) throw error;
    }
  }

  if (typeof api.askPracticeQuestion !== 'function') {
    throw new Error(
      language === 'en'
        ? 'The AI insights interface is unavailable. Please restart OpenStudy and try again.'
        : 'AI 洞察接口暂不可用，请重启 OpenStudy 后再试。',
    );
  }

  const records = attempts.slice(0, 60).map((item, index) =>
    [
      `${index + 1}. ${item.document_title}`,
      item.question_type,
      item.is_correct ? 'correct' : 'wrong',
      item.question_stem.replace(/\s+/g, ' ').slice(0, 100),
    ].join(' | '),
  );
  const request: PracticeAskRequest = {
    question: {
      type: 'short',
      stem: records.join('\n'),
      options: null,
      answer: language === 'en' ? 'No fixed answer.' : '无固定答案',
      explanation: null,
    },
    prompt:
      language === 'en'
        ? 'Analyse these recent attempts. Return JSON only: {"summary":"...","highlights":["..."],"risks":["..."],"actions":["..."]}. Give 2–4 concise, actionable items per array.'
        : '请分析这些最近做题记录。只返回 JSON：{"summary":"...","highlights":["..."],"risks":["..."],"actions":["..."]}。每个数组给出 2～4 条简洁、可执行的内容。',
    history: [],
    userAnswer: null,
    isCorrect: null,
  };
  const raw = await api.askPracticeQuestion(request);
  return parseLegacyStudyInsights(raw, attempts, language);
}

function buildInsightsSignature(
  attempts: RecentAttemptDetail[],
  language: 'zh' | 'en',
): string {
  return JSON.stringify({
    language,
    attempts: attempts.slice(0, 60).map((item) => ({
      questionId: item.question_id,
      documentId: item.document_id,
      correct: item.is_correct,
      attemptedAt: item.attempted_at,
      answer: item.user_answer,
    })),
  });
}

function readCachedInsights(
  signature: string,
  language: 'zh' | 'en',
): CachedInsightsPayload | null {
  try {
    const raw = window.localStorage.getItem(INSIGHTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedInsightsPayload>;
    if (
      parsed.signature !== signature ||
      parsed.language !== language ||
      !parsed.result ||
      typeof parsed.generatedAt !== 'number'
    ) {
      return null;
    }
    return parsed as CachedInsightsPayload;
  } catch {
    return null;
  }
}

function writeCachedInsights(payload: CachedInsightsPayload): void {
  try {
    window.localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures and continue using in-memory state.
  }
}

export default function Insights() {
  const { t, i18n } = useTranslation();
  const [attempts, setAttempts] = useState<RecentAttemptDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [insights, setInsights] = useState<StudyInsightsResult | null>(null);
  const language = i18n.language.startsWith('en') ? 'en' : 'zh';

  const loadAttempts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listRecentAttemptsCompat(80);
      setAttempts(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async (items: RecentAttemptDetail[], force = false) => {
    if (!items.length) {
      setInsights(null);
      setInsightError(null);
      return;
    }
    const signature = buildInsightsSignature(items, language);
    if (!force) {
      const cached = readCachedInsights(signature, language);
      if (cached) {
        setInsights(cached.result);
        setInsightError(null);
        return;
      }
    }
    setInsights(null);
    setInsightLoading(true);
    setInsightError(null);
    try {
      const result = await generateStudyInsightsCompat(items.slice(0, 60), language);
      setInsights(result);
      writeCachedInsights({
        signature,
        language,
        generatedAt: Date.now(),
        result,
      });
    } catch (err) {
      setInsightError((err as Error).message);
    } finally {
      setInsightLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void loadAttempts();
  }, [loadAttempts]);

  useEffect(() => {
    if (!loading && attempts.length === 0) {
      setInsights(null);
      setInsightError(null);
      return;
    }
    if (!loading && attempts.length > 0) {
      const signature = buildInsightsSignature(attempts, language);
      const cached = readCachedInsights(signature, language);
      setInsights(cached?.result ?? null);
      setInsightError(null);
    }
  }, [attempts, loading, language]);

  const recentAccuracy = useMemo(() => {
    if (!attempts.length) return null;
    const correct = attempts.filter((item) => item.is_correct).length;
    return correct / attempts.length;
  }, [attempts]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    for (const item of attempts) {
      if (!item.is_correct) break;
      streak++;
    }
    return streak;
  }, [attempts]);

  const byType = useMemo(() => {
    const map = new Map<string, { total: number; correct: number }>();
    for (const item of attempts) {
      const current = map.get(item.question_type) ?? { total: 0, correct: 0 };
      current.total += 1;
      if (item.is_correct) current.correct += 1;
      map.set(item.question_type, current);
    }
    return [...map.entries()]
      .map(([type, value]) => ({
        type,
        total: value.total,
        correct: value.correct,
        accuracy: value.total > 0 ? value.correct / value.total : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [attempts]);

  const byDoc = useMemo(() => {
    const map = new Map<number, { title: string; total: number; correct: number }>();
    for (const item of attempts) {
      const current = map.get(item.document_id) ?? {
        title: item.document_title,
        total: 0,
        correct: 0,
      };
      current.total += 1;
      if (item.is_correct) current.correct += 1;
      map.set(item.document_id, current);
    }
    return [...map.entries()]
      .map(([documentId, value]) => ({
        documentId,
        ...value,
        accuracy: value.total > 0 ? value.correct / value.total : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [attempts]);

  const activeDayCount = useMemo(() => {
    return new Set(attempts.map((item) => startOfDay(item.attempted_at))).size;
  }, [attempts]);

  const dailyTrend = useMemo(() => {
    const days = buildRecentDays(7);
    const map = new Map<number, { total: number; correct: number }>();
    for (const day of days) map.set(day, { total: 0, correct: 0 });
    for (const item of attempts) {
      const key = startOfDay(item.attempted_at);
      const current = map.get(key);
      if (!current) continue;
      current.total += 1;
      if (item.is_correct) current.correct += 1;
    }
    return days.map((day) => {
      const current = map.get(day) ?? { total: 0, correct: 0 };
      return {
        day,
        label: new Date(day).toLocaleDateString(i18n.language, {
          month: 'numeric',
          day: 'numeric',
        }),
        total: current.total,
        accuracy: current.total > 0 ? current.correct / current.total : null,
      };
    });
  }, [attempts, i18n.language]);

  const maxDailyTotal = useMemo(
    () => Math.max(...dailyTrend.map((item) => item.total), 1),
    [dailyTrend],
  );

  const strongestType = byType
    .filter((item) => item.total >= 2)
    .sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.total - a.total;
    })[0];

  const weakestType = byType
    .filter((item) => item.total >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)[0];

  const dominantStudyWindow = useMemo(() => {
    const buckets = new Map<'lateNight' | 'morning' | 'afternoon' | 'evening', number>();
    for (const item of attempts) {
      const hour = new Date(item.attempted_at).getHours();
      const key = getStudyWindowKey(hour);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'evening';
  }, [attempts]);

  const dominantDoc = byDoc[0] ?? null;

  const profileArchetype = useMemo(() => {
    if (activeDayCount >= 10 && (recentAccuracy ?? 0) >= 0.75) return 'steady';
    if ((recentAccuracy ?? 0) < 0.6 && weakestType) return 'repair';
    if (byDoc.length <= 1 && attempts.length >= 6) return 'deep';
    return 'building';
  }, [activeDayCount, attempts.length, byDoc.length, recentAccuracy, weakestType]);

  const profileCoverage = byDoc.length <= 1
    ? t('insights.profile.coverage.single')
    : t('insights.profile.coverage.multi', { count: byDoc.length });

  return (
    <div className="page insights-page">
      <PageHeader
        title={t('insights.title')}
        actions={
          <>
            <button
              className="icon-only"
              onClick={() => void loadAttempts()}
              title={t('insights.actions.reload')}
              aria-label={t('insights.actions.reload')}
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="primary icon-only"
              onClick={() => void loadInsights(attempts, true)}
              disabled={!attempts.length || insightLoading}
              title={insightLoading ? t('insights.actions.analyzing') : t('insights.actions.analyze')}
              aria-label={insightLoading ? t('insights.actions.analyzing') : t('insights.actions.analyze')}
            >
              {insightLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            </button>
          </>
        }
      />

      {error && <div className="card error" role="alert">{error}</div>}

      {loading ? (
        <LoadingState label={t('insights.loading')} />
      ) : attempts.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={t('insights.empty')}
          description={t('insights.emptyHint')}
        />
      ) : (
        <>
          <div className="overview-metrics-grid insights-metrics-grid">
            <div className="card overview-metric-card tone-primary">
              <div className="overview-metric-icon"><Activity size={18} /></div>
              <div className="overview-metric-copy">
                <div className="overview-metric-label">{t('insights.metrics.recentAttempts')}</div>
                <div className="overview-metric-value">{attempts.length}</div>
              </div>
            </div>
            <div className="card overview-metric-card tone-success">
              <div className="overview-metric-icon"><CheckCircle2 size={18} /></div>
              <div className="overview-metric-copy">
                <div className="overview-metric-label">{t('insights.metrics.recentAccuracy')}</div>
                <div className="overview-metric-value">{formatPct(recentAccuracy)}</div>
              </div>
            </div>
            <div className="card overview-metric-card tone-warning">
              <div className="overview-metric-icon"><TrendingUp size={18} /></div>
              <div className="overview-metric-copy">
                <div className="overview-metric-label">{t('insights.metrics.streak')}</div>
                <div className="overview-metric-value">{currentStreak}</div>
              </div>
            </div>
            <div className="card overview-metric-card">
              <div className="overview-metric-icon"><BarChart3 size={18} /></div>
              <div className="overview-metric-copy">
                <div className="overview-metric-label">{t('insights.metrics.activeDays')}</div>
                <div className="overview-metric-value">{activeDayCount}</div>
              </div>
            </div>
          </div>

          <section className="card panel-card insights-profile-panel">
            <div className="card-header">
              <h2>{t('insights.profile.title')}</h2>
            </div>
            <div className="insights-profile-summary">
              {t('insights.profile.summary', {
                archetype: t(`insights.profile.archetypes.${profileArchetype}`),
                attempts: attempts.length,
                docs: byDoc.length,
                activeDays: activeDayCount,
                accuracy: formatPct(recentAccuracy),
              })}
            </div>
            <div className="insights-profile-grid">
              <div className="insights-profile-card">
                <div className="tiny muted">{t('insights.profile.archetype')}</div>
                <strong>{t(`insights.profile.archetypes.${profileArchetype}`)}</strong>
              </div>
              <div className="insights-profile-card">
                <div className="tiny muted">{t('insights.profile.window')}</div>
                <strong>{t(`insights.profile.windows.${dominantStudyWindow}`)}</strong>
              </div>
              <div className="insights-profile-card">
                <div className="tiny muted">{t('insights.profile.focusDoc')}</div>
                <strong>{dominantDoc?.title ?? t('insights.focus.none')}</strong>
              </div>
              <div className="insights-profile-card">
                <div className="tiny muted">{t('insights.profile.coverage.label')}</div>
                <strong>{profileCoverage}</strong>
              </div>
              <div className="insights-profile-card">
                <div className="tiny muted">{t('insights.profile.strongestType')}</div>
                <strong>
                  {strongestType
                    ? getQuestionTypeLabel(
                        strongestType.type as RecentAttemptDetail['question_type'],
                        t,
                      )
                    : t('insights.focus.none')}
                </strong>
              </div>
              <div className="insights-profile-card">
                <div className="tiny muted">{t('insights.profile.weakestType')}</div>
                <strong>
                  {weakestType
                    ? getQuestionTypeLabel(
                        weakestType.type as RecentAttemptDetail['question_type'],
                        t,
                      )
                    : t('insights.focus.none')}
                </strong>
              </div>
            </div>
          </section>

          <div className="insights-grid">
            <section className="card panel-card">
              <div className="card-header">
                <h2>{t('insights.typeBreakdown.title')}</h2>
              </div>
              <div className="insights-list">
                {byType.map((item) => (
                  <div key={item.type} className="insights-list-row">
                    <div className="insights-list-copy">
                      <strong>{getQuestionTypeLabel(item.type as RecentAttemptDetail['question_type'], t)}</strong>
                      <div className="overview-list-meta">
                        {t('insights.typeBreakdown.meta', {
                          total: item.total,
                          correct: item.correct,
                          accuracy: formatPct(item.accuracy),
                        })}
                      </div>
                    </div>
                    <div className="insights-bar-track">
                      <div
                        className="insights-bar-fill"
                        style={{ width: `${Math.max(Math.round(item.accuracy * 100), 8)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card panel-card">
              <div className="card-header">
                <h2>{t('insights.dailyTrend.title')}</h2>
              </div>
              <div className="insights-trend">
                {dailyTrend.map((item) => (
                  <div key={item.day} className="insights-trend-col">
                    <div className="insights-trend-bar-wrap">
                      <div
                        className="insights-trend-bar"
                        style={{ height: `${Math.round((item.total / maxDailyTotal) * 100)}%` }}
                      />
                    </div>
                    <div className="tiny">{item.label}</div>
                    <div className="insights-trend-value">{item.total}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card panel-card">
              <div className="card-header">
                <h2>{t('insights.documents.title')}</h2>
              </div>
              <div className="insights-list">
                {byDoc.map((item) => (
                  <div key={item.documentId} className="insights-list-row">
                    <div className="insights-list-copy">
                      <strong>{item.title}</strong>
                      <div className="overview-list-meta">
                        {t('insights.documents.meta', {
                          total: item.total,
                          accuracy: formatPct(item.accuracy),
                        })}
                      </div>
                    </div>
                    <span className="badge">{item.total}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card panel-card">
              <div className="card-header">
                <h2>{t('insights.focus.title')}</h2>
              </div>
              <div className="insight-callout-list">
                <div className="insight-callout warning">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{t('insights.focus.weakestType')}</strong>
                    <div className="overview-list-meta">
                      {weakestType
                        ? t('insights.focus.weakestTypeValue', {
                            type: getQuestionTypeLabel(
                              weakestType.type as RecentAttemptDetail['question_type'],
                              t,
                            ),
                            accuracy: formatPct(weakestType.accuracy),
                          })
                        : t('insights.focus.none')}
                    </div>
                  </div>
                </div>
                <div className="insight-callout">
                  <BarChart3 size={16} />
                  <div>
                    <strong>{t('insights.focus.recentState')}</strong>
                    <div className="overview-list-meta">
                      {t('insights.focus.recentStateValue', {
                        attempts: attempts.length,
                        accuracy: formatPct(recentAccuracy),
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="card panel-card insights-ai-panel">
            <div className="panel-card-header">
              <div className="panel-title-row">
                <div className="panel-icon-wrap">
                  <Sparkles size={18} />
                </div>
                <div className="panel-card-copy">
                  <h2>{t('insights.ai.title')}</h2>
                  <p>{t('insights.ai.subtitle')}</p>
                </div>
              </div>
            </div>

            {insightError && <div className="card error insight-inline-error">{insightError}</div>}

            {insightLoading && !insights ? (
              <LoadingState label={t('insights.actions.analyzing')} />
            ) : insights ? (
              <div className="insights-ai-grid">
                <div className="insight-summary-card">
                  <strong>{t('insights.ai.summary')}</strong>
                  <p>{insights.summary}</p>
                </div>
                <div className="insight-columns">
                  <div>
                    <h3>{t('insights.ai.highlights')}</h3>
                    <ul>
                      {insights.highlights.map((item, index) => (
                        <li key={`highlight-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>{t('insights.ai.risks')}</h3>
                    <ul>
                      {insights.risks.map((item, index) => (
                        <li key={`risk-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>{t('insights.ai.actions')}</h3>
                    <ul>
                      {insights.actions.map((item, index) => (
                        <li key={`action-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title={t('insights.ai.empty')}
                description={t('insights.ai.emptyHint')}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
