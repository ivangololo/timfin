import { useEffect, useMemo, useRef, useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';

const CARD_STATUS_CONFIG = {
  unsure: {
    label: 'Не уверен',
    accent: 'bg-amber-500',
    description: 'Вернитесь к карточке и уточните детали ответа.',
  },
  dontknow: {
    label: 'Не знаю',
    accent: 'bg-rose-500',
    description: 'Изучите теорию и попробуйте снова ответить на вопрос.',
  },
};

const CARD_STATUS_ORDER = ['unsure', 'dontknow'];

const CASE_STATUS_CONFIG = {
  in_progress: {
    label: 'В процессе',
    accent: 'bg-amber-500',
    description: 'Кейс в работе. Закончите решение или отметьте как готово.',
  },
  todo: {
    label: 'К работе',
    accent: 'bg-slate-400',
    description: 'Новые кейсы. Запланируйте время и решите их.',
  },
};

const CASE_STATUS_ORDER = ['in_progress', 'todo'];

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

const ensureCaseStatus = (value) => {
  if (value === 'in_progress' || value === 'done') return value;
  return 'todo';
};

export default function ReviewDeck({
  cards = [],
  cases = [],
  statuses,
  caseStatuses,
  onUpdateStatus,
  onUpdateCaseStatus,
  onBack,
}) {
  const touchMovedRef = useRef(false);
  const reviewStatuses = useMemo(() => statuses ?? {}, [statuses]);
  const reviewCaseStatuses = useMemo(() => caseStatuses ?? {}, [caseStatuses]);
  const handleContentClick = (event) => {
    if (touchMovedRef.current) {
      event.stopPropagation();
      touchMovedRef.current = false;
    }
  };

  const cardCounts = useMemo(() => {
    return cards.reduce(
      (acc, card) => {
        const status = reviewStatuses[String(card.id)];
        if (status && CARD_STATUS_CONFIG[status]) {
          acc[status] = (acc[status] ?? 0) + 1;
          acc.total += 1;
        }
        return acc;
      },
      { total: 0, unsure: 0, dontknow: 0 },
    );
  }, [cards, reviewStatuses]);

  const caseCounts = useMemo(() => {
    return cases.reduce(
      (acc, item) => {
        const status = ensureCaseStatus(reviewCaseStatuses[String(item.id)]);
        if (status && CASE_STATUS_CONFIG[status]) {
          acc[status] = (acc[status] ?? 0) + 1;
          acc.total += 1;
        }
        return acc;
      },
      { total: 0, in_progress: 0, todo: 0 },
    );
  }, [cases, reviewCaseStatuses]);

  const initialMode = useMemo(() => {
    if (cardCounts.total > 0) return 'cards';
    if (caseCounts.total > 0) return 'cases';
    return 'cards';
  }, [cardCounts.total, caseCounts.total]);

  const [mode, setMode] = useState(initialMode);

  const initialStatus = useMemo(() => {
    const order = mode === 'cases' ? CASE_STATUS_ORDER : CARD_STATUS_ORDER;
    const source = mode === 'cases' ? caseCounts : cardCounts;
    for (const status of order) {
      if ((source[status] ?? 0) > 0) return status;
    }
    return order[0];
  }, [mode, cardCounts, caseCounts]);

  const [activeStatus, setActiveStatus] = useState(initialStatus);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    setActiveStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setActiveIndex(0);
    setIsFlipped(false);
  }, [activeStatus, mode]);

  const filteredCards = useMemo(() => {
    if (mode !== 'cards') return [];
    return cards.filter((card) => reviewStatuses[String(card.id)] === activeStatus);
  }, [cards, reviewStatuses, activeStatus, mode]);

  const filteredCases = useMemo(() => {
    if (mode !== 'cases') return [];
    return cases.filter((item) => ensureCaseStatus(reviewCaseStatuses[String(item.id)]) === activeStatus);
  }, [cases, reviewCaseStatuses, activeStatus, mode]);

  useEffect(() => {
    const list = mode === 'cases' ? filteredCases : filteredCards;
    if (activeIndex >= list.length) {
      setActiveIndex(list.length ? list.length - 1 : 0);
      setIsFlipped(false);
    }
  }, [filteredCards, filteredCases, activeIndex, mode]);

  const currentCard = mode === 'cards' ? filteredCards[activeIndex] : null;
  const currentCase = mode === 'cases' ? filteredCases[activeIndex] : null;
  const currentDifficulty = currentCard
    ? normalizeDifficulty(currentCard.difficulty)
    : currentCase
      ? normalizeDifficulty(currentCase.difficulty)
      : 'medium';
  const difficultyMeta = DIFFICULTY_CONFIG[currentDifficulty];

  const handleCardStatusChange = (cardId, nextStatus) => {
    onUpdateStatus?.(cardId, nextStatus);
    setIsFlipped(false);
    const remaining = filteredCards.filter((card) => String(card.id) !== String(cardId));
    if (remaining.length === 0) {
      const nextStatusInOrder = CARD_STATUS_ORDER.find(
        (status) => status !== activeStatus && (cardCounts[status] ?? 0) > 0,
      );
      if (nextStatusInOrder) setActiveStatus(nextStatusInOrder);
    }
  };

  const handleCaseStatusChange = (caseId, nextStatus) => {
    onUpdateCaseStatus?.(caseId, nextStatus);
    setIsFlipped(false);
    const remaining = filteredCases.filter((item) => String(item.id) !== String(caseId));
    if (remaining.length === 0) {
      const nextStatusInOrder = CASE_STATUS_ORDER.find(
        (status) => status !== activeStatus && (caseCounts[status] ?? 0) > 0,
      );
      if (nextStatusInOrder) setActiveStatus(nextStatusInOrder);
    }
  };

  const summaryBadges =
    mode === 'cards'
      ? CARD_STATUS_ORDER.map((status) => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={`glow-border rounded-full border px-4 py-2 text-sm font-medium transition ${
              activeStatus === status
                ? 'border-transparent bg-slate-900 text-white shadow-lg shadow-slate-900/30'
                : 'border-white/60 bg-white/70 text-slate-600 hover:border-brand/40 hover:text-brand'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${CARD_STATUS_CONFIG[status].accent}`} />
              {CARD_STATUS_CONFIG[status].label}
              <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-500">
                {cardCounts[status] ?? 0}
              </span>
            </span>
          </button>
        ))
      : CASE_STATUS_ORDER.map((status) => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={`glow-border rounded-full border px-4 py-2 text-sm font-medium transition ${
              activeStatus === status
                ? 'border-transparent bg-slate-900 text-white shadow-lg shadow-slate-900/30'
                : 'border-white/60 bg-white/70 text-slate-600 hover:border-brand/40 hover:text-brand'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${CASE_STATUS_CONFIG[status].accent}`} />
              {CASE_STATUS_CONFIG[status].label}
              <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-500">
                {caseCounts[status] ?? 0}
              </span>
            </span>
          </button>
        ));

  const currentListLength = mode === 'cases' ? filteredCases.length : filteredCards.length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent py-12">
      <AmbientBackdrop />
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 sm:px-6">
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
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <h2 className="text-3xl font-display font-semibold text-slate-900">
                {mode === 'cards' ? 'Карточки на повторение' : 'Кейсы на повторение'}
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                {mode === 'cards'
                  ? 'Работайте с карточками, помеченными как «Не знаю» или «Не уверен». Отмечайте новые статусы, когда почувствуете уверенность.'
                  : 'Вернитесь к кейсам, которые ещё не решены или в работе. Открывайте решения и помечайте прогресс.'}
              </p>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/80 px-5 py-3 text-sm text-slate-600 shadow-inner">
              {mode === 'cards' ? `Всего: ${cardCounts.total} карточек` : `Всего: ${caseCounts.total} кейсов`}
            </div>
          </div>

          {(cardCounts.total > 0 || caseCounts.total > 0) && (
            <div className="mt-6 inline-flex rounded-full border border-white/60 bg-white/70 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setMode('cards')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === 'cards' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/30' : 'text-slate-600'
                }`}
              >
                Карточки
              </button>
              <button
                type="button"
                onClick={() => setMode('cases')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === 'cases' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/30' : 'text-slate-600'
                }`}
              >
                Кейсы
              </button>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">{summaryBadges}</div>
        </header>

        {(mode === 'cards' && cardCounts.total === 0) || (mode === 'cases' && caseCounts.total === 0) ? (
          <div className="rounded-[2.6rem] border border-white/60 bg-white/85 p-12 text-center shadow-[0_30px_85px_rgba(15,23,42,0.14)] backdrop-blur">
            <h3 className="text-2xl font-semibold text-slate-900">Отлично! Повторение не требуется.</h3>
            <p className="mt-3 text-sm text-slate-600">
              {mode === 'cards'
                ? 'Отметьте новые карточки как «Не уверен» или «Не знаю» в тренажёре, чтобы они появились здесь.'
                : 'Пометьте кейсы как «В процессе» в тренажёре, чтобы вернуться к ним здесь.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative rounded-[2.6rem] border border-white/60 bg-white/80 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl">
              <div
                className="card-3d-container glow-border"
                style={
                  mode === 'cards'
                    ? { height: '520px', maxHeight: '70vh', minHeight: '440px' }
                    : { height: '520px', maxHeight: '75vh', minHeight: '460px' }
                }
                onTouchStart={() => {
                  touchMovedRef.current = false;
                }}
                onTouchMove={() => {
                  touchMovedRef.current = true;
                }}
                onClick={() => {
                  if (touchMovedRef.current) {
                    touchMovedRef.current = false;
                    return;
                  }
                  if (mode === 'cards' ? currentCard : currentCase) {
                    setIsFlipped((prev) => !prev);
                  }
                }}
                >
                  <div className={`card-3d ${isFlipped ? 'card-3d-flipped' : ''}`}>
                    <div className="card-3d-face card-3d-front">
                      <div
                        className={`card-3d-content custom-scrollbar ${mode === 'cards' ? 'justify-center' : ''}`}
                        onTouchStartCapture={() => {
                          touchMovedRef.current = false;
                        }}
                        onTouchMoveCapture={() => {
                          touchMovedRef.current = true;
                      }}
                      onClickCapture={handleContentClick}
                    >
                      {mode === 'cards' && currentCard && (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${CARD_STATUS_CONFIG[activeStatus].accent}`} />
                              {CARD_STATUS_CONFIG[activeStatus].label}
                            </div>
                            <span className="text-xs text-slate-400">Нажмите, чтобы перевернуть</span>
                          </div>
                          <div className="flex flex-col gap-4">
                            <span className="text-sm text-slate-500">Категория: {currentCard.category}</span>
                            <p className="text-xl sm:text-2xl font-semibold leading-snug text-slate-900">
                              {currentCard.question}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500">
                            <span>
                              Карточка {activeIndex + 1} из {currentListLength}
                            </span>
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${difficultyMeta.badge}`}>
                              {difficultyMeta.label}
                            </span>
                          </div>
                        </>
                      )}
                      {mode === 'cases' && currentCase && (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${CASE_STATUS_CONFIG[activeStatus].accent}`} />
                              {CASE_STATUS_CONFIG[activeStatus].label}
                            </div>
                            <span className="text-xs text-slate-400">Нажмите, чтобы открыть решение</span>
                          </div>
                          <div className="flex flex-col gap-3">
                            <span className="text-sm text-slate-500">
                              Категория: {currentCase.category ?? 'Общая практика'} · Баллы: {currentCase.points ?? '—'}
                            </span>
                            <p className="text-xl sm:text-2xl font-semibold leading-snug text-slate-900">
                              {currentCase.title}
                            </p>
                            {currentCase.image_url && (
                              <div className="overflow-hidden rounded-2xl border border-slate-100">
                                <img src={currentCase.image_url} alt={currentCase.title} className="w-full h-48 object-cover" />
                              </div>
                            )}
                            {currentCase.prompt && (
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{currentCase.prompt}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500">
                            <span>
                              Кейс {activeIndex + 1} из {currentListLength}
                            </span>
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${difficultyMeta.badge}`}>
                              {difficultyMeta.label}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    </div>
                    <div className="card-3d-face card-3d-back">
                    {mode === 'cards' && currentCard && (
                      <div
                        className={`card-3d-content custom-scrollbar ${mode === 'cards' ? 'justify-center' : ''}`}
                        onTouchStartCapture={() => {
                          touchMovedRef.current = false;
                        }}
                        onTouchMoveCapture={() => {
                          touchMovedRef.current = true;
                        }}
                        onClickCapture={handleContentClick}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                            <span>Ответ</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                              {CARD_STATUS_CONFIG[activeStatus].description}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap">{currentCard.answer}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleCardStatusChange(currentCard.id, 'unsure')}
                              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50"
                            >
                              Не уверен
                            </button>
                            <button
                              onClick={() => handleCardStatusChange(currentCard.id, 'dontknow')}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                            >
                              Не знаю
                            </button>
                            <button
                              onClick={() => handleCardStatusChange(currentCard.id, 'know')}
                              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                            >
                              Знаю
                            </button>
                          </div>
                          <button
                            onClick={() => setIsFlipped(false)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
                          >
                            Закрыть
                          </button>
                        </div>
                      </div>
                    )}
                    {mode === 'cases' && currentCase && (
                      <div
                        className="card-3d-content custom-scrollbar"
                        onTouchStartCapture={() => {
                          touchMovedRef.current = false;
                        }}
                        onTouchMoveCapture={() => {
                          touchMovedRef.current = true;
                        }}
                        onClickCapture={handleContentClick}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                            <span>Решение</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                              {CASE_STATUS_CONFIG[activeStatus].description}
                            </span>
                          </div>
                          {currentCase.solution ? (
                            <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{currentCase.solution}</p>
                          ) : (
                            <p className="text-sm text-slate-600">Решение пока не добавлено. Обсудите кейс с наставником.</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleCaseStatusChange(currentCase.id, 'todo')}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:bg-brand/10"
                            >
                              В план
                            </button>
                            <button
                              onClick={() => handleCaseStatusChange(currentCase.id, 'in_progress')}
                              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50"
                            >
                              В процессе
                            </button>
                            <button
                              onClick={() => handleCaseStatusChange(currentCase.id, 'done')}
                              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                            >
                              Решено
                            </button>
                          </div>
                          <button
                            onClick={() => setIsFlipped(false)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
                          >
                            Закрыть
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <aside className="flex flex-col gap-4 rounded-[2.6rem] border border-white/60 bg-gradient-to-br from-white/90 via-white/70 to-brand/10 p-6 shadow-[0_28px_72px_rgba(15,23,42,0.14)]">
              <h3 className="text-lg font-semibold text-slate-900">
                {mode === 'cards' ? 'Обновите статус' : 'Отметьте прогресс по кейсу'}
              </h3>
              <p className="text-sm text-slate-600">
                {mode === 'cards'
                  ? 'После повторения отметьте результат, чтобы карточка исчезла из этого списка.'
                  : 'Укажите, на каком этапе кейс. После отметки «Решено» он пропадёт из повторения.'}
              </p>
              {mode === 'cards' ? (
                <>
                  <button
                    onClick={() => currentCard && handleCardStatusChange(currentCard.id, 'know')}
                    className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500/90 disabled:opacity-60"
                    disabled={!currentCard}
                  >
                    Освоил тему
                  </button>
                  <button
                    onClick={() => currentCard && handleCardStatusChange(currentCard.id, 'unsure')}
                    className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-amber-400/90 disabled:opacity-60"
                    disabled={!currentCard}
                  >
                    Ещё не уверен
                  </button>
                  <button
                    onClick={() => currentCard && handleCardStatusChange(currentCard.id, 'dontknow')}
                    className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500/90 disabled:opacity-60"
                    disabled={!currentCard}
                  >
                    Пока не знаю
                  </button>
                  <div className="rounded-2xl border border-white/50 bg-white/85 px-4 py-3 text-xs text-slate-500 shadow-[0_18px_42px_rgba(37,99,235,0.12)]">
                    {currentCard ? (
                      <div className="space-y-1">
                        <p>{CARD_STATUS_CONFIG[activeStatus].description}</p>
                        <p>
                          Сложность: <span className="font-semibold text-slate-800">{difficultyMeta.label}</span>
                        </p>
                      </div>
                    ) : (
                      <p>Выберите карточку для обновления статуса.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => currentCase && handleCaseStatusChange(currentCase.id, 'done')}
                    className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500/90 disabled:opacity-60"
                    disabled={!currentCase}
                  >
                    Решено
                  </button>
                  <button
                    onClick={() => currentCase && handleCaseStatusChange(currentCase.id, 'in_progress')}
                    className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-amber-400/90 disabled:opacity-60"
                    disabled={!currentCase}
                  >
                    В процессе
                  </button>
                  <button
                    onClick={() => currentCase && handleCaseStatusChange(currentCase.id, 'todo')}
                    className="w-full rounded-2xl bg-slate-200 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-200/80 disabled:opacity-60"
                    disabled={!currentCase}
                  >
                    Вернуть в план
                  </button>
                  <div className="rounded-2xl border border-white/50 bg-white/85 px-4 py-3 text-xs text-slate-500 shadow-[0_18px_42px_rgba(37,99,235,0.12)]">
                    {currentCase ? (
                      <div className="space-y-1">
                        <p>{CASE_STATUS_CONFIG[activeStatus].description}</p>
                        <p>
                          Сложность: <span className="font-semibold text-slate-800">{difficultyMeta.label}</span>
                        </p>
                      </div>
                    ) : (
                      <p>Выберите кейс, чтобы обновить статус.</p>
                    )}
                  </div>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
