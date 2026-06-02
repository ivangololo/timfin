import { useEffect, useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';

const DIFFICULTY_CONFIG = {
  easy: {
    label: 'Лёгкая',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  medium: {
    label: 'Средняя',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  hard: {
    label: 'Сложная',
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

const normalizeDifficulty = (value) => {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'medium';
};

const formatPoints = (points) => {
  if (points == null) return null;
  return `${points} ${points === 1 ? 'балл' : points < 5 ? 'балла' : 'баллов'}`;
};

export default function PracticeSection({ items, onBack }) {
  const [openId, setOpenId] = useState(items[0]?.id ?? null);
  const [revealed, setRevealed] = useState({});

  useEffect(() => {
    setRevealed((prev) => {
      if (!items.length) return {};
      const next = { ...prev };
      let changed = false;
      for (const item of items) {
        if (!(item.id in next)) {
          next[item.id] = false;
          changed = true;
        }
      }
      for (const key of Object.keys(next)) {
        if (!items.find((item) => item.id === key)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setOpenId((current) => {
      if (current && items.some((item) => item.id === current)) {
        return current;
      }
      return items[0]?.id ?? null;
    });
  }, [items]);

  const toggleCase = (id) => {
    setOpenId((current) => (current === id ? null : id));
  };

  const toggleSolution = (id) => {
    setRevealed((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent py-12">
      <AmbientBackdrop />
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
        <header className="rounded-[2.6rem] border border-white/60 bg-white/80 p-10 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M12.707 15.707a1 1 0 01-1.414 0L6.586 11l4.707-4.707a1 1 0 10-1.414-1.414l-5.414 5.414a1 1 0 000 1.414l5.414 5.414a1 1 0 001.414 0z" />
            </svg>
            Назад в кабинет
          </button>
          <div className="mt-6 space-y-3">
            <h2 className="text-3xl font-display font-semibold text-slate-900">Практика и кейсы</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              Разберите прикладные задачи, применяйте теорию на практике и сверяйтесь с подробными решениями.
            </p>
          </div>
        </header>

        <div className="space-y-6">
          {items.map((item) => {
            const isOpen = openId === item.id;
            const showSolution = revealed[item.id];
            const difficultyMeta = DIFFICULTY_CONFIG[normalizeDifficulty(item.difficulty ?? 'medium')];
            return (
              <article
                key={item.id}
                className={`group overflow-hidden rounded-3xl border bg-gradient-to-br from-white/90 via-white/70 to-brand/10 shadow-[0_24px_70px_rgba(15,23,42,0.14)] transition hover:-translate-y-1 hover:shadow-[0_32px_85px_rgba(37,99,235,0.2)] ${
                  isOpen ? 'border-brand/60' : 'border-white/60'
                }`}
              >
                <button
                  onClick={() => toggleCase(item.id)}
                  className="flex w-full items-start justify-between gap-4 px-6 py-6 text-left"
                >
                    <div className="space-y-3">
                      <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-dark">
                        {item.id.toUpperCase()}
                      </span>
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                        {item.prompt && (
                          <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-3">{item.prompt}</p>
                        )}
                      </div>
                    </div>
                  <div className="flex items-center gap-3">
                    {formatPoints(item.points) && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                        {formatPoints(item.points)}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${difficultyMeta.badge}`}>
                      {difficultyMeta.label}
                    </span>
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-brand transition ${
                        isOpen ? 'rotate-45 border-brand bg-brand/10' : 'border-slate-200'
                      }`}
                    >
                      <span className="text-lg">+</span>
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="space-y-6 border-t border-slate-100 px-6 pb-6 text-sm leading-relaxed text-slate-700">
                    {item.image_url && (
                      <div className="overflow-hidden rounded-2xl border border-slate-100">
                        <img src={item.image_url} alt={item.title} className="w-full max-h-72 object-cover" />
                      </div>
                    )}
                    <section className="space-y-2">
                      <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Условие</h4>
                      <p className="whitespace-pre-wrap">{item.prompt}</p>
                    </section>
                  <section className="space-y-3">
                    <button
                        type="button"
                        onClick={() => toggleSolution(item.id)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-brand-dark"
                      >
                        {showSolution ? 'Скрыть разбор' : 'Показать решение'}
                        <svg className={`h-4 w-4 transition-transform ${showSolution ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.585l3.71-3.354a.75.75 0 011.02 1.1l-4.23 3.824a.75.75 0 01-1.02 0L5.21 8.29a.75.75 0 01.02-1.06z" />
                        </svg>
                      </button>
                      {showSolution && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
                          <h5 className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-600">Подробное решение</h5>
                          <p className="whitespace-pre-wrap">{item.solution}</p>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </article>
            );
          })}

          {items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/60 bg-white/85 px-6 py-12 text-center text-sm text-slate-500 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
              Практические задания пока не добавлены. Загляните позже — раздел скоро обновится.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
