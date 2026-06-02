import { useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';

export default function TheorySection({ items, onBack }) {
  const [expandedId, setExpandedId] = useState(items[0]?.id ?? null);

  const toggle = (id) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent py-12">
      <AmbientBackdrop variant="minimal" />
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
        <header className="rounded-[2.5rem] border border-slate-200/60 bg-gradient-to-br from-white via-slate-50 to-blue-50 p-10 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
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
            <h2 className="text-3xl font-display font-semibold text-slate-900">Теория и шпаргалки</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              Каждая карточка раскрывает тему из программы Тимура Шафеева. Нажмите, чтобы получить подробные пояснения и примеры.
            </p>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {items.map((item) => {
            const isOpen = expandedId === item.id;
            return (
              <article
                key={item.id}
                className={`group relative overflow-hidden rounded-3xl border bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-xl ${
                  isOpen ? 'border-brand/60' : 'border-slate-200'
                }`}
              >
                <button onClick={() => toggle(item.id)} className="w-full px-6 py-6 text-left">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-dark">
                        {item.id.toUpperCase()}
                      </span>
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.summary}</p>
                      </div>
                    </div>
                    <span
                      className={`mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border text-brand transition ${
                        isOpen ? 'rotate-45 border-brand bg-brand/10' : 'border-slate-200'
                      }`}
                    >
                      <span className="text-lg">+</span>
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-6 pb-6 text-sm leading-relaxed text-slate-700">
                    {item.content}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
