import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, BookOpen, Globe, RefreshCw, Sparkles } from 'lucide-react';
import type { AppMeta, AppVersionInfo } from '@shared/types';
import { BrandLogo } from '../components/BrandLogo';
import { PageHeader } from '../components/PageHeader';

export default function About() {
  const { t } = useTranslation();
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(force = false) {
    setLoading(true);
    try {
      const [appMeta, latest] = await Promise.all([
        window.api.getAppMeta(),
        window.api.checkLatestRelease(force),
      ]);
      setMeta(appMeta);
      setVersionInfo(latest);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([window.api.getAppMeta(), window.api.checkLatestRelease(false)])
      .then(([appMeta, latest]) => {
        if (!active) return;
        setMeta(appMeta);
        setVersionInfo(latest);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
              href={meta?.repositoryUrl ?? 'https://github.com/Freakz2z/OpenStudy'}
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
