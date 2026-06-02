import { useEffect, useMemo, useRef, useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';

const TABS = [
  { id: 'presentations', label: 'Презентации' },
  { id: 'cheats', label: 'Шпоры' },
];

const isPdfResource = (item) => {
  if (!item) return false;
  if (item.type === 'pdf') return true;
  const url = (item.url ?? '').toLowerCase();
  return url.endsWith('.pdf');
};

const isImageResource = (item) => {
  if (!item) return false;
  if (item.type === 'image') return true;
  const url = item.url ?? '';
  return item.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(url);
};

export default function KnowledgeBase({
  items = [],
  personalItems = [],
  loadingPersonal,
  activeTab,
  onSelectTab,
  onBack,
  onAddPersonal,
  onRemovePersonal,
  onUploadAsset,
  user,
}) {
  const [currentTab, setCurrentTab] = useState(activeTab ?? 'presentations');
  const [detail, setDetail] = useState(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formState, setFormState] = useState({ title: '', description: '', files: [] });
  const scrollPositions = useRef({});
  const canManage = Boolean(user?.isAdmin);

  useEffect(() => {
    if (activeTab && activeTab !== currentTab) {
      scrollPositions.current[currentTab] = window.scrollY;
      if (scrollPositions.current[activeTab] === undefined) {
        scrollPositions.current[activeTab] = window.scrollY;
      }
      setCurrentTab(activeTab);
    }
  }, [activeTab, currentTab]);

  useEffect(() => {
    const saved = scrollPositions.current[currentTab];
    if (typeof saved === 'number') {
      window.scrollTo({ top: saved, behavior: 'auto' });
    }
  }, [currentTab]);

  useEffect(() => {
    if (!detail) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [detail]);

  const baseItems = items && items.length ? items : personalItems;
  const presentations = useMemo(() => baseItems.filter((item) => isPdfResource(item)), [baseItems]);
  const cheatsheets = useMemo(() => baseItems.filter((item) => isImageResource(item)), [baseItems]);
  const archivedItems = useMemo(
    () => baseItems.filter((item) => !isPdfResource(item) && !isImageResource(item)),
    [baseItems],
  );
  const visibleItems = currentTab === 'cheats' ? cheatsheets : presentations;

  const handleSelectTab = (tabId) => {
    scrollPositions.current[currentTab] = window.scrollY;
    if (scrollPositions.current[tabId] === undefined) {
      scrollPositions.current[tabId] = window.scrollY;
    }
    setCurrentTab(tabId);
    onSelectTab?.(tabId);
  };

  const handleFileChange = (event) => {
    const incoming = Array.from(event.target.files ?? []);
    if (!incoming.length) return;
    setFormState((prev) => ({
      ...prev,
      files: [...(prev.files ?? []), ...incoming],
    }));
    setFormError('');
    setFormSuccess('');
    event.target.value = '';
  };

  const handleInputChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
    setFormError('');
    setFormSuccess('');
  };

  const handleAddMaterial = async (event) => {
    event.preventDefault();
    if (!canManage) {
      setFormError('Добавление доступно наставнику/куратору.');
      return;
    }
    if (!onAddPersonal || !onUploadAsset) {
      setFormError('Загрузка сейчас недоступна.');
      return;
    }
    const files = Array.isArray(formState.files) ? formState.files : [];
    if (!files.length) {
      setFormError('Прикрепите файл(ы) (PDF или изображение).');
      return;
    }
    setUploading(true);
    setFormError('');
    setFormSuccess('');
    try {
      const stripExtension = (name = '') => name.replace(/\.[^./\\]+$/, '');
      const detectType = (file) => {
        const name = String(file?.name ?? '').toLowerCase();
        const mime = String(file?.type ?? '').toLowerCase();
        if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
        return 'image';
      };

      const createdTypes = new Set();
      const prefix = formState.title.trim();

      for (const file of files) {
        const type = detectType(file);
        const uploadResult = await onUploadAsset(file);
        if (!uploadResult?.url) {
          throw new Error('Не удалось получить ссылку на файл.');
        }
        const baseTitle = stripExtension(file.name);
        const title = files.length > 1 && prefix ? `${prefix} — ${baseTitle}` : prefix || baseTitle;
        await onAddPersonal({
          title,
          description: formState.description.trim(),
          type,
          url: uploadResult.url,
          content: '',
          difficulty: 'medium',
          tags: [],
        });
        createdTypes.add(type);
      }

      setFormSuccess(files.length === 1 ? 'Материал добавлен в раздел.' : `Добавлено материалов: ${files.length}.`);
      setFormState({ title: '', description: '', files: [] });
      if (createdTypes.size === 1) {
        const [onlyType] = Array.from(createdTypes);
        handleSelectTab(onlyType === 'pdf' ? 'presentations' : 'cheats');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось сохранить материал.');
    } finally {
      setUploading(false);
    }
  };

  const renderPreview = (item) => {
    if (isPdfResource(item) && item.url) {
      return (
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
          <iframe
            title={item.title}
            src={`${item.url}#toolbar=0&navpanes=0`}
            className="h-56 w-full border-0"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/80 to-transparent" />
          <p className="pointer-events-none absolute left-4 bottom-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            Прокрутите слайды
          </p>
        </div>
      );
    }

    if (isImageResource(item) && item.url) {
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
          <img
            src={item.url}
            alt={item.title}
            className="h-56 w-full object-cover transition duration-300 ease-out hover:scale-[1.01]"
            loading="lazy"
          />
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">
        Предпросмотр появится после загрузки файла.
      </div>
    );
  };

  const openDetail = (item) => setDetail(item);
  const closeDetail = () => setDetail(null);

  const emptyMessage =
    currentTab === 'cheats'
      ? 'Шпоры пока не добавлены. Наставник загрузит подсказки позже.'
      : 'Презентации пока не добавлены. Наставник добавит материалы и они появятся здесь.';

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent py-12">
      <AmbientBackdrop />
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6">
        <header className="rounded-[2.5rem] border border-slate-200/60 bg-gradient-to-br from-white via-slate-50 to-blue-50 p-10 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
            type="button"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M12.707 15.707a1 1 0 01-1.414 0L6.586 11l4.707-4.707a1 1 0 10-1.414-1.414l-5.414 5.414a1 1 0 000 1.414l5.414 5.414a1 1 0 001.414 0z" />
            </svg>
            Назад в кабинет
          </button>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <h2 className="text-3xl font-display font-semibold text-slate-900">Теория</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                Презентации и шпаргалки, загруженные наставником. Ученик ничего не добавляет самостоятельно — всё готово к просмотру.
              </p>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/80 px-5 py-3 text-sm text-slate-600 shadow-inner">
              Презентации: {presentations.length} · Шпоры: {cheatsheets.length}
            </div>
          </div>

          <div className="mt-6 inline-flex rounded-full border border-white/70 bg-white/80 p-1 shadow-inner">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  currentTab === tab.id
                    ? 'bg-brand text-white shadow-lg shadow-brand/25'
                    : 'text-slate-600 hover:bg-brand/10'
                }`}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Переключение вкладок не сбрасывает позицию списка — можно спокойно возвращаться к нужному месту.
          </p>
        </header>

        <section className="space-y-4">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            {loadingPersonal ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                Загружаем материалы наставника…
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                {emptyMessage}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {visibleItems.map((item) => (
                  <article
                    key={item.id}
                    className="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-[0_18px_38px_rgba(37,99,235,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                          {isPdfResource(item) ? 'Презентация' : 'Шпора'}
                        </span>
                        <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                        {item.description && <p className="text-sm text-slate-600">{item.description}</p>}
                      </div>
                      {item.url && (
                        <button
                          type="button"
                          onClick={() => openDetail(item)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                        >
                          Развернуть
                        </button>
                      )}
                    </div>
                    {renderPreview(item)}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark"
                        >
                          Открыть/Скачать
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">Файл не прикреплён.</span>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await onRemovePersonal?.(item.id);
                            } catch (error) {
                              console.warn('Не удалось удалить материал', error);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {archivedItems.length > 0 && (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Старые материалы другого формата скрыты из основного списка ({archivedItems.length}).
            </div>
          )}

          {canManage && (
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Добавить материал вручную</p>
                  <p className="text-xs text-slate-500">
                    Опция скрыта по умолчанию. Используйте при необходимости загрузить файл в раздел.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadPanel((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                >
                  {showUploadPanel ? 'Свернуть' : 'Открыть панель'}
                </button>
              </div>

              {showUploadPanel && (
                <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleAddMaterial}>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Файл (PDF или изображение)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleFileChange}
                      multiple
                      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand hover:file:bg-brand/10"
                    />
                    {formState.files?.length > 1 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                        <p className="font-semibold">Выбрано файлов: {formState.files.length}</p>
                        <ul className="mt-2 space-y-1">
                          {formState.files.map((file, index) => (
                            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                              <span className="truncate">{file.name}</span>
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                                onClick={() =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    files: (prev.files ?? []).filter((_, idx) => idx !== index),
                                  }))
                                }
                              >
                                убрать
                              </button>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Каждый файл будет добавлен как отдельный материал (с названием из имени файла).
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Название
                    </label>
                    <input
                      type="text"
                      value={formState.title}
                      onChange={(event) => handleInputChange('title', event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Описание (необязательно)
                    </label>
                    <textarea
                      value={formState.description}
                      onChange={(event) => handleInputChange('description', event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                      rows={3}
                    />
                  </div>

                  {formError && (
                    <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">
                      {formError}
                    </div>
                  )}
                  {formSuccess && (
                    <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                      {formSuccess}
                    </div>
                  )}

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {uploading ? 'Сохраняем…' : 'Добавить материал'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={closeDetail}
            role="presentation"
          />
          <div
            className="relative z-10 flex w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-white shadow-[0_45px_120px_rgba(15,23,42,0.45)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={detail.title}
          >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-white/80 px-8 py-6 backdrop-blur">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                  {isPdfResource(detail) ? 'Презентация' : 'Шпора'}
                </span>
                <h3 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{detail.title}</h3>
                {detail.description && (
                  <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{detail.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
              >
                Закрыть
              </button>
            </header>
            <div className="custom-scrollbar relative max-h-[70vh] space-y-6 overflow-y-auto px-8 py-6">
              {isPdfResource(detail) && detail.url ? (
                <iframe
                  title={detail.title}
                  src={`${detail.url}#toolbar=0&navpanes=0`}
                  className="h-[65vh] w-full rounded-3xl border border-slate-200 shadow-inner"
                />
              ) : null}
              {isImageResource(detail) && detail.url ? (
                <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-inner">
                  <img src={detail.url} alt={detail.title} className="w-full object-contain" />
                </div>
              ) : null}
              {!detail.url && (
                <p className="text-sm text-slate-600">
                  Файл отсутствует. Свяжитесь с наставником, чтобы обновить материал.
                </p>
              )}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-8 py-5 text-xs text-slate-500">
              <span>Материал добавлен наставником.</span>
              <div className="flex flex-wrap items-center gap-2">
                {detail.url && (
                  <a
                    href={detail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                  >
                    Открыть/Скачать
                  </a>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onRemovePersonal?.(detail.id);
                      } catch (error) {
                        console.warn('Не удалось удалить материал', error);
                      } finally {
                        closeDetail();
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                  >
                    Удалить материал
                  </button>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
