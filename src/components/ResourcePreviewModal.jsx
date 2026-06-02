import { useEffect, useState } from 'react';

const DIFFICULTY_LABEL = {
  easy: 'Лёгкая',
  medium: 'Средняя',
  hard: 'Сложная',
};

const typeLabels = {
  card: 'Карточка',
  practice: 'Кейс',
  knowledge: 'База знаний',
  theory: 'Теория',
  personal: 'Моя теория',
};

export default function ResourcePreviewModal({
  data,
  onClose,
  cards = [],
  practiceCases = [],
  knowledgeResources = [],
  theoryItems = [],
  personalTheory = [],
}) {
  const { type, id, canViewSolution = false, allowReveal = false } = data ?? {};

  const close = () => {
    onClose?.();
  };

  const [showSolution, setShowSolution] = useState(Boolean(canViewSolution));

  useEffect(() => {
    setShowSolution(Boolean(canViewSolution));
  }, [canViewSolution]);

  if (!data) return null;

  const renderReveal = (label) => {
    if (showSolution || !allowReveal) return null;
    return (
      <button
        type="button"
        onClick={() => setShowSolution(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark"
      >
        Посмотреть решение
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/80">{label}</span>
      </button>
    );
  };

  let content = null;

  if (type === 'card') {
    const card = cards.find((entry) => String(entry.id) === String(id));
    if (card) {
      content = (
        <div className="space-y-4">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">{typeLabels.card}</p>
            <h3 className="text-lg font-semibold text-slate-900">{card.category ?? 'Без категории'}</h3>
          </header>
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Вопрос</p>
            <p className="text-base sm:text-lg text-slate-900 whitespace-pre-wrap">{card.question}</p>
          </section>
          {card.answer && showSolution && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Ответ</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{card.answer}</p>
            </section>
          )}
          {renderReveal('карточка')}
        </div>
      );
    }
  }

  if (type === 'practice') {
    const practice = practiceCases.find((entry) => String(entry.id) === String(id));
    if (practice) {
      content = (
        <div className="space-y-4">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">{typeLabels.practice}</p>
            <h3 className="text-xl font-semibold text-slate-900">{practice.title}</h3>
            <p className="text-xs text-slate-500">
              Тема: {practice.category ?? '—'} · Сложность: {DIFFICULTY_LABEL[practice.difficulty] ?? 'Средняя'} · Баллы:{' '}
              {practice.points ?? '—'}
            </p>
          </header>
          {practice.image_url && (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <img src={practice.image_url} alt={practice.title} className="w-full max-h-80 object-cover" />
            </div>
          )}
          {practice.prompt && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Условие</p>
              <p className="text-base sm:text-lg text-slate-900 whitespace-pre-wrap">{practice.prompt}</p>
            </section>
          )}
          {practice.solution && showSolution && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Решение</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{practice.solution}</p>
            </section>
          )}
          {!showSolution && renderReveal('кейс')}
          {practice.mentor_comment && (
            <section className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand-dark whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              <span className="font-semibold">Комментарий Тимура: </span>
              {practice.mentor_comment}
            </section>
          )}
        </div>
      );
    }
  }

  if (type === 'knowledge') {
    const resource = knowledgeResources.find((entry) => String(entry.id) === String(id));
    if (resource) {
      content = (
        <div className="space-y-4">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">{typeLabels.knowledge}</p>
            <h3 className="text-lg font-semibold text-slate-900">{resource.title}</h3>
            <p className="text-xs text-slate-500">
              Категория: {resource.category ?? '—'} · Тип: {resource.type ?? 'Материал'} · Сложность:{' '}
              {DIFFICULTY_LABEL[resource.difficulty] ?? 'Средняя'}
            </p>
          </header>
          {resource.description && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Описание</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{resource.description}</p>
            </section>
          )}
          {resource.content && resource.type === 'text' && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Содержимое</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{resource.content}</p>
            </section>
          )}
          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark"
            >
              Открыть ссылку
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.586 2.586a2 2 0 112.828 2.828L8.828 10l4.586 4.586a2 2 0 11-2.828 2.828L4.586 10l6-7.414z" />
              </svg>
            </a>
          )}
        </div>
      );
    }
  }

  if (type === 'theory') {
    const theory = theoryItems.find((entry) => String(entry.id) === String(id));
    if (theory) {
      content = (
        <div className="space-y-4">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">{typeLabels.theory}</p>
            <h3 className="text-lg font-semibold text-slate-900">{theory.title}</h3>
          </header>
          {theory.summary && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Кратко</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{theory.summary}</p>
            </section>
          )}
          {theory.content && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Полный текст</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{theory.content}</p>
            </section>
          )}
        </div>
      );
    }
  }

  if (type === 'personal') {
    const personal = personalTheory.find((entry) => String(entry.id) === String(id));
    if (personal) {
      content = (
        <div className="space-y-4">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">{typeLabels.personal}</p>
            <h3 className="text-lg font-semibold text-slate-900">{personal.title}</h3>
          </header>
          {personal.description && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{personal.description}</p>
          )}
          {personal.content && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Материал</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{personal.content}</p>
            </section>
          )}
          {personal.url && (
            <a
              href={personal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark"
            >
              Открыть ссылку
            </a>
          )}
        </div>
      );
    }
  }

  if (!content) return null;

  content = (
    <div className="rounded-3xl border border-white/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.14)] min-h-[420px] space-y-4">
      {content}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 py-10">
      <div className="relative flex max-h-[90vh] min-h-[60vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2.4rem] border border-white/25 bg-white/95 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.35)]">
        <button
          type="button"
          onClick={close}
          className="absolute right-6 top-6 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 p-2 text-slate-500 transition hover:border-brand hover:text-brand"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.225 4.811a1 1 0 00-1.414 1.414L8.586 10l-3.775 3.775a1 1 0 101.414 1.414L10 11.414l3.775 3.775a1 1 0 101.414-1.414L11.414 10l3.775-3.775a1 1 0 00-1.414-1.414L10 8.586 6.225 4.811z" />
          </svg>
        </button>
        <div className="mt-6 flex-1 min-h-[400px] space-y-6 overflow-y-auto pr-3 custom-scrollbar">
          {content}
        </div>
      </div>
    </div>
  );
}
