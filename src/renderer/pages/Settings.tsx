import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Brain,
  Check,
  Eye,
  EyeOff,
  FlaskConical,
  Keyboard,
  Languages,
  Loader2,
  Monitor,
  Moon,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import {
  LLM_PROVIDER_ORDER,
  LLM_PROVIDER_PRESETS,
  getLLMProviderPreset,
} from '@shared/llm-provider-presets';
import type { AppSettings, LLMProviderType, ModelTestResult } from '@shared/types';
import {
  DEFAULT_SHORTCUTS,
  normalizeShortcutSettings,
  type ShortcutActionKey,
  type ShortcutSettings,
} from '@shared/shortcuts';
import { usePrefs, type ThemeMode, type Lang } from '../hooks/usePrefs';
import { PageHeader } from '../components/PageHeader';
import { eventToShortcutBinding, formatShortcut } from '../utils/shortcuts';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, lang, setTheme, setLang } = usePrefs();
  const defaultPreset = getLLMProviderPreset('deepseek');
  const [llm, setLlm] = useState<AppSettings['llm']>({
    provider: defaultPreset.provider,
    baseUrl: defaultPreset.baseUrl,
    model: defaultPreset.model,
    apiKey: '',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [savingModel, setSavingModel] = useState(false);
  const [savingShortcuts, setSavingShortcuts] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);
  const [shortcuts, setShortcuts] = useState<ShortcutSettings>(DEFAULT_SHORTCUTS);
  const [savedShortcuts, setSavedShortcuts] = useState(false);
  const [recordingAction, setRecordingAction] = useState<ShortcutActionKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.api
      .getSettings()
      .then((settings: unknown) => {
        const nextSettings = settings as Partial<AppSettings>;
        if (cancelled) return;
        if (nextSettings.llm) {
          setLlm((current) => ({ ...current, ...nextSettings.llm }));
        }
        setShortcuts(normalizeShortcutSettings(nextSettings.shortcuts));
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingModel(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const preset = useMemo(() => getLLMProviderPreset(llm.provider), [llm.provider]);
  const shortcutItems = useMemo(
    () =>
      ([
        {
          key: 'practiceSubmit',
          title: t('settings.shortcuts.actions.practiceSubmit.title'),
          description: t('settings.shortcuts.actions.practiceSubmit.description'),
        },
        {
          key: 'practiceNext',
          title: t('settings.shortcuts.actions.practiceNext.title'),
          description: t('settings.shortcuts.actions.practiceNext.description'),
        },
        {
          key: 'practicePrev',
          title: t('settings.shortcuts.actions.practicePrev.title'),
          description: t('settings.shortcuts.actions.practicePrev.description'),
        },
        {
          key: 'practiceOptionPrev',
          title: t('settings.shortcuts.actions.practiceOptionPrev.title'),
          description: t('settings.shortcuts.actions.practiceOptionPrev.description'),
        },
        {
          key: 'practiceOptionNext',
          title: t('settings.shortcuts.actions.practiceOptionNext.title'),
          description: t('settings.shortcuts.actions.practiceOptionNext.description'),
        },
      ]) satisfies Array<{
        key: ShortcutActionKey;
        title: string;
        description: string;
      }>,
    [t],
  );

  useEffect(() => {
    if (!recordingAction) return;
    const action = recordingAction;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setRecordingAction(null);
        return;
      }
      const binding = eventToShortcutBinding(event);
      if (!binding) return;
      event.preventDefault();
      setShortcuts((current) => ({ ...current, [action]: binding }));
      setRecordingAction(null);
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recordingAction]);

  function setProvider(provider: LLMProviderType) {
    const nextPreset = LLM_PROVIDER_PRESETS[provider];
    setLlm((current) => ({
      ...current,
      provider,
      baseUrl: nextPreset.baseUrl,
      model: nextPreset.model,
      apiKey: nextPreset.needKey ? current.apiKey : undefined,
    }));
  }

  async function persistSettings(next: Partial<AppSettings>) {
    await window.api.updateSettings({
      llm: next.llm ?? llm,
      shortcuts: normalizeShortcutSettings(next.shortcuts ?? shortcuts),
    });
    window.dispatchEvent(new CustomEvent('openstudy:settings-updated'));
  }

  async function onSaveModel() {
    setError(null);
    setSavingModel(true);
    try {
      await persistSettings({ llm });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingModel(false);
    }
  }

  async function onSaveShortcuts() {
    setError(null);
    setSavingShortcuts(true);
    try {
      await persistSettings({ shortcuts });
      setSavedShortcuts(true);
      window.setTimeout(() => setSavedShortcuts(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingShortcuts(false);
    }
  }

  async function onTestModel() {
    const api = window.api as typeof window.api & {
      testModel?: typeof window.api.testModel;
    };
    setError(null);
    setTestResult(null);
    if (typeof api.testModel !== 'function') {
      setError(
        i18n.language.startsWith('en')
          ? 'The current app build has not loaded the model test interface yet. Please restart the app and try again.'
          : '当前运行中的应用版本还未加载模型测试接口，请重启应用后再试。',
      );
      return;
    }
    setTestingModel(true);
    try {
      const result = await api.testModel({ llm });
      setTestResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTestingModel(false);
    }
  }

  return (
    <div className="page settings-page">
      <PageHeader title={t('settings.title')} />

      {error && (
        <div className="card error" role="alert">
          <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {error}
        </div>
      )}

      <div className="settings-grid">
        <div className="card panel-card">
          <div className="panel-card-header">
            <div className="panel-title-row">
              <div className="panel-icon-wrap">
                <Sun size={18} />
              </div>
              <div className="panel-card-copy">
                <h2>{t('settings.theme.title')}</h2>
                <p>{t('settings.theme.subtitle')}</p>
              </div>
            </div>
          </div>
          <div
            className="segmented-control settings-options settings-theme-options"
            role="group"
            aria-label={t('settings.theme.title')}
          >
            {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
              <button
                key={m}
                className="segmented-option"
                onClick={() => setTheme(m)}
                aria-pressed={theme === m}
                title={t(`settings.theme.${m}`)}
              >
                {m === 'system' && <Monitor size={16} />}
                {m === 'light' && <Sun size={16} />}
                {m === 'dark' && <Moon size={16} />}
                <span className="segmented-option-copy">
                  <span className="segmented-option-title">{t(`settings.theme.${m}`)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card panel-card">
          <div className="panel-card-header">
            <div className="panel-title-row">
              <div className="panel-icon-wrap">
                <Languages size={18} />
              </div>
              <div className="panel-card-copy">
                <h2>{t('settings.language.title')}</h2>
                <p>{t('settings.language.subtitle')}</p>
              </div>
            </div>
          </div>
          <div className="form-field settings-language-field">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              aria-label={t('settings.language.title')}
            >
              {(['zh', 'en'] as Lang[]).map((l) => (
                <option key={l} value={l}>
                  {t(`settings.language.${l}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card panel-card settings-shortcuts-card">
          <div className="panel-card-header">
            <div className="panel-title-row">
              <div className="panel-icon-wrap">
                <Keyboard size={18} />
              </div>
              <div className="panel-card-copy">
                <h2>{t('settings.shortcuts.title')}</h2>
                <p>{t('settings.shortcuts.subtitle')}</p>
              </div>
            </div>
            <div className="panel-toolbar">
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setShortcuts(DEFAULT_SHORTCUTS);
                  setRecordingAction(null);
                }}
                disabled={savingShortcuts}
              >
                {t('settings.shortcuts.reset')}
              </button>
              <button
                className="primary icon-only"
                type="button"
                onClick={onSaveShortcuts}
                disabled={savingShortcuts || loadingModel}
                aria-label={
                  savingShortcuts ? t('common.saving') : t('settings.shortcuts.save')
                }
                title={savingShortcuts ? t('common.saving') : t('settings.shortcuts.save')}
              >
                {savingShortcuts ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              </button>
              {savedShortcuts && (
                <span className="panel-status" role="status">
                  <Check size={14} />
                  {t('settings.shortcuts.saved')}
                </span>
              )}
            </div>
          </div>

          <div className="settings-shortcut-list">
            {shortcutItems.map((item) => {
              const isRecording = recordingAction === item.key;
              return (
                <div key={item.key} className="settings-shortcut-row">
                  <div className="settings-shortcut-copy">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <button
                    type="button"
                    className={`settings-shortcut-value${isRecording ? ' is-recording' : ''}`}
                    onClick={() =>
                      setRecordingAction((current) => (current === item.key ? null : item.key))
                    }
                    aria-pressed={isRecording}
                  >
                    {isRecording
                      ? t('settings.shortcuts.recording')
                      : formatShortcut(shortcuts[item.key])}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="panel-note">
            {t('settings.shortcuts.hint', {
              cancel: 'Esc',
            })}
          </div>
        </div>

        <div className="card panel-card settings-model-card">
          <div className="panel-card-header">
            <div className="panel-title-row">
              <div className="panel-icon-wrap">
                <Brain size={18} />
              </div>
              <div className="panel-card-copy">
                <h2>{t('models.llm.title')}</h2>
                <p>{t('models.subtitle')}</p>
              </div>
            </div>
            <div className="panel-toolbar">
              <button
                className="icon-only"
                onClick={onTestModel}
                disabled={testingModel || loadingModel}
                aria-label={testingModel ? t('settings.model.testing') : t('settings.model.test')}
                title={testingModel ? t('settings.model.testing') : t('settings.model.test')}
              >
                {testingModel ? <Loader2 size={16} className="spin" /> : <FlaskConical size={16} />}
              </button>
              <button
                className="primary icon-only"
                onClick={onSaveModel}
                disabled={savingModel || loadingModel}
                aria-label={savingModel ? t('common.saving') : t('models.llm.save')}
                title={savingModel ? t('common.saving') : t('models.llm.save')}
              >
                {savingModel ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              </button>
              {saved && (
                <span className="panel-status" role="status">
                  <Check size={14} />
                  {t('models.llm.saved')}
                </span>
              )}
            </div>
          </div>

          {loadingModel ? (
            <div className="settings-model-loading">
              <Loader2 size={16} className="spin" />
              <span>{t('models.loading')}</span>
            </div>
          ) : (
            <div className="settings-model-layout">
              <div className="form-stack">
                <div className="form-field">
                  <label>{t('models.llm.provider')}</label>
                  <select
                    value={llm.provider}
                    onChange={(e) => setProvider(e.target.value as LLMProviderType)}
                  >
                    {LLM_PROVIDER_ORDER.map((provider) => (
                      <option key={provider} value={provider}>
                        {t(`models.llm.presets.${provider}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>{t('models.llm.baseUrl')}</label>
                  <input
                    value={llm.baseUrl ?? ''}
                    onChange={(e) =>
                      setLlm((current) => ({ ...current, baseUrl: e.target.value }))
                    }
                    placeholder={preset.baseUrl}
                  />
                </div>

                <div className="form-field">
                  <label>{t('models.llm.modelName')}</label>
                  <input
                    value={llm.model}
                    onChange={(e) =>
                      setLlm((current) => ({ ...current, model: e.target.value }))
                    }
                    placeholder={preset.model}
                  />
                </div>

                {preset.needKey && (
                  <div className="form-field">
                    <label>{t('models.llm.apiKey')}</label>
                    <div className="row gap-sm" style={{ position: 'relative' }}>
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llm.apiKey ?? ''}
                        onChange={(e) =>
                          setLlm((current) => ({ ...current, apiKey: e.target.value }))
                        }
                        placeholder="sk-..."
                        style={{ flex: 1, paddingRight: 40 }}
                      />
                      <button
                        className="icon-only ghost"
                        onClick={() => setShowApiKey((value) => !value)}
                        aria-label={showApiKey ? t('models.llm.hideKey') : t('models.llm.showKey')}
                        title={showApiKey ? t('models.llm.hideKey') : t('models.llm.showKey')}
                        style={{ position: 'absolute', right: 4, top: 4 }}
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="panel-note">{t('models.llm.apiKeyHint')}</div>
                  </div>
                )}
              </div>

              <div className="form-stack">
                <div className="panel-title-row settings-model-summary-title">
                  <div className="panel-icon-wrap">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div className="panel-card-copy">
                    <h2>{t('settings.modelSummary.title')}</h2>
                    <p>{t(`models.llm.presets.${llm.provider}`)}</p>
                  </div>
                </div>

                <div className="panel-kv-list">
                  <div className="panel-kv-row">
                    <span>{t('models.llm.provider')}</span>
                    <strong>{t(`models.llm.presets.${llm.provider}`)}</strong>
                  </div>
                  <div className="panel-kv-row">
                    <span>{t('models.llm.modelName')}</span>
                    <strong>{llm.model || '—'}</strong>
                  </div>
                  <div className="panel-kv-row">
                    <span>{t('models.llm.baseUrl')}</span>
                    <strong className="mono">{llm.baseUrl || '—'}</strong>
                  </div>
                </div>

                {testResult && (
                  <div className="settings-model-feedback success">
                    <strong>{t('settings.model.testPassed')}</strong>
                    <span>
                      {t('settings.model.testResult', {
                        latency: testResult.latencyMs,
                        model: testResult.model,
                      })}
                    </span>
                  </div>
                )}

                <div className="model-provider-grid" aria-label={t('models.llm.provider')}>
                  {LLM_PROVIDER_ORDER.map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      className={`model-provider-chip${provider === llm.provider ? ' active' : ''}`}
                      onClick={() => setProvider(provider)}
                      aria-pressed={provider === llm.provider}
                      title={t(`models.llm.presets.${provider}`)}
                    >
                      {t(`models.llm.presets.${provider}`)}
                    </button>
                  ))}
                </div>

                <div className="panel-note">{t('models.subtitle')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
