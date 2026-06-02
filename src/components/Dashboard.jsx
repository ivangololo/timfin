import { useEffect, useMemo, useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';
import ProgressCard from './ProgressCard.jsx';
import BrandLogo from '../assets/brand-logo.png';
import TaskPlanner from './TaskPlanner.jsx';

const QUICK_MODULE_KEYS = new Set(['trainer', 'review']);
const NAVIGATION_KEYS = ['trainer', 'homework', 'knowledge-personal', 'schedule'];

const baseModules = [
  {
    key: 'trainer',
    view: 'trainer',
    title: 'Карточки и кейсы',
    description: 'Объединённый тренажёр: карточки, кейсы и комментарии наставника.',
  },
  {
    key: 'homework',
    view: 'homework',
    title: 'Домашние задания',
    description: 'Назначенные задания, отправка решений и комментарии наставника.',
  },
  {
    key: 'knowledge-personal',
    view: 'knowledge',
    title: 'Моя теория',
    description: 'Презентации и шпоры от наставника, доступные в две вкладки.',
    options: { tab: 'presentations' },
  },
  {
    key: 'schedule',
    view: 'schedule',
    title: 'Олимпиады и мероприятия',
    description: 'Расписание, регистрация и статусы участия.',
  },
  {
    key: 'review',
    view: 'review',
    title: 'Повторение',
    description: 'Карточки «Не знаю» и «Не уверен» для точечной проработки.',
  },
];

export default function Dashboard({
  user,
  progress,
  totals,
  reviewSummary,
  caseTotals = {},
  caseProgress = {},
  caseSummary,
  tasks,
  onTaskCreate,
  onTaskStatusChange,
  onTaskDelete,
  onNavigate,
  onLogout,
  homeworkPendingCount = 0,
  presentationCount = 0,
  cheatsheetCount = 0,
}) {
  const [progressMode, setProgressMode] = useState('cards');
  const [activeProgress, setActiveProgress] = useState('cards:overall');

  const moduleCards = useMemo(() => [...baseModules], []);
  const progressModeOptions = useMemo(
    () => [
      { id: 'cards', label: 'Карточки' },
      { id: 'cases', label: 'Кейсы' },
    ],
    [],
  );

  const totalCards = Object.values(totals).reduce((sum, count) => sum + count, 0);
  const masteredCards = Object.values(progress).reduce((sum, count) => sum + count, 0);
  const completion = totalCards === 0 ? 0 : Math.round((masteredCards / totalCards) * 100);
  const reviewTotal = reviewSummary?.total ?? 0;
  const reviewUnsure = reviewSummary?.byStatus?.unsure ?? 0;
  const reviewDontKnow = reviewSummary?.byStatus?.dontknow ?? 0;

  const sortedCategories = useMemo(() => Object.keys(totals).sort((a, b) => a.localeCompare(b, 'ru')), [totals]);
  const totalCases = caseSummary?.total ?? Object.values(caseTotals).reduce((sum, count) => sum + count, 0);
  const solvedCases = caseSummary?.byStatus?.done ?? 0;
  const casesInProgress = caseSummary?.byStatus?.in_progress ?? 0;
  const casesTodo = Math.max(totalCases - solvedCases - casesInProgress, 0);
  const caseCategorySummary = useMemo(() => caseSummary?.byCategory ?? {}, [caseSummary?.byCategory]);

  const progressDatasets = useMemo(() => {
    const cardCategoryEntries = sortedCategories.map((category) => ({
      key: `cards:${category}`,
      title: category,
      total: totals[category] ?? 0,
      value: progress[category] ?? 0,
      reviewCount: reviewSummary?.byCategory?.[category] ?? 0,
      unitLabel: 'карточек',
      valueLabel: 'освоено',
      reviewLabel: 'На повторении',
      emptyReviewLabel: 'Повторение не требуется',
      type: 'cards',
    }));

    const caseCategoryEntries = sortedCategories.map((category) => {
      const total = caseTotals[category] ?? 0;
      const solved = caseProgress[category] ?? 0;
      const status = caseCategorySummary[category] ?? { todo: 0, in_progress: 0, done: 0 };
      const inProgressCount = status.in_progress ?? 0;
      const todoCount = Math.max(total - solved - inProgressCount, 0);
      return {
        key: `cases:${category}`,
        title: category,
        total,
        value: solved,
        reviewCount: inProgressCount,
        todoCount,
        unitLabel: 'кейсов',
        valueLabel: 'решено',
        reviewLabel: 'В работе',
        emptyReviewLabel: 'В работе нет кейсов',
        type: 'cases',
      };
    });

    return {
      cards: [
        {
          key: 'cards:overall',
          title: 'Карточки',
          total: totalCards,
          value: masteredCards,
          reviewCount: reviewTotal,
          unitLabel: 'карточек',
          valueLabel: 'освоено',
          reviewLabel: 'На повторении',
          emptyReviewLabel: 'Повторение не требуется',
          type: 'cards',
        },
        ...cardCategoryEntries,
      ],
      cases: [
        {
          key: 'cases:overall',
          title: 'Кейсы',
          total: totalCases,
          value: solvedCases,
          reviewCount: casesInProgress,
          todoCount: casesTodo,
          unitLabel: 'кейсов',
          valueLabel: 'решено',
          reviewLabel: 'В работе',
          emptyReviewLabel: 'Нет активных кейсов',
          type: 'cases',
        },
        ...caseCategoryEntries,
      ],
    };
  }, [
    sortedCategories,
    totals,
    progress,
    reviewSummary?.byCategory,
    totalCards,
    masteredCards,
    reviewTotal,
    totalCases,
    solvedCases,
    casesInProgress,
    casesTodo,
    caseTotals,
    caseProgress,
    caseCategorySummary,
  ]);

  const currentDataset = useMemo(() => progressDatasets[progressMode] ?? [], [progressDatasets, progressMode]);

  useEffect(() => {
    if (!currentDataset.length) return;
    const keys = currentDataset.map((entry) => entry.key);
    if (!keys.includes(activeProgress)) {
      setActiveProgress(keys[0]);
    }
  }, [currentDataset, activeProgress]);

  const taskStats = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] ?? 0) + 1;
        return acc;
      },
      { todo: 0, in_progress: 0, done: 0 },
    );
  }, [tasks]);

  const quickModules = moduleCards.filter((module) => QUICK_MODULE_KEYS.has(module.key));
  const navigationModules = useMemo(() => {
    const modulesByKey = Object.fromEntries(moduleCards.map((module) => [module.key, module]));
    return NAVIGATION_KEYS.map((key) => modulesByKey[key]).filter(Boolean);
  }, [moduleCards]);

  const progressDetail = useMemo(() => {
    if (progressMode === 'overall') {
      if (activeProgress === 'cards:overall') {
        const remaining = Math.max(totalCards - masteredCards - reviewTotal, 0);
        return {
          title: 'Карточки',
          description:
            'Общее состояние по карточкам: продолжайте работу в тренажёре и закрывайте карточки из блока повторения.',
          stats: [
            {
              label: 'Изучено',
              value: `${masteredCards} / ${totalCards}`,
              helper: `${completion}% карточек освоено`,
            },
            {
              label: 'На повторении',
              value: reviewTotal,
              helper: `Не уверен: ${reviewUnsure} · Не знаю: ${reviewDontKnow}`,
            },
            {
              label: 'Осталось изучить',
              value: remaining,
              helper: remaining === 0 ? 'Все карточки освоены' : 'Ещё не отмечены как «Знаю»',
            },
          ],
          action: () => onNavigate('trainer'),
          reviewAction: () => onNavigate('review'),
        };
      }

      if (activeProgress === 'cases:overall') {
        const solvedPercentage = totalCases === 0 ? 0 : Math.round((solvedCases / totalCases) * 100);
        return {
          title: 'Кейсы',
          description:
            'Итог по практическим кейсам. Отмечайте выполненные задания и планируйте доработку оставшихся кейсов.',
          stats: [
            {
              label: 'Решено',
              value: `${solvedCases} / ${totalCases}`,
              helper: `${solvedPercentage}% кейсов отмечено как решённые`,
            },
            {
              label: 'В работе',
              value: casesInProgress,
              helper: casesInProgress === 0 ? 'Нет кейсов в работе' : 'Продолжай работу и отправляй решения',
            },
            {
              label: 'Не начато',
              value: casesTodo,
              helper: casesTodo === 0 ? 'Все кейсы распределены' : 'Запланируй время на оставшиеся задания',
            },
          ],
          action: () => onNavigate('trainer', { mode: 'cases' }),
        };
      }

      const combinedRemaining = Math.max(totalCards + totalCases - (masteredCards + solvedCases) - (reviewTotal + casesInProgress), 0);
      return {
        title: 'Общий прогресс',
        description:
          'Сводная картина по карточкам и кейсам. Используй тренажёр и планировщик задач, чтобы удерживать комфортный темп подготовки.',
        stats: [
          {
            label: 'Завершено',
            value: `${masteredCards + solvedCases} / ${totalCards + totalCases}`,
            helper: `${totalCards + totalCases === 0 ? 0 : Math.round(((masteredCards + solvedCases) / (totalCards + totalCases)) * 100)}% всех заданий`,
          },
          {
            label: 'На повторении и в работе',
            value: reviewTotal + casesInProgress,
            helper: `Карточки: ${reviewTotal} · Кейсы: ${casesInProgress}`,
          },
          {
            label: 'Без статуса',
            value: combinedRemaining,
            helper: combinedRemaining === 0 ? 'Все задания распределены' : 'Назначь статус или добавь в план',
          },
        ],
        action: () => onNavigate('trainer'),
      };
    }

    if (progressMode === 'cards') {
      if (activeProgress === 'cards:overall') {
        const remaining = Math.max(totalCards - masteredCards - reviewTotal, 0);
        return {
          title: 'Карточки · общий прогресс',
          description:
            'Детальный прогресс по всем карточкам. Планируй повторение и отмечай изученные темы.',
          stats: [
            {
              label: 'Изучено',
              value: `${masteredCards} / ${totalCards}`,
              helper: `${completion}% карточек освоено`,
            },
            {
              label: 'На повторении',
              value: reviewTotal,
              helper: `Не уверен: ${reviewUnsure} · Не знаю: ${reviewDontKnow}`,
            },
            {
              label: 'Осталось изучить',
              value: remaining,
              helper: remaining === 0 ? 'Все карточки освоены' : 'Ещё не отмечены как «Знаю»',
            },
          ],
          action: () => onNavigate('trainer'),
          reviewAction: () => onNavigate('review'),
        };
      }

      const category = activeProgress.replace('cards:', '');
      const total = totals[category] ?? 0;
      const learned = progress[category] ?? 0;
      const reviewCount = reviewSummary?.byCategory?.[category] ?? 0;
      const categoryStatus = reviewSummary?.byCategoryStatus?.[category] ?? { unsure: 0, dontknow: 0 };
      const remaining = Math.max(total - learned - reviewCount, 0);
      const percentage = total === 0 ? 0 : Math.round((learned / total) * 100);

      return {
        title: category,
        description:
          'Подробности по выбранной теме карточек. Повторите сложные вопросы и вернитесь в тренажёр для закрепления.',
        stats: [
          {
            label: 'Изучено',
            value: `${learned} / ${total}`,
            helper: `${percentage}% карточек отмечено как «Знаю»`,
          },
          {
            label: 'На повторении',
            value: reviewCount,
            helper: `Не уверен: ${categoryStatus.unsure ?? 0} · Не знаю: ${categoryStatus.dontknow ?? 0}`,
          },
          {
            label: 'Осталось изучить',
            value: remaining,
            helper: remaining === 0 ? 'Раздел закрыт' : 'Пока без статуса',
          },
        ],
        action: () => onNavigate('trainer', { category }),
        reviewAction: () => onNavigate('review'),
      };
    }

    if (progressMode === 'cases') {
      if (activeProgress === 'cases:overall') {
        const solvedPercentage = totalCases === 0 ? 0 : Math.round((solvedCases / totalCases) * 100);
        return {
          title: 'Кейсы · общий прогресс',
          description:
            'Итоги по всем кейсам. Используйте тренажёр для загрузки решений и получения комментариев наставника.',
          stats: [
            {
              label: 'Решено',
              value: `${solvedCases} / ${totalCases}`,
              helper: `${solvedPercentage}% кейсов закрыто`,
            },
            {
              label: 'В работе',
              value: casesInProgress,
              helper: casesInProgress === 0 ? 'Нет активных кейсов' : 'Продолжи работу над кейсами в процессе',
            },
            {
              label: 'Не начато',
              value: casesTodo,
              helper: casesTodo === 0 ? 'Все кейсы распределены' : 'Добавь оставшиеся кейсы в план',
            },
          ],
          action: () => onNavigate('trainer', { mode: 'cases' }),
        };
      }

      const category = activeProgress.replace('cases:', '');
      const total = caseTotals[category] ?? 0;
      const solved = caseProgress[category] ?? 0;
      const status = caseCategorySummary[category] ?? { todo: 0, in_progress: 0, done: 0 };
      const inProgressCount = status.in_progress ?? 0;
      const todoCount = Math.max(total - solved - inProgressCount, 0);
      const solvedPercentage = total === 0 ? 0 : Math.round((solved / total) * 100);

      return {
        title: category,
        description:
          'Статус по выбранной теме кейсов. Отмечайте решения и фиксируйте кейсы, которые стоит разобрать дополнительно.',
        stats: [
          {
            label: 'Решено',
            value: `${solved} / ${total}`,
            helper: `${solvedPercentage}% кейсов закрыто`,
          },
          {
            label: 'В работе',
            value: inProgressCount,
            helper: inProgressCount === 0 ? 'Нет кейсов в работе' : 'Не забудь отправить решение наставнику',
          },
          {
            label: 'Не начато',
            value: todoCount,
            helper: todoCount === 0 ? 'Все кейсы распределены' : 'Добавь эти кейсы в ближайший план',
          },
        ],
        action: () => onNavigate('trainer', { category, mode: 'cases' }),
      };
    }

    return null;
  }, [
    progressMode,
    activeProgress,
    totalCards,
    masteredCards,
    reviewTotal,
    reviewUnsure,
    reviewDontKnow,
    completion,
    totals,
    progress,
    reviewSummary?.byCategory,
    reviewSummary?.byCategoryStatus,
    onNavigate,
    caseTotals,
    caseProgress,
    caseCategorySummary,
    totalCases,
    solvedCases,
    casesInProgress,
    casesTodo,
  ]);

  const casesCompletion = totalCases === 0 ? 0 : Math.round((solvedCases / totalCases) * 100);

  const overviewItems = [
    {
      label: 'Карточки',
      value: `${completion}%`,
      helper: `Знаю ${masteredCards} из ${totalCards} · На повторении: ${reviewTotal}`,
    },
    {
      label: 'Кейсы',
      value: `${casesCompletion}%`,
      helper: `Решено ${solvedCases} · В работе: ${casesInProgress}`,
    },
    {
      label: 'Задачи',
      value: tasks.length,
      helper: `В работе: ${taskStats.in_progress} · Запланировано: ${taskStats.todo}`,
    },
    {
      label: 'Материалы',
      value: presentationCount + cheatsheetCount,
      helper: `Презентации: ${presentationCount} · Шпоры: ${cheatsheetCount}`,
    },
    {
      label: 'Домашние задания',
      value: homeworkPendingCount,
      helper: 'В работе или на проверке',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent">
      <AmbientBackdrop />
      <div className="relative mx-auto w-full max-w-7xl px-5 py-8 space-y-8 sm:px-6 sm:py-16 sm:space-y-12">
        <section className="grid gap-5 rounded-[2.75rem] border border-white/60 bg-white/80 p-5 shadow-[0_35px_95px_rgba(15,23,42,0.18)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_320px] sm:gap-8 sm:p-10">
          <div className="flex flex-col gap-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-full flex justify-center sm:justify-start">
                      <img src={BrandLogo} alt="Логотип" className="h-10 w-auto object-contain sm:h-14" />
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-brand-dark">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    Личный кабинет
                  </span>
                  <h1 className="text-3xl font-display font-semibold text-slate-900 sm:text-5xl">
                    Привет, {user.name}!
                  </h1>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                    <span className="text-xs uppercase tracking-[0.32em] text-slate-400">Код доступа</span>
                    <span className="font-mono text-base text-slate-900">{user.code ?? '—'}</span>
                  </div>
                  <p className="max-w-xl text-sm text-slate-500 sm:text-base">
                    Выберите направление, тренируйтесь в удобном темпе и контролируйте прогресс — все разделы платформы собраны на одной странице.
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white/70 px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand/10"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 4a2 2 0 012-2h5a2 2 0 012 2v1a1 1 0 102 0V4a4 4 0 00-4-4H5a4 4 0 00-4 4v12a4 4 0 004 4h5a4 4 0 004-4v-1a1 1 0 10-2 0v1a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <path d="M12.293 7.293a1 1 0 011.414 0L16 9.586l2.293-2.293a1 1 0 111.414 1.414L17.414 11l2.293 2.293a1 1 0 01-1.414 1.414L16 12.414l-2.293 2.293a1 1 0 01-1.414-1.414L14.586 11l-2.293-2.293a1 1 0 010-1.414z" />
                  </svg>
                  Выйти
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Быстрый старт</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {quickModules.map((module) => (
                  <button
                    key={module.key}
                    onClick={() => onNavigate(module.view, module.options ?? {})}
                    className="glow-border hover-glow flex items-center justify-between rounded-2xl border border-white/60 bg-gradient-to-r from-white/90 via-white/70 to-brand/10 px-5 py-4 text-left shadow-[0_20px_45px_rgba(14,165,233,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                  >
                    <div className="space-y-1">
                      <span className="text-sm font-semibold text-slate-900">{module.title}</span>
                      <p className="text-xs text-slate-500">{module.description}</p>
                    </div>
                    <svg className="h-4 w-4 text-brand" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                    </svg>
                  </button>
                ))}
              </div>
              {user?.isAdmin && (
                <div className="mt-4">
                  <button
                    onClick={() => onNavigate('admin')}
                    className="glow-border hover-glow inline-flex w-full items-center justify-between rounded-2xl border border-white/60 bg-gradient-to-r from-brand/10 via-white/80 to-accent/10 px-5 py-4 text-sm font-semibold text-brand-dark shadow-[0_20px_45px_rgba(2,132,199,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2a1 1 0 01.894.553l1.447 2.894 3.197.465a1 1 0 01.554 1.706l-2.312 2.254.546 3.185a1 1 0 01-1.452 1.054L10 12.347l-2.874 1.51a1 1 0 01-1.452-1.054l.546-3.185-2.312-2.254a1 1 0 01.554-1.706l3.197-.465L9.106 2.553A1 1 0 0110 2z" />
                      </svg>
                      Админ-панель
                    </span>
                    <svg className="h-4 w-4 text-brand" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5 rounded-3xl border border-white/50 bg-gradient-to-br from-white/85 via-white/70 to-brand/10 p-6 shadow-[0_20px_65px_rgba(15,23,42,0.12)]">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-brand-light animate-pulse-glow" />
              Обзор
            </p>
            <div className="space-y-4">
              {overviewItems.map((item) => (
                <div
                  key={item.label}
                  className="hover-glow flex flex-col gap-1 rounded-2xl border border-white/60 bg-white/90 px-4 py-4 transition"
                >
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{item.label}</span>
                  <span className="text-2xl font-semibold text-slate-900">{item.value}</span>
                  <span className="text-xs text-slate-500">{item.helper}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Навигация по платформе</h2>
              <p className="text-sm text-slate-500 sm:text-base">Основные разделы обучения и инструменты управления.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {navigationModules.map((module) => (
              <button
                key={module.key}
                onClick={() => onNavigate(module.view, module.options ?? {})}
                className="group glow-border hover-glow flex h-full flex-col gap-3 rounded-3xl border border-white/50 bg-gradient-to-br from-white/90 via-white/70 to-brand/10 px-5 py-5 text-left text-sm shadow-[0_20px_45px_rgba(15,23,42,0.08)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 sm:px-6 sm:py-6"
              >
                <div className="space-y-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a1 1 0 011 1v6h6a1 1 0 110 2h-6v6a1 1 0 11-2 0v-6H3a1 1 0 110-2h6V3a1 1 0 011-1z" />
                    </svg>
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">{module.title}</h3>
                  <p className="text-sm text-slate-500">{module.description}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  Открыть
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Прогресс по направлениям</h2>
              <p className="text-sm text-slate-500 sm:text-base">
                Переключайте режим, отслеживайте карточки и кейсы по темам, возвращайтесь к разделам для повторения и закрепления.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-2xl border border-white/60 bg-white/80 p-1 shadow-inner">
                {progressModeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setProgressMode(option.id)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      progressMode === option.id ? 'bg-brand text-white shadow-lg shadow-brand/25' : 'text-slate-600 hover:bg-brand/10'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {progressMode !== 'cases' && (
                <button
                  onClick={() => onNavigate('review')}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white/80 px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand/10"
                >
                  Повторить карточки
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                  </svg>
                </button>
              )}
              {progressMode === 'cases' && (
                <button
                  onClick={() => onNavigate('review')}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white/80 px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand/10"
                >
                  Повторить кейсы
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            {currentDataset.map((card) => (
              <ProgressCard
                key={card.key}
                title={card.title}
                total={card.total}
                value={card.value}
                reviewCount={card.reviewCount}
                unitLabel={card.unitLabel}
                valueLabel={card.valueLabel}
                reviewLabel={card.reviewLabel}
                emptyReviewLabel={card.emptyReviewLabel}
                onClick={() => setActiveProgress(card.key)}
                active={activeProgress === card.key}
              />
            ))}
            {currentDataset.length === 0 && (
              <div className="rounded-3xl border border-white/60 bg-white/85 px-6 py-10 text-center text-slate-500 shadow-[0_18px_38px_rgba(37,99,235,0.08)]">
                Нет данных для отображения. Добавьте карточки или кейсы в выбранном режиме.
              </div>
            )}
          </div>
          {progressDetail && (
            <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/85 via-white/70 to-brand/10 p-5 text-sm shadow-[0_28px_75px_rgba(15,23,42,0.12)] sm:text-base">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl space-y-2">
                  <h3 className="text-xl font-semibold text-slate-900">{progressDetail.title}</h3>
                  <p className="text-sm text-slate-500">{progressDetail.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => progressDetail.action?.()}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark"
                    type="button"
                  >
                    Учиться в тренажёре
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                    </svg>
                  </button>
                  {progressDetail.reviewAction && (
                    <button
                      onClick={() => progressDetail.reviewAction?.()}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                      type="button"
                    >
                      Перейти к повторению
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {progressDetail.stats.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col gap-1 rounded-2xl border border-white/60 bg-white/90 px-4 py-4 shadow-[0_18px_38px_rgba(37,99,235,0.08)]"
                  >
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{item.label}</span>
                    <span className="text-2xl font-semibold text-slate-900">{item.value}</span>
                    {item.helper && <span className="text-xs text-slate-500">{item.helper}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[2.75rem] border border-white/60 bg-white/85 p-8 shadow-[0_32px_95px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">План задач</h2>
              <p className="text-sm text-slate-500 sm:text-base">
                Управляйте задачами по обучению: перетаскивайте карточки между колонками, фиксируйте новые активности и отмечайте завершённые цели.
              </p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-xs text-slate-500 shadow-inner">
              Запланировано: {taskStats.todo} · В работе: {taskStats.in_progress} · Готово: {taskStats.done}
            </div>
          </div>
          <div className="mt-6">
            <TaskPlanner tasks={tasks} onCreate={onTaskCreate} onStatusChange={onTaskStatusChange} onDelete={onTaskDelete} />
          </div>
        </section>
      </div>
    </div>
  );
}
