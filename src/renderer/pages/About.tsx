import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, RefreshCw, Sparkles, Terminal, ArrowUpRight, FileText, Zap } from 'lucide-react';
import type { AppVersionInfo } from '@shared/types';
import { BrandLogo } from '../components/BrandLogo';
import { PageHeader } from '../components/PageHeader';
import { useNavigate } from 'react-router-dom';

const FALLBACK_REPOSITORY_URL = 'https://github.com/Freakz2z/OpenStudy';
const FALLBACK_RELEASES_URL = `${FALLBACK_REPOSITORY_URL}/releases`;
const FALLBACK_RELEASE_API = 'https://api.github.com/repos/Freakz2z/OpenStudy/releases/latest';
const FALLBACK_APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.2.1';

function getAboutApi() {
  return ((window as unknown as { api?: typeof window.api }).api ?? {}) as typeof window.api;
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

async function fetchLatestReleaseFromBrowser(currentVersion: string): Promise<AppVersionInfo> {
  const checkedAt = Date.now();
  const fallbackReleaseUrl = `${FALLBACK_RELEASES_URL}/latest`;

  try {
    const response = await fetch(FALLBACK_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub API responded with ${response.status}`);
    const payload = (await response.json()) as { tag_name?: string; html_url?: string };
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

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z" />
    </svg>
  );
}

export default function About() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [version, setVersion] = useState(FALLBACK_APP_VERSION);
  const [repoUrl, setRepoUrl] = useState(FALLBACK_REPOSITORY_URL);
  const [releasesUrl, setReleasesUrl] = useState(FALLBACK_RELEASES_URL);
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [installingSkill, setInstallingSkill] = useState(false);
  const [skillInstalled, setSkillInstalled] = useState(false);
  const [cliInstalled, setCliInstalled] = useState(false);

  async function handleInstallSkill() {
    setInstallingSkill(true);
    try {
      const api = getAboutApi();
      const result = await (api.installSkill?.() ?? Promise.reject(new Error('not available')));
      if (result.ok) {
        setSkillInstalled(true);
        window.localStorage.setItem('openstudy:skill-installed', 'true');
      }
    } catch (e) {
      console.error('Failed to install skill:', e);
    } finally {
      setInstallingSkill(false);
    }
  }

  const [installingCli, setInstallingCli] = useState(false);

  async function handleInstallCli() {
    setInstallingCli(true);
    try {
      const api = getAboutApi();
      const result = await (api.installCli?.() ?? Promise.reject(new Error('not available')));
      if (result.ok) {
        setCliInstalled(true);
        window.localStorage.setItem('openstudy:cli-installed', 'true');
      }
    } catch (e) {
      console.error('Failed to install CLI:', e);
    } finally {
      setInstallingCli(false);
    }
  }

  async function load(force = false) {
    setLoading(true);
    try {
      const api = getAboutApi();

      const appMeta = await api.getAppMeta?.().catch(() => null);
      const currentVersion = appMeta?.version ?? FALLBACK_APP_VERSION;
      setVersion(currentVersion);
      setRepoUrl(appMeta?.repositoryUrl ?? FALLBACK_REPOSITORY_URL);
      setReleasesUrl(appMeta?.releasesUrl ?? FALLBACK_RELEASES_URL);

      const latest = await (api.checkLatestRelease?.(force).catch(() => null) ??
        fetchLatestReleaseFromBrowser(currentVersion));
      setVersionInfo(latest ?? {
        currentVersion,
        latestVersion: null,
        upToDate: null,
        checkedAt: Date.now(),
        releaseUrl: `${appMeta?.releasesUrl ?? FALLBACK_RELEASES_URL}/latest`,
        error: 'Version service unavailable',
      });

      const skillCheck = await api.checkSkillInstalled?.().catch(() => false);
      if (skillCheck) {
        setSkillInstalled(true);
      } else if (window.localStorage.getItem('openstudy:skill-installed') === 'true') {
        setSkillInstalled(true);
      }

      const cliCheck = await api.checkCliInstalled?.().catch(() => false);
      if (cliCheck) {
        setCliInstalled(true);
      } else if (window.localStorage.getItem('openstudy:cli-installed') === 'true') {
        setCliInstalled(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(false);
  }, [t]);

  const outdated = versionInfo?.upToDate === false && versionInfo.latestVersion;

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
          <h2>OpenStudy</h2>
          <div className="about-meta-row">
            {outdated ? (
              <button
                className="primary"
                onClick={() => window.open(versionInfo!.releaseUrl, '_blank')}
              >
                <ArrowUpRight size={14} />
                <span>{t('about.version.updateTo', { version: versionInfo!.latestVersion })}</span>
              </button>
            ) : (
              <span className="badge">v{version}</span>
            )}
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="about-link-btn"
            >
              <GitHubIcon size={14} />
              <span>{t('about.github')}</span>
            </a>
            <a
              href={releasesUrl}
              target="_blank"
              rel="noreferrer"
              className="about-link-btn"
            >
              <ExternalLink size={14} />
              <span>{t('about.changelog')}</span>
            </a>
          </div>
          {versionInfo?.error && (
            <div className="tiny muted mt-xs">
              {t('about.version.checkFailed', { error: versionInfo.error })}
            </div>
          )}
          {outdated && (
            <div className="tiny muted mt-xs">
              {t('about.version.current')}: v{version} → {t('about.version.latest')}: v{versionInfo!.latestVersion}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="about-install-grid">
          <div className="about-install-item">
            <div className="row gap-sm mb-sm">
              <Sparkles size={18} />
              <h3>{t('about.install.skillTitle')}</h3>
            </div>
            <p className="muted mb-md" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7 }}>
              {t('about.install.skillDesc')}
            </p>
            <button
              className="primary"
              onClick={() => void handleInstallSkill()}
              disabled={installingSkill || skillInstalled}
            >
              <Sparkles size={14} />
              <span>
                {skillInstalled
                  ? t('about.install.skillDone')
                  : installingSkill
                    ? t('about.install.skillInstalling')
                    : t('about.install.skillBtn')}
              </span>
            </button>
          </div>

          <div className="about-install-item">
            <div className="row gap-sm mb-sm">
              <Terminal size={18} />
              <h3>{t('about.install.cliTitle')}</h3>
            </div>
            <p className="muted mb-md" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7 }}>
              {t('about.install.cliDesc')}
            </p>
            <button
              className="primary"
              onClick={() => void handleInstallCli()}
              disabled={installingCli || cliInstalled}
            >
              <Terminal size={14} />
              <span>
                {cliInstalled
                  ? t('about.install.cliDone')
                  : installingCli
                    ? t('about.install.cliInstalling')
                    : t('about.install.cliBtn')}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="about-install-grid">
          <div className="about-install-item">
            <div className="row gap-sm mb-sm">
              <FileText size={18} />
              <h3>{t('templates.title')}</h3>
            </div>
            <p className="muted mb-md" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7 }}>
              {t('templates.subtitle')}
            </p>
            <button onClick={() => navigate('/templates')}>
              <FileText size={14} />
              <span>{t('templates.title')}</span>
            </button>
          </div>

          <div className="about-install-item">
            <div className="row gap-sm mb-sm">
              <Zap size={18} />
              <h3>{t('skills.title')}</h3>
            </div>
            <p className="muted mb-md" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7 }}>
              {t('skills.subtitle')}
            </p>
            <button onClick={() => navigate('/skills')}>
              <Zap size={14} />
              <span>{t('skills.title')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
