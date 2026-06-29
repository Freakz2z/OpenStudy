import { useTranslation } from 'react-i18next';
import { Info, Scale, BookOpen, Sparkles } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { PageHeader } from '../components/PageHeader';

export default function About() {
  const { t } = useTranslation();
  return (
    <div className="page">
      <PageHeader title={t('about.title')} />

      <div className="card about-brand">
        <BrandLogo
          alt="OpenStudy"
          className="about-brand-logo"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{t('app.name')}</h2>
          <div className="muted" style={{ marginTop: 4 }}>
            {t('app.tagline')}
          </div>
          <div
            className="tiny"
            style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}
          >
            <span>v0.1.0</span>
            <span>·</span>
            <span>Electron + React + TypeScript</span>
          </div>
        </div>
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

      <div className="card">
        <div className="row gap-sm" style={{ marginBottom: 10 }}>
          <Info size={18} />
          <h2 style={{ margin: 0 }}>{t('about.tech')}</h2>
        </div>
        <div
          className="row gap-sm"
          style={{ flexWrap: 'wrap', fontSize: 'var(--text-sm)' }}
        >
          {['Electron', 'React 18', 'TypeScript', 'Vite', 'SQLite', 'DeepSeek'].map(
            (t) => (
              <span key={t} className="badge">
                {t}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="card">
        <div className="row gap-sm" style={{ marginBottom: 10 }}>
          <Scale size={18} />
          <h2 style={{ margin: 0 }}>{t('about.license')}</h2>
        </div>
        <p style={{ color: 'var(--fg-muted)' }}>{t('about.licenseText')}</p>
      </div>
    </div>
  );
}
