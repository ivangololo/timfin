export default function ProgressCard({
  title,
  value,
  total,
  reviewCount = 0,
  onClick,
  active = false,
  unitLabel = 'карточек',
  valueLabel = 'освоено',
  reviewLabel = 'На повторении',
  emptyReviewLabel = 'Повторение не требуется',
}) {
  const percentage = total === 0 ? 0 : Math.round((value / total) * 100);

  const baseClasses = [
    'progress-card group relative rounded-3xl border transition-all duration-500 backdrop-blur min-h-[180px] p-5',
    'bg-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.12)]',
  ];

  if (active) {
    baseClasses.push('border-brand/60 shadow-[0_26px_70px_rgba(2,132,199,0.22)]');
  } else {
    baseClasses.push('border-white/60 hover:-translate-y-1 hover:border-brand/30 hover:shadow-[0_24px_70px_rgba(15,23,42,0.16)]');
  }

  if (onClick) {
    baseClasses.push('cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40');
  }

  const content = (
    <div className="relative z-10 flex h-full flex-col justify-between gap-4 text-left">
      <header className="flex items-start gap-2 text-xs sm:text-sm">
        <div className="flex-1 space-y-1 text-left">
          <h3 className="text-base font-semibold leading-tight text-slate-900">{title}</h3>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            {total} {unitLabel}
          </span>
        </div>
        <span
          className={`ml-auto inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold transition ${
            active ? 'bg-brand text-white shadow shadow-brand/30' : 'bg-brand/10 text-brand-dark'
          }`}
        >
          {percentage}%
        </span>
      </header>

        <div className="space-y-3 text-left">
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-slate-900 sm:text-3xl">{value}</span>
            <span className="text-xs text-slate-500 sm:text-sm">
              из {total} {valueLabel}
            </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-700 ${
              percentage === 0 ? 'opacity-30' : 'opacity-100'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-left text-xs text-slate-500">
        <span className="font-semibold uppercase tracking-[0.22em] text-slate-400">
          Прогресс
        </span>
        {reviewCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {reviewLabel}: {reviewCount}
          </span>
        ) : (
          <span className="text-xs text-emerald-600">{emptyReviewLabel}</span>
        )}
      </footer>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" className={baseClasses.join(' ')} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={baseClasses.join(' ')}>{content}</div>;
}
