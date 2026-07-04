import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastProvider';

export default function CreateDocument() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [md, setMd] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await window.api.createDocumentFromMarkdown(name.trim(), md, desc.trim() || undefined);
      toast.show('success', t('library.toast.imported', { title: name.trim() }));
      navigate('/library');
    } catch (e) {
      toast.show('error', (e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={t('library.create.title')}
        back={{ label: t('common.back'), onClick: () => navigate('/library') }}
      />

      <div className="card">
        <label className="modal-label">{t('library.create.nameLabel')}</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('library.create.namePlaceholder')}
          autoFocus
        />
        <label className="modal-label">{t('library.create.descLabel')}</label>
        <input
          className="input"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t('library.create.descPlaceholder')}
        />
        <label className="modal-label">{t('library.create.markdownLabel')}</label>
        <textarea
          className="input"
          value={md}
          onChange={(e) => setMd(e.target.value)}
          placeholder={t('library.create.markdownPlaceholder')}
          rows={12}
        />
        <div className="modal-actions">
          <button className="ghost" onClick={() => navigate('/library')}>{t('common.cancel')}</button>
          <button className="primary" disabled={creating || !name.trim()} onClick={handleCreate}>
            {creating ? t('library.create.creating') : t('library.create.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
