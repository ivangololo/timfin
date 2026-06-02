import { useEffect, useMemo, useRef, useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';

const CARD_STATUS_CONFIG = {
  know: {
    label: 'Знаю хорошо',
    description: 'Карточка больше не появится в повторении.',
    accent: 'bg-emerald-500',
  },
  unsure: {
    label: 'Не уверен',
    description: 'Карточка попадёт в блок повторения.',
    accent: 'bg-amber-400',
  },
  dontknow: {
    label: 'Не знаю',
    description: 'Карточка отмечена как требующая изучения.',
    accent: 'bg-rose-500',
  },
};

const CASE_STATUS_CONFIG = {
  todo: {
    label: 'Не приступал',
    description: 'Переверни карточку, чтобы проверить решение.',
    badge: 'bg-slate-200 text-slate-600 border-slate-300',
  },
  in_progress: {
    label: 'В работе',
    description: 'Посмотри решение и отметь текущий статус.',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  done: {
    label: 'Решено',
    description: 'Кейс закрыт — можно двигаться дальше.',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
};

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

const VIEW_MODES = [
  { id: 'cards', label: 'Карточки' },
  { id: 'cases', label: 'Кейсы' },
];

const ALL_CATEGORY = 'Все темы';

const shuffleArray = (source) => {
  const array = [...source];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const normalizeDifficulty = (value) => {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'medium';
};

const getCaseCategory = (item) => item.category ?? 'Общая практика';

const ensureCaseStatus = (value) => {
  if (value === 'in_progress' || value === 'done') return value;
  return 'todo';
};

const formatPoints = (points) => {
  if (points == null || Number.isNaN(points)) return null;
  const value = Number(points);
  if (value <= 0) return null;
  if (value === 1) return '1 балл';
  if (value < 5) return `${value} балла`;
  return `${value} баллов`;
};

export default function TrainingDeck({
  cards,
  cases,
  progress,
  onProgressChange,
  onCaseStatusChange,
  onBack,
  focusMode = null,
  focusCategory = null,
}) {
  const cardCategories = useMemo(() => {
    const unique = Array.from(new Set(cards.map((card) => card.category))).sort((a, b) => a.localeCompare(b, 'ru'));
    return [ALL_CATEGORY, ...unique];
  }, [cards]);

  const caseCategories = useMemo(() => {
    const unique = Array.from(new Set(cases.map((item) => getCaseCategory(item)))).sort((a, b) =>
      a.localeCompare(b, 'ru'),
    );
    const fallback = cardCategories.filter((cat) => cat !== ALL_CATEGORY);
    const combined = unique.length > 0 ? unique : fallback;
    return [ALL_CATEGORY, ...combined];
  }, [cases, cardCategories]);

  const [mode, setMode] = useState('cards');
  const [selectedCategory, setSelectedCategory] = useState({
    cards: cardCategories[0] ?? ALL_CATEGORY,
    cases: caseCategories[0] ?? ALL_CATEGORY,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardHeight, setCardHeight] = useState(520);
  const frontContentRef = useRef(null);
  const backContentRef = useRef(null);
  const touchMovedRef = useRef(false);
  const handleFrontWheel = (event) => {
    if (!frontContentRef.current) return;
    frontContentRef.current.scrollBy({
      top: event.deltaY,
      left: event.deltaX,
      behavior: 'auto',
    });
    event.preventDefault();
    event.stopPropagation();
  };
  const handleBackWheel = (event) => {
    if (!backContentRef.current) return;
    backContentRef.current.scrollBy({
      top: event.deltaY,
      left: event.deltaX,
      behavior: 'auto',
    });
    event.preventDefault();
    event.stopPropagation();
  };
  const handleContentClick = (event) => {
    if (touchMovedRef.current) {
      event.stopPropagation();
      touchMovedRef.current = false;
    }
  };
  const handleTouchEnd = (event) => {
    if (touchMovedRef.current) {
      // Останавливаем всплытие, чтобы после скролла карточка не переворачивалась.
      event.stopPropagation();
      event.preventDefault();
      setTimeout(() => {
        touchMovedRef.current = false;
      }, 50);
      return;
    }
    touchMovedRef.current = false;
  };

  const shuffledCards = useMemo(() => shuffleArray(cards), [cards]);

  useEffect(() => {
    setSelectedCategory((prev) => ({
      cards: cardCategories.includes(prev.cards) ? prev.cards : cardCategories[0] ?? ALL_CATEGORY,
      cases: caseCategories.includes(prev.cases) ? prev.cases : caseCategories[0] ?? ALL_CATEGORY,
    }));
  }, [cardCategories, caseCategories]);

  useEffect(() => {
    if (!focusCategory) return;
    const normalized = focusCategory === 'all' ? ALL_CATEGORY : focusCategory;
    if (cardCategories.includes(normalized)) {
      setMode('cards');
      setSelectedCategory((prev) => ({ ...prev, cards: normalized }));
    } else if (caseCategories.includes(normalized)) {
      setMode('cases');
      setSelectedCategory((prev) => ({ ...prev, cases: normalized }));
    }
  }, [focusCategory, cardCategories, caseCategories]);

  useEffect(() => {
    if (!focusMode) return;
    if (focusMode === 'cards' || focusMode === 'cases') {
      setMode(focusMode);
    }
  }, [focusMode]);

  const activeCardCategory = selectedCategory.cards;
  const activeCaseCategory = selectedCategory.cases;
  const cardItems = useMemo(() => {
    if (activeCardCategory === ALL_CATEGORY) {
      return shuffledCards;
    }
    return cards.filter((card) => card.category === activeCardCategory);
  }, [cards, activeCardCategory, shuffledCards]);

  const caseItems = useMemo(() => {
    if (activeCaseCategory === ALL_CATEGORY) {
      return cases;
    }
    return cases.filter((item) => getCaseCategory(item) === activeCaseCategory);
  }, [cases, activeCaseCategory]);

  const categories = mode === 'cards' ? cardCategories : caseCategories;
  const selected = selectedCategory[mode];
  const activeCategory = mode === 'cards' ? activeCardCategory : activeCaseCategory;
  const dataset = mode === 'cards' ? cardItems : caseItems;

  useEffect(() => {
    const baseKey = activeCategory === ALL_CATEGORY ? '__all__' : activeCategory;
    const prefix = mode === 'cards' ? 'card:' : 'case:';
    const storedIndex =
      progress.lastSeenIndex?.[`${prefix}${baseKey}`] ??
      (mode === 'cards' ? progress.lastSeenIndex?.[baseKey] : 0) ??
      0;
    const safeIndex = dataset.length === 0 ? 0 : Math.min(storedIndex, dataset.length - 1);
    setCurrentIndex(safeIndex);
    setIsFlipped(false);
  }, [mode, activeCategory, dataset.length, progress.lastSeenIndex]);

  const cardStatuses = useMemo(() => progress.statuses ?? {}, [progress.statuses]);
  const caseStatuses = useMemo(() => progress.caseStatuses ?? {}, [progress.caseStatuses]);

  const currentItem = dataset[currentIndex];
  const currentCard = mode === 'cards' ? currentItem : null;
  const currentCase = mode === 'cases' ? currentItem : null;

  const currentCardStatus = currentCard ? cardStatuses[String(currentCard.id)] ?? null : null;
  const currentCardDifficulty = currentCard ? normalizeDifficulty(currentCard.difficulty) : 'medium';
  const currentCardDifficultyMeta = DIFFICULTY_CONFIG[currentCardDifficulty];

  const currentCaseStatus = currentCase ? ensureCaseStatus(caseStatuses[String(currentCase.id)]) : 'todo';
  const currentCaseDifficulty = currentCase ? normalizeDifficulty(currentCase.difficulty) : 'medium';
  const currentCaseDifficultyMeta = DIFFICULTY_CONFIG[currentCaseDifficulty];
  const currentCaseComment =
    currentCase && currentCase.mentor_comment?.trim()
      ? currentCase.mentor_comment.trim()
      : 'Поделись решением — Тимур оставит индивидуальный фидбек.';
  const currentCaseFrontImages = useMemo(() => {
    const list = [];
    if (Array.isArray(currentCase?.images_front)) {
      currentCase.images_front.forEach((url) => url && list.push(url));
    }
    if (currentCase?.image_url) list.unshift(currentCase.image_url);
    return Array.from(new Set(list));
  }, [currentCase?.images_front, currentCase?.image_url]);
  const currentCaseBackImages = useMemo(() => {
    const list = [];
    if (Array.isArray(currentCase?.images_back)) {
      currentCase.images_back.forEach((url) => url && list.push(url));
    }
    return Array.from(new Set(list));
  }, [currentCase?.images_back]);

  useEffect(() => {
    const calculateHeight = () => {
      const viewport = typeof window !== 'undefined' ? window.innerHeight : 900;
      const target = Math.max(520, Math.min(720, Math.round(viewport * 0.72)));
      setCardHeight(target);
    };
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  const cardReviewCounts = useMemo(() => {
    if (mode !== 'cards') {
      return { unsure: 0, dontknow: 0 };
    }
    return cardItems.reduce(
      (acc, card) => {
        const status = cardStatuses[String(card.id)];
        if (status === 'unsure') acc.unsure += 1;
        if (status === 'dontknow') acc.dontknow += 1;
        return acc;
      },
      { unsure: 0, dontknow: 0 },
    );
  }, [mode, cardItems, cardStatuses]);

  const knownCount = useMemo(() => {
    if (mode !== 'cards') return 0;
    const knownSet = new Set(
      Object.entries(cardStatuses)
        .filter(([, status]) => status === 'know')
        .map(([id]) => id),
    );
    return cardItems.filter((card) => knownSet.has(String(card.id))).length;
  }, [mode, cardItems, cardStatuses]);

  const caseStatusCounts = useMemo(() => {
    if (mode !== 'cases') {
      return { todo: 0, in_progress: 0, done: 0 };
    }
    return caseItems.reduce(
      (acc, item) => {
        const status = ensureCaseStatus(caseStatuses[String(item.id)]);
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      },
      { todo: 0, in_progress: 0, done: 0 },
    );
  }, [mode, caseItems, caseStatuses]);

  const datasetTotal = dataset.length;

  const handleModeSwitch = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setIsFlipped(false);
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory((prev) => ({
      ...prev,
      [mode]: category,
    }));
    setIsFlipped(false);
  };

  const handleCardAnswer = (status) => {
    if (!currentCard) return;
    const cardKey = String(currentCard.id);
    const nextIndex = datasetTotal === 0 ? 0 : (currentIndex + 1) % datasetTotal;
    const baseKey = activeCategory === ALL_CATEGORY ? '__all__' : activeCategory;
    const lastSeenUpdates = { [`card:${baseKey}`]: nextIndex };
    if (baseKey !== '__all__') {
      lastSeenUpdates[baseKey] = nextIndex;
    }
    onProgressChange({
      statuses: { [cardKey]: status },
      lastSeenIndex: lastSeenUpdates,
    });
    setCurrentIndex(nextIndex);
    setIsFlipped(false);
  };

  const handleCaseStatusUpdate = (status, advance = true) => {
    if (!currentCase) return;
    const caseKey = String(currentCase.id);
    const nextIndex = advance && datasetTotal > 0 ? (currentIndex + 1) % datasetTotal : currentIndex;
    const baseKey = activeCategory === ALL_CATEGORY ? '__all__' : activeCategory;
    const options = {
      lastSeenKey: `case:${baseKey}`,
      nextIndex,
    };
    if (baseKey !== '__all__') {
      options.additionalLastSeenKeys = [`practice:${baseKey}`];
    }
    onCaseStatusChange(caseKey, status, options);
    setCurrentIndex(nextIndex);
    setIsFlipped(false);
  };

  const headerSummary =
    mode === 'cards'
      ? `Карточек изучено: ${knownCount} / ${cardItems.length} · На повторении: ${cardReviewCounts.unsure + cardReviewCounts.dontknow}`
      : `Кейсов решено: ${caseStatusCounts.done} / ${caseItems.length} · В работе: ${caseStatusCounts.in_progress}`;

  return (
    <div className="relative min-h-screen bg-transparent py-12">
      <AmbientBackdrop />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
        <header className="rounded-[2.6rem] border border-white/60 bg-white/80 p-10 shadow-[0_30px_85px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M12.707 15.707a1 1 0 01-1.414 0L6.586 11l4.707-4.707a1 1 0 10-1.414-1.414l-5.414 5.414a1 1 0 000 1.414l5.414 5.414a1 1 0 001.414 0z" />
            </svg>
            Назад в кабинет
          </button>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-display font-semibold text-slate-900">Карточки и кейсы</h2>
                <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-dark">
                  Прогресс сохраняется автоматически
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                Переключайтесь между карточками и кейсами, выбирайте тему и отмечайте статус. Решения и комментарии наставника доступны на обороте карточки.
              </p>
            </div>
            <div className="inline-flex rounded-3xl border border-white/60 bg-white/80 p-1 shadow-inner">
              {VIEW_MODES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleModeSwitch(option.id)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    mode === option.id ? 'bg-brand text-white shadow-lg shadow-brand/25' : 'text-slate-600 hover:bg-brand/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 px-5 py-3 text-sm text-slate-600 shadow-inner">
            {headerSummary}
          </div>

          <div className="mt-8 flex max-h-72 flex-wrap gap-3 overflow-y-auto pr-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                className={`glow-border rounded-full px-5 py-2 text-sm font-medium transition border ${
                  category === selected
                    ? 'border-transparent bg-brand text-white shadow-lg shadow-brand/25'
                    : 'border-white/60 bg-white/80 text-slate-600 hover:border-brand/60 hover:text-brand'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_320px]">
          <div className="relative rounded-[2.6rem] border border-white/60 bg-white/80 p-8 shadow-[0_28px_85px_rgba(15,23,42,0.16)] backdrop-blur-xl">
            <div className="relative flex flex-col">
              <div
                className="card-3d-container glow-border"
                style={
                  mode === 'cards'
                    ? { height: '520px', maxHeight: '70vh', minHeight: '440px' }
                    : { height: `${cardHeight}px`, maxHeight: '78vh', minHeight: '460px' }
                }
                role="button"
                tabIndex={0}
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
                  setIsFlipped((prev) => !prev);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setIsFlipped((prev) => !prev);
                  }
                }}
              >
                <div className={`card-3d ${isFlipped ? 'card-3d-flipped' : ''}`}>
                  <div className="card-3d-face card-3d-front">
                    <div
                      className={`card-3d-content custom-scrollbar ${mode === 'cards' ? 'justify-center' : ''}`}
                      ref={frontContentRef}
                      onWheelCapture={handleFrontWheel}
                      onTouchStartCapture={() => {
                        touchMovedRef.current = false;
                      }}
                      onTouchMoveCapture={(event) => {
                        event.stopPropagation();
                        touchMovedRef.current = true;
                      }}
                      onTouchEndCapture={(event) => {
                        event.stopPropagation();
                        handleTouchEnd(event);
                      }}
                      onClickCapture={handleContentClick}
                    >
                      {mode === 'cards' ? (
                        currentCard ? (
                          <>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 sm:text-xs">
                        <span className="rounded-full border border-slate-200 px-2.5 py-0.5 font-semibold uppercase tracking-[0.2em] text-slate-600 sm:px-3 sm:py-1 sm:tracking-[0.35em]">
                          {selected === ALL_CATEGORY ? currentCard.category : selected}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.25em] ${currentCardDifficultyMeta.badge}`}
                        >
                          {currentCardDifficultyMeta.label}
                        </span>
                      </div>
                        <div className="mt-6 space-y-4">
                          <h3 className="text-2xl font-semibold text-slate-900">{currentCard.question}</h3>
                        <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-xs text-slate-500 shadow-inner">
                          Переверните карточку, чтобы увидеть ответ и отметить статус.
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="m-auto text-center text-slate-500">Карточки для выбранной темы пока не добавлены.</div>
                  )
                ) : currentCase ? (
                    <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 sm:text-xs">
                      <span className="rounded-full border border-slate-200 px-2.5 py-0.5 font-semibold uppercase tracking-[0.2em] text-slate-600 sm:px-3 sm:py-1 sm:tracking-[0.35em]">
                        {selected === ALL_CATEGORY ? getCaseCategory(currentCase) : selected}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.25em] ${currentCaseDifficultyMeta.badge}`}
                      >
                        {currentCaseDifficultyMeta.label}
                      </span>
                    </div>
                    <div className="mt-6 space-y-4 text-left">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-2xl font-semibold text-slate-900">{currentCase.title}</h3>
                        {formatPoints(currentCase.points) && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                            {formatPoints(currentCase.points)}
                          </span>
                        )}
                      </div>
                      {currentCase.logo_url && (
                        <div className="flex">
                          <img
                            src={currentCase.logo_url}
                            alt={currentCase.title}
                            className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                          />
                        </div>
                      )}
                        {currentCaseFrontImages.length > 0 && (
                          <div className="grid grid-cols-1 gap-2">
                            {currentCaseFrontImages.map((url) => (
                              <div key={url} className="overflow-hidden rounded-2xl border border-slate-100">
                                <img src={url} alt={currentCase.title} className="w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="case-text text-sm text-slate-600">{currentCase.prompt}</p>
                    </div>
                    </>
                  ) : (
                    <div className="m-auto text-center text-slate-500">Кейсы для выбранной темы пока не добавлены.</div>
                  )}
                    </div>
                  </div>
                  <div className="card-3d-face card-3d-back">
                    <div
                      className={`card-3d-content custom-scrollbar ${mode === 'cards' ? 'justify-center' : 'text-left'}`}
                      ref={backContentRef}
                      onWheelCapture={handleBackWheel}
                      onTouchStartCapture={() => {
                        touchMovedRef.current = false;
                      }}
                      onTouchMoveCapture={() => {
                        touchMovedRef.current = true;
                      }}
                      onTouchEndCapture={handleTouchEnd}
                      onClickCapture={handleContentClick}
                    >
                      {mode === 'cards' ? (
                        currentCard ? (
                          <>
                          <div className="flex items-center justify-between">
                            <span className="uppercase text-xs tracking-[0.35em] text-emerald-600 font-semibold">Ответ</span>
                            {currentCardStatus && CARD_STATUS_CONFIG[currentCardStatus] && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                                <span className={`h-2 w-2 rounded-full ${CARD_STATUS_CONFIG[currentCardStatus].accent}`} />
                                {CARD_STATUS_CONFIG[currentCardStatus].label}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-lg sm:text-xl leading-relaxed text-slate-800">{currentCard.answer}</p>
                          <div className="text-xs uppercase tracking-widest text-slate-500">
                            {CARD_STATUS_CONFIG[currentCardStatus ?? 'dontknow']?.description ??
                              'Отметьте результат, чтобы карточка попала в нужный список.'}
                          </div>
                        </>
                      ) : (
                        <div className="m-auto text-center text-slate-500">Добавьте карточки, чтобы отработать тему.</div>
                      )
                    ) : currentCase ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="uppercase text-xs tracking-[0.35em] text-brand font-semibold">Решение</span>
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] ${CASE_STATUS_CONFIG[currentCaseStatus].badge}`}
                          >
                            {CASE_STATUS_CONFIG[currentCaseStatus].label}
                          </span>
                        </div>
                        <p className="case-text text-base text-slate-800">
                          {currentCase.solution}
                        </p>
                        {currentCase.logo_url && (
                          <div className="flex">
                            <img
                              src={currentCase.logo_url}
                              alt={currentCase.title}
                              className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                            />
                          </div>
                        )}
                        {currentCaseBackImages.length > 0 && (
                          <div className="grid grid-cols-1 gap-2">
                            {currentCaseBackImages.map((url) => (
                              <div key={url} className="overflow-hidden rounded-2xl border border-slate-100">
                                <img src={url} alt={currentCase.title} className="w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-xs uppercase tracking-widest text-slate-500">
                          {CASE_STATUS_CONFIG[currentCaseStatus].description}
                        </div>
                      </>
                    ) : (
                      <div className="m-auto text-center text-slate-500">Добавьте кейсы, чтобы тренироваться.</div>
                    )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {datasetTotal === 0 ? 0 : currentIndex + 1} из {datasetTotal}
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-brand-light animate-pulse-glow" />
                  Нажмите на карточку, чтобы перевернуть
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[2.6rem] border border-white/60 bg-gradient-to-br from-white/90 via-white/70 to-brand/10 p-6 shadow-[0_26px_72px_rgba(15,23,42,0.14)]">
            {mode === 'cards' ? (
              <>
                <h3 className="text-lg font-semibold text-slate-900">Как оцените карточку?</h3>
                <button
                  onClick={() => handleCardAnswer('know')}
                  className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-400/30 transition hover:bg-emerald-500/90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!currentCard}
                >
                  Знаю хорошо
                </button>
                <button
                  onClick={() => handleCardAnswer('unsure')}
                  className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-300/30 transition hover:bg-amber-400/90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!currentCard}
                >
                  Не уверен, нужно повторить
                </button>
                <button
                  onClick={() => handleCardAnswer('dontknow')}
                  className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-400/30 transition hover:bg-rose-500/90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!currentCard}
                >
                  Не знаю тему
                </button>
                <div className="rounded-2xl border border-white/60 bg-white/85 px-4 py-4 text-sm text-slate-600 shadow-[0_18px_45px_rgba(37,99,235,0.12)]">
                  <p>Карточек в подборке: {cardItems.length}</p>
                  <p>
                    На повторении: {cardReviewCounts.unsure + cardReviewCounts.dontknow} ({cardReviewCounts.unsure} «не уверен» · {cardReviewCounts.dontknow} «не знаю»)
                  </p>
                  {currentCard && (
                    <p>
                      Сложность карточки: <span className="font-semibold text-slate-900">{currentCardDifficultyMeta.label}</span>
                    </p>
                  )}
                  {selected === ALL_CATEGORY && (
                    <p className="mt-2 text-xs text-slate-500">
                      В режиме «Все темы» карточки выдаются в случайном порядке. Используйте фильтры, чтобы сфокусироваться на разделе.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-900">Статус решения</h3>
                <button
                  onClick={() => handleCaseStatusUpdate('done')}
                  className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-400/30 transition hover:bg-emerald-500/90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!currentCase}
                >
                  Отметить как решённый
                </button>
                <button
                  onClick={() => handleCaseStatusUpdate('in_progress')}
                  className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-300/30 transition hover:bg-amber-400/90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!currentCase}
                >
                  Нужна доработка / обсудить
                </button>
	                <div
	                  className={`flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-2xl border px-5 py-5 text-sm text-slate-600 transition sm:min-h-[260px] ${
	                    currentCase
	                      ? isFlipped
	                        ? 'border-brand/40 bg-white/95 shadow-[0_20px_50px_rgba(37,99,235,0.18)]'
	                        : 'border-white/60 bg-white/80 opacity-85'
	                      : 'border-white/40 bg-white/60 opacity-60'
	                  }`}
	                >
	                  <h4 className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-dark">Комментарий от Тимура</h4>
	                  <div className="mt-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
	                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed">
	                      {currentCase ? currentCaseComment : 'Выберите кейс, чтобы увидеть комментарий наставника.'}
	                    </p>
	                  </div>
	                  {!isFlipped && currentCase && (
	                    <p className="mt-3 text-xs text-slate-500">Переверни карточку, чтобы открыть решение и комментарий.</p>
	                  )}
	                </div>
                <div className="rounded-2xl border border-white/60 bg-white/85 px-4 py-4 text-sm text-slate-600 shadow-[0_18px_45px_rgba(37,99,235,0.12)]">
                  <p>Кейсов в подборке: {caseItems.length}</p>
                  <p>Решено: {caseStatusCounts.done}</p>
                  <p>В работе: {caseStatusCounts.in_progress}</p>
                  <p>Не начинал: {caseStatusCounts.todo}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
