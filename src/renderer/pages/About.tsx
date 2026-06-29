import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, BookOpen, Globe, RefreshCw, Sparkles } from 'lucide-react';
import type { AppMeta, AppVersionInfo } from '@shared/types';
import { BrandLogo } from '../components/BrandLogo';
import { PageHeader } from '../components/PageHeader';

const FALLBACK_REPOSITORY_URL = 'https://github.com/Freakz2z/OpenStudy';
const FALLBACK_RELEASES_URL = `${FALLBACK_REPOSITORY_URL}/releases`;
const FALLBACK_RELEASE_API = 'https://api.github.com/repos/Freakz2z/OpenStudy/releases/latest';
const FALLBACK_APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.2.1';

type AboutCompatApi = Partial<
  Pick<typeof window.api, 'getAppMeta' | 'checkLatestRelease'>
>;

function getAboutApi(): AboutCompatApi {
  return ((window as unknown as { api?: AboutCompatApi }).api ?? {}) as AboutCompatApi;
}

function normalizeVersion(version: string): string[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((segment) => segment.replace(/\D+/g, ''))
    .filter(Boolean);
}

function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a);
  const right = normalizeVersion(b);
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const l = Number(left[index] ?? '0');
    const r = Number(right[index] ?? '0');
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

function buildFallbackMeta(name: string): AppMeta {
  return {
    name,
    version: FALLBACK_APP_VERSION,
    repositoryUrl: FALLBACK_REPOSITORY_URL,
    releasesUrl: FALLBACK_RELEASES_URL,
  };
}

async function fetchLatestReleaseFromBrowser(currentVersion: string): Promise<AppVersionInfo> {
  const checkedAt = Date.now();
  const fallbackReleaseUrl = `${FALLBACK_RELEASES_URL}/latest`;

  try {
    const response = await fetch(FALLBACK_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const payload = (await response.json()) as {
      tag_name?: string;
      html_url?: string;
    };
    const latestVersion = payload.tag_name?.replace(/^v/i, '') ?? null;
    return {
      currentVersion,
      latestVersion,
      upToDate: latestVersion ? compareVersions(currentVersion, latestVersion) >= 0 : null,
      checkedAt,
      releaseUrl: payload.html_url || fallbackReleaseUrl,
      error: null,
    };
  } catch (error) {
    return {
      currentVersion,
      latestVersion: null,
      upToDate: null,
      checkedAt,
      releaseUrl: fallbackReleaseUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default function About() {
  const { t } = useTranslation();
  const [meta, setMeta] = useState<AppMeta | null>(() => buildFallbackMeta('OpenStudy'));
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(force = false) {
    setLoading(true);
    try {
      const api = getAboutApi();
      const fallbackMeta = buildFallbackMeta(t('app.name'));
      const appMeta = await (api.getAppMeta?.().catch(() => null) ?? Promise.resolve(null));
      const resolvedMeta = appMeta ?? fallbackMeta;
      setMeta(resolvedMeta);

      const latest = await (api.checkLatestRelease?.(force).catch(() => null) ??
        fetchLatestReleaseFromBrowser(resolvedMeta.version));

      setVersionInfo(
        latest ?? {
          currentVersion: resolvedMeta.version,
          latestVersion: null,
          upToDate: null,
          checkedAt: Date.now(),
          releaseUrl: `${resolvedMeta.releasesUrl}/latest`,
          error: 'Version service unavailable',
        },
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(false);
  }, [t]);

  const checkedAtText = versionInfo
    ? new Date(versionInfo.checkedAt).toLocaleString()
    : null;

  return (
    <div className="page">
      <PageHeader
        title={t('about.title')}
        actions={
          <button
            className="icon-only"
            onClick={() => void load(true)}
            title={t('about.refresh')}
            aria-label={t('about.refresh')}
          >
            <RefreshCw size={16} className={loading ? 'spin' : undefined} />
          </button>
        }
      />

      <div className="card about-brand">
        <BrandLogo alt="OpenStudy" className="about-brand-logo" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{meta?.name ?? t('app.name')}</h2>
          <div className="muted" style={{ marginTop: 4 }}>
            {t('app.tagline')}
          </div>
          <div className="about-meta-row">
            <span className="badge">v{meta?.version ?? '—'}</span>
            <a
              href={meta?.repositoryUrl ?? FALLBACK_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="about-link"
            >
              <Globe size={14} />
              <span>{t('about.github')}</span>
            </a>
          </div>
        </div>
      </div>

      <div className="card about-version-card">
        <div className="row gap-sm" style={{ marginBottom: 10 }}>
          <Sparkles size={18} />
          <h2 style={{ margin: 0 }}>{t('about.version.title')}</h2>
        </div>
        <div className="about-version-grid">
          <div>
            <div className="tiny muted">{t('about.version.current')}</div>
            <strong>v{versionInfo?.currentVersion ?? meta?.version ?? '—'}</strong>
          </div>
          <div>
            <div className="tiny muted">{t('about.version.latest')}</div>
            <strong>{versionInfo?.latestVersion ? `v${versionInfo.latestVersion}` : '—'}</strong>
          </div>
          <div>
            <div className="tiny muted">{t('about.version.status')}</div>
            <strong>
              {versionInfo?.upToDate === true
                ? t('about.version.upToDate')
                : versionInfo?.upToDate === false
                  ? t('about.version.outdated')
                  : t('about.version.unknown')}
            </strong>
          </div>
        </div>
        {checkedAtText && (
          <div className="tiny muted" style={{ marginTop: 10 }}>
            {t('about.version.checkedAt', { time: checkedAtText })}
          </div>
        )}
        {versionInfo?.error && (
          <div className="tiny muted" style={{ marginTop: 8 }}>
            {t('about.version.checkFailed', { error: versionInfo.error })}
          </div>
        )}
        {versionInfo?.upToDate === false && (
          <div className="about-version-actions">
            <a
              href={versionInfo.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="button-link primary"
            >
              <ArrowUpRight size={16} />
              <span>{t('about.version.goLatest')}</span>
            </a>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row gap-sm" style={{ marginBottom: 10 }}>
          <Sparkles size={18} />
          <h2 style={{ margin: 0 }}>{t('about.philosophy')}</h2>
        </div>
        <p style={{ color: 'var(--fg-muted)', lineHeight: 1.7 }}>
          {t('about.philosophyText')}
        </p>
      </div>

      <div className="card">
        <div className="row gap-sm" style={{ marginBottom: 10 }}>
          <BookOpen size={18} />
          <h2 style={{ margin: 0 }}>{t('about.features')}</h2>
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--fg-muted)', lineHeight: 1.8 }}>
          <li>{t('about.feat1')}</li>
          <li>{t('about.feat2')}</li>
          <li>{t('about.feat3')}</li>
          <li>{t('about.feat4')}</li>
        </ul>
      </div>
    </div>
  );
}
