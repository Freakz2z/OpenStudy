import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, BookOpen, Download, Globe, RefreshCw, Sparkles, Terminal } from 'lucide-react';
import type { AppMeta, AppVersionInfo } from '@shared/types';
import { BrandLogo } from '../components/BrandLogo';
import { PageHeader } from '../components/PageHeader';

const FALLBACK_REPOSITORY_URL = 'https://github.com/Freakz2z/OpenStudy';
const FALLBACK_RELEASES_URL = `${FALLBACK_REPOSITORY_URL}/releases`;
const FALLBACK_RELEASE_API = 'https://api.github.com/repos/Freakz2z/OpenStudy/releases/latest';
const FALLBACK_APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.2.1';

type AboutCompatApi = Partial<
  Pick<typeof window.api, 'getAppMeta' | 'checkLatestRelease' | 'installSkill' | 'openCliPage'>
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
  const [installingSkill, setInstallingSkill] = useState(false);
  const [skillInstalled, setSkillInstalled] = useState(false);

  async function handleInstallSkill() {
    setInstallingSkill(true);
    try {
      const api = getAboutApi();
      const result = await (api.installSkill?.() ?? Promise.reject(new Error('not available')));
      if (result.ok) {
        setSkillInstalled(true);
      }
    } catch (e) {
      console.error('Failed to install skill:', e);
    } finally {
      setInstallingSkill(false);
    }
  }

  function handleOpenCliPage() {
    const api = getAboutApi();
    api.openCliPage?.()?.catch(() => {
      window.open('https://github.com/Freakz2z/OpenStudy/releases', '_blank');
    });
  }

  function handleOpenRelease(url: string) {
    window.open(url, '_blank');
  }

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
        <div className="flex-1" style={{ minWidth: 0 }}>
          <h2>{meta?.name ?? t('app.name')}</h2>
          <div className="muted mt-xs">
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
        <div className="row gap-sm mb-sm">
          <Sparkles size={18} />
          <h2>{t('about.version.title')}</h2>
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
          <div className="tiny muted mt-md">
            {t('about.version.checkedAt', { time: checkedAtText })}
          </div>
        )}
        {versionInfo?.error && (
          <div className="tiny muted mt-sm">
            {t('about.version.checkFailed', { error: versionInfo.error })}
          </div>
        )}
        {versionInfo?.upToDate === false && (
          <div className="about-version-actions">
            <button
              className="primary lg"
              onClick={() => handleOpenRelease(versionInfo.releaseUrl)}
            >
              <ArrowUpRight size={16} />
              <span>{t('about.version.goLatest')}</span>
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row gap-sm mb-sm">
          <Download size={18} />
          <h2>{t('about.install.title')}</h2>
        </div>
        <p className="muted mb-md">
          {t('about.install.description')}
        </p>
        <div className="about-install-row">
          <button
            className="primary lg"
            onClick={() => void handleInstallSkill()}
            disabled={installingSkill || skillInstalled}
          >
            <Sparkles size={16} />
            <span>
              {skillInstalled
                ? t('about.install.skillDone')
                : installingSkill
                  ? t('about.install.skillInstalling')
                  : t('about.install.skillBtn')}
            </span>
          </button>
          <button
            className="lg"
            onClick={() => handleOpenCliPage()}
          >
            <Terminal size={16} />
            <span>{t('about.install.cliBtn')}</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="row gap-sm mb-sm">
          <Sparkles size={18} />
          <h2>{t('about.philosophy')}</h2>
        </div>
        <p className="muted">
          {t('about.philosophyText')}
        </p>
      </div>

      <div className="card">
        <div className="row gap-sm mb-sm">
          <BookOpen size={18} />
          <h2>{t('about.features')}</h2>
        </div>
        <ul className="muted about-features-list">
          <li>{t('about.feat1')}</li>
          <li>{t('about.feat2')}</li>
          <li>{t('about.feat3')}</li>
          <li>{t('about.feat4')}</li>
        </ul>
      </div>
    </div>
  );
}
