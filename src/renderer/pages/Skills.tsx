import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Upload,
  ScanLine,
  ShieldCheck,
  ClipboardCheck,
  Download,
  Pencil,
  TrendingUp,
  BarChart3,
  Settings,
  Activity,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

const SKILL_KEYS = [
  'openstudy',
  'ingest',
  'identify',
  'validate',
  'exam',
  'export',
  'grade',
  'insights',
  'stats',
  'settings',
  'doctor',
] as const;

const ICONS: Record<string, typeof Sparkles> = {
  openstudy: Sparkles,
  ingest: Upload,
  identify: ScanLine,
  validate: ShieldCheck,
  exam: ClipboardCheck,
  export: Download,
  grade: Pencil,
  insights: TrendingUp,
  stats: BarChart3,
  settings: Settings,
  doctor: Activity,
};

export default function Skills() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <PageHeader title={t('skills.title')} />

      <p className="muted mb-lg" style={{ fontSize: 'var(--text-sm)' }}>
        {t('skills.subtitle')}
      </p>

      <div className="col gap-md">
        {SKILL_KEYS.map((key) => {
          const Icon = ICONS[key] ?? Sparkles;
          return (
            <div key={key} className="card">
              <div className="card-header">
                <div className="row gap-sm">
                  <Icon size={18} />
                  <h2>{t(`skills.${key}.title`)}</h2>
                </div>
                <span className="badge">{t(`skills.${key}.command`)}</span>
              </div>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                {t(`skills.${key}.desc`)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
