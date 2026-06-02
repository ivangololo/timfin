import { useMemo, useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';

const STATUS_LABELS = {
  open: 'Открытая запись',
  waitlist: 'Лист ожидания',
  closed: 'Закрыто',
};

const STATUS_STYLES = {
  open: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  waitlist: 'bg-amber-100 text-amber-700 border-amber-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200',
};

const FILTER_OPTIONS = [
  { id: 'all', label: 'Все' },
  { id: 'open', label: 'Открыта запись' },
  { id: 'waitlist', label: 'Лист ожидания' },
  { id: 'closed', label: 'Закрыто' },
];

export default function ScheduleTable({ items, selected = {}, onToggleParticipation, onBack }) {
  const [filter, setFilter] = useState('all');

  const selectedMap = useMemo(() => {
    const map = {};
    if (selected && typeof selected === 'object') {
      Object.entries(selected).forEach(([key, value]) => {
        if (value) {
          map[String(key)] = true;
        }
      });
    }
    return map;
  }, [selected]);

  const filtered = useMemo(() => {
    const source = filter === 'all' ? items : items.filter((item) => (item.status_effective ?? item.status) === filter);
    const toSortTimestamp = (value) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const date = new Date(value);
      const timestamp = date.getTime();
      return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
    };
    return source
      .map((item) => ({
        ...item,
        sortTimestamp: toSortTimestamp(
          item.order_date ?? item.date ?? item.date_range_start ?? item.registration_start ?? item.registration_end,
        ),
      }))
      .sort((a, b) => a.sortTimestamp - b.sortTimestamp);
  }, [items, filter]);

  const selectedItems = useMemo(() => items.filter((item) => selectedMap[String(item.id)]), [items, selectedMap]);

  const handleToggle = (id) => {
    if (!onToggleParticipation) return;
    onToggleParticipation(id);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent py-12">
      <AmbientBackdrop variant="minimal" />
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
        <header className="rounded-[2.6rem] border border-white/60 bg-white/80 p-10 shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M12.707 15.707a1 1 0 01-1.414 0L6.586 11l4.707-4.707a1 1 0 10-1.414-1.414l-5.414 5.414a1 1 0 000 1.414l5.414 5.414a1 1 0 001.414 0z" />
            </svg>
            Назад в кабинет
          </button>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <h2 className="text-3xl font-display font-semibold text-slate-900">Расписание олимпиад</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                Отмечайте олимпиады, в которых планируете участвовать: они выделяются в таблице и собираются в отдельный список.
              </p>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/80 px-5 py-3 text-sm text-slate-600 shadow-inner">
              {filtered.length} из {items.length} мероприятий
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setFilter(option.id)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition border ${
                  filter === option.id
                    ? 'border-transparent bg-brand text-white shadow-lg shadow-brand/25'
                    : 'border-slate-200 bg-white/80 text-slate-600 hover:border-brand/60 hover:text-brand'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        {selectedItems.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-500">Вы участвуете</h3>
            <div className="flex flex-wrap gap-3">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-2 text-sm text-brand-dark shadow-[0_12px_32px_rgba(2,132,199,0.12)]"
                >
                  {item.logo_url && (
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-brand/20 bg-white">
                      <img
                        src={item.logo_url}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-brand">{item.date_display || item.date || 'Дата не указана'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(item.id)}
                    className="ml-2 inline-flex items-center justify-center rounded-full border border-brand/40 bg-white/70 p-2 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white"
                    aria-label="Убрать из участия"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.225 4.811a1 1 0 00-1.414 1.414L8.586 10l-3.775 3.775a1 1 0 001.414 1.414L10 11.414l3.775 3.775a1 1 0 001.414-1.414L11.414 10l3.775-3.775a1 1 0 00-1.414-1.414L10 8.586 6.225 4.811z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="custom-scrollbar overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold text-center">Участие</th>
                  <th className="px-6 py-4 font-semibold">Название</th>
                  <th className="px-6 py-4 font-semibold">Статус</th>
                  <th className="px-6 py-4 font-semibold">Дата</th>
                  <th className="px-6 py-4 font-semibold">Начало</th>
                  <th className="px-6 py-4 font-semibold">Окончание</th>
                  <th className="px-6 py-4 font-semibold">Формат</th>
                  <th className="px-6 py-4 font-semibold">Уровень</th>
                  <th className="px-6 py-4 font-semibold">Регистрация</th>
                  <th className="px-6 py-4 font-semibold">Ссылка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filtered.map((item) => {
                  const isSelected = Boolean(selectedMap[String(item.id)]);
                  return (
                    <tr
                      key={item.id}
                      className={`transition ${
                        isSelected ? 'bg-brand/5 hover:bg-brand/10' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(item.id)}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
                            isSelected
                              ? 'border-brand bg-brand text-white shadow-lg shadow-brand/30'
                              : 'border-slate-200 bg-white/80 text-slate-500 hover:border-brand/50 hover:text-brand'
                          }`}
                          aria-pressed={isSelected}
                          aria-label={isSelected ? 'Убрать из участия' : 'Отметить участие'}
                        >
                          {isSelected ? (
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {item.logo_url && (
                            <img
                              src={item.logo_url}
                              alt=""
                              className="h-10 w-10 rounded-xl border border-slate-200 object-cover"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{item.title}</p>
                            {isSelected && <p className="text-xs text-brand">Участвуешь</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                            STATUS_STYLES[item.status_effective ?? item.status]
                          }`}
                        >
                          {STATUS_LABELS[item.status_effective ?? item.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4">{item.date_display || item.date || '—'}</td>
                      <td className="px-6 py-4">{item.start || '—'}</td>
                      <td className="px-6 py-4">{item.end || '—'}</td>
                      <td className="px-6 py-4 text-slate-600">{item.format ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-600">{item.level ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {item.registration_start || item.registration_end
                          ? `${item.registration_start ?? '—'} → ${item.registration_end ?? '—'}`
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {item.registration_url ? (
                          <a
                            href={item.registration_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-brand/30 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10"
                          >
                            Перейти
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M12.293 3.293a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L13 6.414V13a1 1 0 11-2 0V6.414L8.707 7.707A1 1 0 017.293 6.293l3-3z" />
                              <path d="M5 9a1 1 0 011 1v5h8v-5a1 1 0 112 0v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6a1 1 0 011-1z" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-slate-500">
                      Подходящих олимпиад не найдено. Попробуйте другой фильтр.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
