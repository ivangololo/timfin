import { useCallback, useEffect, useMemo, useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';
import HomeworkManager from './admin/HomeworkManager.jsx';

const TABS = [
  { id: 'users', label: 'Пользователи' },
  { id: 'requests', label: 'Заявки на доступ' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'assignments', label: 'Задачи' },
  { id: 'cards', label: 'Карточки' },
  { id: 'practice', label: 'Кейсы' },
  { id: 'knowledge', label: 'Теория (презентации/шпоры)' },
  { id: 'schedule', label: 'Расписание' },
  { id: 'recipients', label: 'Получатели ДЗ' },
  { id: 'homework', label: 'Домашние задания' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Лёгкая' },
  { value: 'medium', label: 'Средняя' },
  { value: 'hard', label: 'Сложная' },
];

const KNOWLEDGE_TYPE_OPTIONS = [
  { value: 'pdf', label: 'Презентация (PDF)' },
  { value: 'image', label: 'Шпора (изображение)' },
];

const SCHEDULE_STATUS_OPTIONS = [
  { value: 'open', label: 'Открытая запись' },
  { value: 'waitlist', label: 'Лист ожидания' },
  { value: 'closed', label: 'Закрыто' },
];

const emptyCardForm = {
  id: null,
  category: '',
  question: '',
  answer: '',
  difficulty: 'medium',
};

const emptyPracticeForm = {
  id: null,
  category: 'Налоги',
  title: '',
  prompt: '',
  solution: '',
  points: '',
  difficulty: 'medium',
  mentor_comment: '',
  image_url: '',
  images_front: [],
  images_back: [],
  logo_url: '',
};

const emptyKnowledgeForm = {
  id: null,
  category: '',
  title: '',
  description: '',
  type: 'pdf',
  url: '',
  content: '',
  difficulty: 'medium',
  tags: '',
};

const emptyScheduleForm = {
  id: null,
  title: '',
  status: 'open',
  date: '',
  start: '',
  end: '',
  format: '',
  level: '',
  registration: '',
  registration_start: '',
  registration_end: '',
  registration_url: '',
  logo_url: '',
  date_meta: null,
  date_type: 'single',
  date_single: '',
  date_range_start: '',
  date_range_end: '',
  multiple_dates: [''],
};

const emptyPersonalForm = {
  resourceId: '',
  title: '',
  description: '',
  type: 'pdf',
  url: '',
  content: '',
  difficulty: 'medium',
  tags: '',
};

const DEFAULT_CATEGORY = 'Без категории';

const parseTags = (raw) =>
  raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const stringifyTags = (tags) => (Array.isArray(tags) ? tags.join(', ') : tags ?? '');

const difficultyLabel = (value) => DIFFICULTY_OPTIONS.find((option) => option.value === value)?.label ?? 'Средняя';

const normalizeImageList = (...sources) => {
  const result = [];
  const seen = new Set();
  const add = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    const url = typeof value === 'string' ? value.trim() : String(value?.file_url ?? value?.url ?? '').trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return;
    const normalized = url.replace(/\s/g, '%20');
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  };
  sources.forEach(add);
  return result;
};

export default function AdminPanel({
  user,
  cards,
  practiceCases,
  knowledgeResources,
  scheduleItems,
  homeworkAssignments,
  homeworkSubmissions,
  adminApi,
  homeworkSupportsTargets = true,
  homeworkRecipients = [],
  homeworkRecipientsSupported = true,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState('users');
  const [feedback, setFeedback] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [lastNonHomeworkTab, setLastNonHomeworkTab] = useState('users');
  const [recipientRules, setRecipientRules] = useState(homeworkRecipients ?? []);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const recipientsSupported = homeworkRecipientsSupported !== false;

  const refreshHandlers = useMemo(
    () => ({
      cards: adminApi?.refresh?.cards,
      practice: adminApi?.refresh?.practice,
      knowledge: adminApi?.refresh?.knowledge,
      theory: adminApi?.refresh?.theory,
      schedule: adminApi?.refresh?.schedule,
      homework: adminApi?.refresh?.homework,
    }),
    [adminApi],
  );

  const handleStatus = useCallback(
    (type, message) => {
      if (message) {
        setFeedback({ type, message });
      } else {
        setFeedback(null);
      }
    },
    [setFeedback],
  );

  const handleRefresh = async () => {
    const refresh = refreshHandlers[activeTab];
    if (!refresh) return;
    try {
      await refresh();
      handleStatus('success', 'Данные обновлены.');
    } catch (error) {
      handleStatus('error', error instanceof Error ? error.message : 'Не удалось обновить данные.');
    }
  };

  const canRefresh = Boolean(refreshHandlers[activeTab]);

  useEffect(() => {
    setFeedback(null);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'homework') {
      setLastNonHomeworkTab(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    let isCancelled = false;
    const loadProfiles = async () => {
      if (!adminApi?.users?.list) return;
      try {
        const result = await adminApi.users.list();
        if (!isCancelled) {
          setAllProfiles(Array.isArray(result) ? result : []);
        }
      } catch (error) {
        console.warn('Не удалось загрузить список профилей для домашних заданий', error);
      }
    };
    loadProfiles();
    return () => {
      isCancelled = true;
    };
  }, [adminApi]);

  useEffect(() => {
    setRecipientRules(homeworkRecipients ?? []);
  }, [homeworkRecipients]);

  const loadRecipients = useCallback(async () => {
    if (!adminApi?.homeworkRecipients?.list || !recipientsSupported) return;
    setRecipientsLoading(true);
    try {
      const data = await adminApi.homeworkRecipients.list();
      const rules = Array.isArray(data) ? data : data?.rules ?? [];
      setRecipientRules(rules);
    } catch (error) {
      console.warn('Не удалось загрузить получателей ДЗ', error);
      handleStatus('error', error.message ?? 'Не удалось загрузить получателей ДЗ.');
    } finally {
      setRecipientsLoading(false);
    }
  }, [adminApi?.homeworkRecipients, handleStatus, recipientsSupported]);

  useEffect(() => {
    if (activeTab === 'recipients' || activeTab === 'homework') {
      loadRecipients();
    }
  }, [activeTab, loadRecipients]);

  useEffect(() => {
    const mine = (recipientRules ?? [])
      .filter((rule) => String(rule.reviewer_id) === String(user?.id))
      .map((rule) => String(rule.student_id));
    setSelectedRecipients(mine);
  }, [recipientRules, user?.id]);

  const handleToggleRecipient = (studentId) => {
    const normalizedId = String(studentId);
    setSelectedRecipients((prev) => {
      const current = prev.map(String);
      if (current.includes(normalizedId)) {
        return current.filter((id) => id !== normalizedId);
      }
      return [...current, normalizedId];
    });
    setFeedback(null);
  };

  const handleRenameCardCategory = async (oldName, newName) => {
    if (!oldName) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      handleStatus('error', 'Введите новое название категории.');
      return;
    }
    const target = trimmed;
    const cardsToUpdate = (cards ?? []).filter((card) => card.category === oldName);
    if (cardsToUpdate.length === 0) {
      // Категория могла быть добавлена вручную, просто убираем её из списка.
      setCustomCategories((prev) => prev.filter((name) => name !== oldName));
      handleStatus('success', 'Тема удалена из списка.');
      return;
    }
    try {
      handleStatus(null, null);
      await Promise.all([
        ...cardsToUpdate.map((card) => adminApi.cards.update?.(card.id, { ...card, category: target })),
      ]);
      handleStatus('success', 'Категория карточек обновлена.');
      await refreshHandlers.cards?.();
    } catch (error) {
      handleStatus('error', error instanceof Error ? error.message : 'Не удалось обновить категорию карточек.');
    }
  };

  const handleRenameCaseCategory = async (oldName, newName) => {
    if (!oldName) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      handleStatus('error', 'Введите новое название категории.');
      return;
    }
    const target = trimmed;
    const casesToUpdate = (practiceCases ?? []).filter((item) => item.category === oldName);
    if (casesToUpdate.length === 0) {
      setCustomCategories((prev) => prev.filter((name) => name !== oldName));
      handleStatus('success', 'Тема удалена из списка.');
      return;
    }
    try {
      handleStatus(null, null);
      await Promise.all(casesToUpdate.map((item) => adminApi.practice.update?.(item.id, { ...item, category: target })));
      handleStatus('success', 'Категория кейсов обновлена.');
      await refreshHandlers.practice?.();
    } catch (error) {
      handleStatus('error', error instanceof Error ? error.message : 'Не удалось обновить категорию кейсов.');
    }
  };

  const handleSaveRecipients = async () => {
    if (!adminApi?.homeworkRecipients?.saveForReviewer) return;
    setRecipientsLoading(true);
    try {
      const result = await adminApi.homeworkRecipients.saveForReviewer(user?.id, selectedRecipients);
      if (result?.supported === false) {
        handleStatus('error', 'Маршрутизация получателей недоступна.');
        return;
      }
      const rules = Array.isArray(result) ? result : result?.rules ?? [];
      setRecipientRules((prev) => {
        const filtered = (prev ?? []).filter((rule) => String(rule.reviewer_id) !== String(user?.id));
        return [...filtered, ...rules];
      });
      handleStatus('success', 'Список получателей ДЗ обновлён.');
    } catch (error) {
      handleStatus('error', error.message ?? 'Не удалось сохранить получателей.');
    } finally {
      setRecipientsLoading(false);
    }
  };

  const cardCategoryOptions = useMemo(() => {
    const categories = new Set();
    (cards ?? []).forEach((card) => {
      if (card?.category) {
        categories.add(card.category);
      }
    });
    customCategories.forEach((name) => categories.add(name));
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [cards, customCategories]);

  const caseCategoryOptions = useMemo(() => {
    const categories = new Set();
    (practiceCases ?? []).forEach((item) => {
      if (item?.category) {
        categories.add(item.category);
      }
    });
    customCategories.forEach((name) => categories.add(name));
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [practiceCases, customCategories]);

  const assignmentCategoryOptions = useMemo(() => {
    const categories = new Set();
    (cards ?? []).forEach((card) => card?.category && categories.add(card.category));
    (practiceCases ?? []).forEach((item) => item?.category && categories.add(item.category));
    customCategories.forEach((name) => categories.add(name));
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [cards, practiceCases, customCategories]);

  const knowledgeCategoryOptions = useMemo(() => {
    const categories = new Set();
    (knowledgeResources ?? []).forEach((item) => {
      if (item?.category) {
        categories.add(item.category);
    }
  });
  return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ru'));
}, [knowledgeResources]);

const knowledgeTagOptions = useMemo(() => {
  const tags = new Set();
  (knowledgeResources ?? []).forEach((item) => {
    if (Array.isArray(item?.tags)) {
      item.tags.forEach((tag) => tags.add(tag));
    }
  });
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [knowledgeResources]);

  const studentProfiles = useMemo(
    () => (allProfiles ?? []).filter((profile) => !profile.is_admin),
    [allProfiles],
  );

  const filteredHomeworkSubmissions = useMemo(() => {
    if (!recipientsSupported || recipientsLoading) return homeworkSubmissions ?? [];
    const rules = recipientRules ?? [];
    const reviewerId = String(user?.id ?? '');
    const myStudents = new Set(rules.filter((rule) => String(rule.reviewer_id) === reviewerId).map((rule) => String(rule.student_id)));
    return (homeworkSubmissions ?? []).filter((submission) => {
      const studentId = String(submission.user_id ?? '');
      if (!studentId) return true;

      const hasAnyRule = rules.some((rule) => String(rule.student_id) === studentId);
      if (!hasAnyRule) return true; // никем не выбрано — показываем всем админам по умолчанию

      if (!reviewerId) return false;
      return myStudents.has(studentId);
    });
  }, [homeworkSubmissions, recipientRules, recipientsSupported, recipientsLoading, user?.id]);

  const metrics = useMemo(
    () => [
      {
        label: 'Карточки',
        value: cards?.length ?? 0,
        helper: 'Тренажёр и повторение',
      },
      {
        label: 'Кейсы',
        value: practiceCases?.length ?? 0,
        helper: 'Практические задания',
      },
      {
        label: 'Теория',
        value: knowledgeResources?.length ?? 0,
        helper: 'Презентации и шпоры',
      },
      {
        label: 'Домашние задания',
        value: homeworkAssignments?.length ?? 0,
        helper: `На проверке: ${
          (homeworkSubmissions ?? []).filter((submission) => submission.status === 'in_review').length
        }`,
      },
      {
        label: 'Мероприятия',
        value: scheduleItems?.length ?? 0,
        helper: 'Олимпиады и события',
      },
    ],
    [cards, practiceCases, knowledgeResources, scheduleItems, homeworkAssignments, homeworkSubmissions],
  );

  return (
    <div className="relative min-h-screen bg-transparent py-14">
      <AmbientBackdrop variant="admin" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6">
        <header className="rounded-[2.8rem] border border-white/60 bg-white/80 p-10 shadow-[0_34px_95px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white/70 px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand/10"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M12.707 15.707a1 1 0 01-1.414 0L6.586 11l4.707-4.707a1 1 0 10-1.414-1.414l-5.414 5.414a1 1 0 000 1.414l5.414 5.414a1 1 0 001.414 0z" />
              </svg>
              Назад в кабинет
            </button>
            <div className="rounded-3xl border border-white/70 bg-white/85 px-5 py-3 text-sm text-slate-600 shadow-inner">
              Вы вошли как <span className="font-semibold text-slate-900">{user?.name}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-brand-dark">
                Панель управления
              </span>
              <h2 className="text-3xl font-display font-semibold text-slate-900">Админ-панель</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                Контролируйте учебные материалы, пользователей, коды доступа и прогресс. Все изменения мгновенно сохраняются в Supabase.
              </p>
            </div>
            {canRefresh && (
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-2xl border border-brand/30 bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark"
              >
                Обновить данные
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a1 1 0 011-1h3a1 1 0 110 2H6.414l1.293 1.293A1 1 0 016 8H3a1 1 0 01-1-1V4a1 1 0 112 0v.586L4 4zM16 12a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 110-2h1.586l-1.293-1.293A1 1 0 0114 12h3z" />
                </svg>
              </button>
            )}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="hover-glow flex flex-col gap-2 rounded-2xl border border-white/60 bg-white/85 px-4 py-4 text-sm text-slate-600 shadow-[0_20px_55px_rgba(15,23,42,0.12)] transition"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{metric.label}</span>
                <span className="text-2xl font-semibold text-slate-900">{metric.value}</span>
                <span className="text-xs text-slate-500">{metric.helper}</span>
              </div>
            ))}
          </div>
        </header>

        <nav className="relative -mx-4 flex items-center gap-2 overflow-x-auto overflow-y-visible px-4 py-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`glow-border whitespace-nowrap rounded-full border px-5 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-transparent bg-brand text-white shadow-lg shadow-brand/25'
                  : 'border-white/50 bg-white/70 text-slate-600 hover:border-brand/40 hover:text-brand'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {feedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50/90 text-emerald-700'
                : 'border-rose-200 bg-rose-50/90 text-rose-600'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="space-y-8 pb-10">
        {activeTab === 'users' && (
          <AdminCard>
            <UsersManager api={adminApi.users} onStatus={handleStatus} user={user} />
          </AdminCard>
        )}
          {activeTab === 'requests' && (
            <AdminCard>
              <AccessRequestsManager api={adminApi.accessRequests} onStatus={handleStatus} />
            </AdminCard>
          )}

          {activeTab === 'progress' && (
            <AdminCard>
              <ProgressManager
                api={adminApi.progress}
                usersApi={adminApi.users}
                cards={cards}
                practiceCases={practiceCases}
                scheduleItems={scheduleItems}
                onStatus={handleStatus}
              />
            </AdminCard>
          )}

          {activeTab === 'assignments' && (
            <AdminCard>
              <AssignmentsManager
                api={adminApi.assignments}
                usersApi={adminApi.users}
                onStatus={handleStatus}
                categoryOptions={assignmentCategoryOptions}
              />
            </AdminCard>
          )}

          {activeTab === 'cards' && (
            <AdminCard>
              <CardsManager
                items={cards}
                categoryOptions={cardCategoryOptions}
                onCreate={adminApi.cards.create}
                onUpdate={adminApi.cards.update}
                onDelete={adminApi.cards.remove}
                onRefresh={refreshHandlers.cards}
                onStatus={handleStatus}
                onRenameCategory={handleRenameCardCategory}
                onDeleteCategory={(name) => handleRenameCardCategory(name, DEFAULT_CATEGORY)}
                defaultCategory={DEFAULT_CATEGORY}
              />
            </AdminCard>
          )}

          {activeTab === 'practice' && (
            <AdminCard>
              <PracticeManager
                items={practiceCases}
                categoryOptions={caseCategoryOptions}
                onCreate={adminApi.practice.create}
                onUpdate={adminApi.practice.update}
                onDelete={adminApi.practice.remove}
                onUpload={adminApi.practice.upload}
                onRefresh={refreshHandlers.practice}
                onStatus={handleStatus}
                onRenameCategory={handleRenameCaseCategory}
                onDeleteCategory={(name) => handleRenameCaseCategory(name, DEFAULT_CATEGORY)}
                defaultCategory={DEFAULT_CATEGORY}
              />
            </AdminCard>
          )}

          {activeTab === 'knowledge' && (
            <AdminCard>
              <KnowledgeManager
                items={knowledgeResources}
                categoryOptions={knowledgeCategoryOptions}
                tagOptions={knowledgeTagOptions}
                students={studentProfiles}
                onCreate={adminApi.knowledge.create}
                onUpdate={adminApi.knowledge.update}
                onDelete={adminApi.knowledge.remove}
                onUpload={adminApi.knowledge.upload}
                onSendToStudents={adminApi.knowledge.sendToStudents}
                onRefresh={refreshHandlers.knowledge}
                onStatus={handleStatus}
              />
            </AdminCard>
          )}

          {activeTab === 'schedule' && (
            <AdminCard>
              <ScheduleManager
                items={scheduleItems}
                onCreate={adminApi.schedule.create}
                onUpdate={adminApi.schedule.update}
                onDelete={adminApi.schedule.remove}
                onRefresh={refreshHandlers.schedule}
                onStatus={handleStatus}
              />
            </AdminCard>
          )}

          {activeTab === 'personal' && (
            <AdminCard>
              <PersonalManager
                knowledgeResources={knowledgeResources}
                usersApi={adminApi.users}
                onLoadByCode={adminApi.personal.loadByCode}
                onAddEntry={adminApi.personal.addEntry}
                onAddEntries={adminApi.personal.addEntries}
                onRemoveEntry={adminApi.personal.removeEntry}
                onUpload={adminApi.personal.upload}
                onStatus={handleStatus}
              />
            </AdminCard>
          )}
          {activeTab === 'recipients' && (
            <AdminCard>
              <RecipientsManager
                students={studentProfiles}
                selectedIds={selectedRecipients}
                loading={recipientsLoading}
                supported={recipientsSupported}
                onToggle={handleToggleRecipient}
                onSave={handleSaveRecipients}
                onRefresh={loadRecipients}
              />
            </AdminCard>
          )}
          {activeTab === 'homework' && (
            <AdminCard>
              <HomeworkManager
                assignments={homeworkAssignments ?? []}
                submissions={filteredHomeworkSubmissions}
                cards={cards}
                practiceCases={practiceCases}
                knowledgeResources={knowledgeResources}
                profiles={studentProfiles}
                recipientStudentIds={selectedRecipients}
                onBack={() => setActiveTab(lastNonHomeworkTab)}
                onStatus={handleStatus}
                onCreateAssignment={adminApi.homework?.create}
                onDeleteAssignment={adminApi.homework?.remove}
                onUploadSubmissionFile={adminApi.homework?.uploadSubmissionFile}
                onUpdateSubmission={adminApi.homework?.updateSubmission}
                onRefresh={adminApi.refresh?.homework}
                uploading={adminApi.homework?.uploading ?? false}
                supportsTargeting={adminApi.homework?.supportsTargeting ?? homeworkSupportsTargets ?? true}
              />
            </AdminCard>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminCard({ children }) {
  return (
    <section className="rounded-[2.4rem] border border-white/50 bg-white/85 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.15)] backdrop-blur-xl">
      {children}
    </section>
  );
}

function CategorySuggestions({ options, onSelect, label = 'Темы:' }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
      <span className="text-slate-400">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 transition hover:border-brand hover:text-brand"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TagSuggestions({ options, onSelect, label = 'Популярные теги:' }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
      <span className="text-slate-400">{label}</span>
      {options.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelect(tag)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 transition hover:border-brand hover:text-brand"
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

function safeParseJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function RecipientsManager({ students = [], selectedIds = [], loading, supported, onToggle, onSave, onRefresh }) {
  const [query, setQuery] = useState('');
  if (!supported) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Настройка получателей ДЗ пока недоступна в этой среде. Все работы будут доступны администраторам по умолчанию.
      </div>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredStudents =
    normalizedQuery.length === 0
      ? students
      : students.filter((student) => {
          const name = (student.name ?? '').toLowerCase();
          const code = (student.code ?? '').toLowerCase();
          const id = String(student.id ?? '').toLowerCase();
          return name.includes(normalizedQuery) || code.includes(normalizedQuery) || id.includes(normalizedQuery);
        });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Получатели ДЗ</h3>
          <p className="text-sm text-slate-600">
            Отметьте учеников, чьи работы должны попадать к вам на проверку. Остальные останутся для других кураторов или администратора.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени или коду"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-60"
          >
            Обновить
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredStudents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
            {students.length === 0 ? 'Нет доступных учеников.' : 'Ничего не найдено.'}
          </div>
        )}
        {filteredStudents.map((student) => {
          const studentId = String(student.id);
          const checked = selectedIds.some((id) => String(id) === studentId);
          return (
            <label
              key={studentId}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                checked ? 'border-brand/40 bg-brand/5 text-brand-dark' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <div className="space-y-0.5">
                <p className="font-semibold">{student.name ?? 'Без имени'}</p>
                <p className="text-xs text-slate-500">Код: {student.code ?? '—'}</p>
              </div>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle?.(student.id)}
                className="h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand"
                disabled={loading}
              />
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Выбрано: {selectedIds.length}</p>
        <button
          type="button"
          onClick={onSave}
          disabled={loading || !supported}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? 'Сохраняем…' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
}

function UsersManager({ api, onStatus, user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', is_admin: false });
  const isOwner = Boolean(user?.isOwner);

  const loadProfiles = useCallback(async () => {
    if (!api?.list) return;
    setLoading(true);
    onStatus('', '');
    try {
      const data = await api.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось загрузить пользователей.');
    } finally {
      setLoading(false);
    }
  }, [api, onStatus]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const generateCode = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '0123456789';
    const randomDigits = Array.from({ length: 4 }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
    const randomLetters = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    return `FG-${randomDigits}-${randomLetters}`;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const code = (form.code && form.code.trim()) || generateCode(form.name);
    if (!name) {
      onStatus('error', 'Заполните имя.');
      return;
    }
    setBusy(true);
    onStatus('', '');
    try {
      await api.create({
        name,
        code,
        is_admin: isOwner ? form.is_admin : false,
      });
      setForm({ name: '', code: '', is_admin: false });
      onStatus('success', 'Пользователь создан.');
      await loadProfiles();
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось создать пользователя.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAdmin = async (profile) => {
    if (!isOwner) {
      onStatus('error', 'Изменять права администратора может только владелец.');
      return;
    }
    setBusy(true);
    onStatus('', '');
    try {
      await api.update(profile.id, { is_admin: !profile.is_admin });
      onStatus('success', 'Права обновлены.');
      await loadProfiles();
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось обновить права.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (profile) => {
    if (profile.is_owner) {
      onStatus('error', 'Владельца удалить нельзя.');
      return;
    }
    if (!window.confirm(`Удалить пользователя ${profile.name}?`)) return;
    setBusy(true);
    onStatus('', '');
    try {
      await api.remove(profile.id);
      onStatus('success', 'Пользователь удалён.');
      await loadProfiles();
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось удалить пользователя.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Пользователи платформы</h3>
          <p className="text-sm text-slate-500">
            Управляйте профилями учеников, назначайте права администратора и сбрасывайте коды.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
          onClick={loadProfiles}
          disabled={loading}
        >
          Обновить список
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-slate-500">Загружаем список пользователей…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">Пользователи ещё не созданы.</p>
          ) : (
            <div className="space-y-3">
              {items.map((profile) => (
                <article
                  key={profile.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{profile.name}</h4>
                      <p className="text-xs text-slate-500">
                        Код: {profile.code} · {profile.is_admin ? 'Администратор' : 'Ученик'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-brand/40 px-3 py-1 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand/10"
                        onClick={() => handleToggleAdmin(profile)}
                        disabled={busy || !isOwner}
                      >
                        {profile.is_admin ? 'Снять права' : 'Выдать права'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                        onClick={() => handleDelete(profile)}
                        disabled={busy || profile.is_owner}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Создан: {new Date(profile.created_at).toLocaleString('ru-RU')}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-lg font-semibold text-slate-900">Новый пользователь</h4>
          <p className="mt-1 text-xs text-slate-500">
            Код должен быть уникальным. После создания пользователь сможет войти с этим кодом.
          </p>
          {!isOwner && (
            <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Выдавать или отзывать права администратора может только владелец.
            </p>
          )}
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Имя</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                    code: prev.code || generateCode(),
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="Например, Алексей"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Код доступа</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  type="text"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Сгенерируется автоматически"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      code: generateCode(),
                    }))
                  }
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                  disabled={busy}
                >
                  Сгенерировать
                </button>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={form.is_admin}
                onChange={(event) => setForm((prev) => ({ ...prev, is_admin: event.target.checked }))}
                disabled={!isOwner}
              />
              Сделать администратором
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:opacity-60"
            >
              {busy ? 'Сохраняем…' : 'Создать пользователя'}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}

function AccessCodeManager({ api, usersApi, onStatus }) {
  const [codes, setCodes] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: '', owner_name: '' });
  const [ownerDrafts, setOwnerDrafts] = useState({});

  const loadData = useCallback(async () => {
    if (!api?.list) return;
    setLoading(true);
    onStatus('', '');
    try {
      const [codesData, profilesData] = await Promise.all([
        api.list(),
        usersApi?.list ? usersApi.list() : Promise.resolve([]),
      ]);
      const normalizedCodes = Array.isArray(codesData) ? codesData : [];
      setCodes(normalizedCodes);
      setProfiles(Array.isArray(profilesData) ? profilesData : []);
      const drafts = {};
      normalizedCodes.forEach((item) => {
        drafts[item.id] = item.owner_name ?? '';
      });
      setOwnerDrafts(drafts);
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось загрузить коды доступа.');
    } finally {
      setLoading(false);
    }
  }, [api, usersApi, onStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.code.trim()) {
      onStatus('error', 'Укажите код доступа.');
      return;
    }
    setBusy(true);
    onStatus('', '');
    try {
      await api.create({
        code: form.code.trim(),
        owner_name: form.owner_name.trim() || null,
      });
      setForm({ code: '', owner_name: '' });
      onStatus('success', 'Код создан.');
      await loadData();
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось создать код.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (codeId) => {
    if (!window.confirm('Удалить код доступа?')) return;
    setBusy(true);
    onStatus('', '');
    try {
      await api.remove(codeId);
      onStatus('success', 'Код удалён.');
      await loadData();
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось удалить код.');
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async (codeId, profileId, ownerName) => {
    setBusy(true);
    onStatus('', '');
    try {
      await api.assign({
        code_id: codeId,
        profile_id: profileId || null,
        owner_name: ownerName && ownerName.trim() ? ownerName.trim() : null,
      });
      onStatus('success', 'Код обновлён.');
      await loadData();
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось привязать код.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Коды доступа</h3>
          <p className="text-sm text-slate-500">
            Создавайте новые коды входа и привязывайте их к пользователям.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
          onClick={loadData}
          disabled={loading}
        >
          Обновить список
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-slate-500">Загружаем коды…</p>
          ) : codes.length === 0 ? (
            <p className="text-sm text-slate-500">Коды доступа ещё не созданы.</p>
          ) : (
            <div className="space-y-3">
              {codes.map((code) => (
                <article key={code.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{code.code}</h4>
                      <p className="text-xs text-slate-500">
                        Владелец: {code.owner_name ?? 'Не указан'} · Пользователь:{' '}
                        {code.user_id ? profiles.find((profile) => profile.id === code.user_id)?.name ?? 'Привязан' : 'Не привязан'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                      onClick={() => handleDelete(code.id)}
                      disabled={busy}
                    >
                      Удалить
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                      value={code.user_id ?? ''}
                      onChange={(event) => handleAssign(code.id, event.target.value || null, ownerDrafts[code.id] ?? code.owner_name ?? null)}
                      disabled={busy}
                    >
                      <option value="">Не привязан</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} · {profile.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                      value={ownerDrafts[code.id] ?? ''}
                      placeholder="Имя владельца"
                      onChange={(event) => setOwnerDrafts((prev) => ({ ...prev, [code.id]: event.target.value }))}
                      onBlur={(event) => handleAssign(code.id, code.user_id ?? null, event.target.value)}
                      disabled={busy}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-lg font-semibold text-slate-900">Новый код доступа</h4>
          <p className="mt-1 text-xs text-slate-500">Код должен быть уникальным и может содержать буквы и цифры.</p>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Код</label>
              <input
                type="text"
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="FG-2025-NEW1"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Имя владельца</label>
              <input
                type="text"
                value={form.owner_name}
                onChange={(event) => setForm((prev) => ({ ...prev, owner_name: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="Например, Мария"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:opacity-60"
            >
              {busy ? 'Создаём…' : 'Создать код'}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}

function AccessRequestsManager({ api, onStatus }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadRequests = useCallback(async () => {
    if (!api?.list) return;
    setLoading(true);
    onStatus('', '');
    try {
      const data = await api.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось загрузить заявки.');
    } finally {
      setLoading(false);
    }
  }, [api, onStatus]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (requestId) => {
    if (!api?.approve) return;
    setBusyId(requestId);
    onStatus('', '');
    try {
      const result = await api.approve(requestId);
      setItems((prev) => {
        const current = Array.isArray(prev) ? prev : [];
        const updated = current.some((item) => item.id === result.id)
          ? current.map((item) => (item.id === result.id ? result : item))
          : [result, ...current];
        return updated;
      });
      onStatus('success', 'Заявка одобрена. Код сгенерирован автоматически.');
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось одобрить заявку.');
    } finally {
      setBusyId(null);
    }
  };

  const renderStatus = (status, deliveredAt) => {
    const normalized = (status ?? '').toLowerCase();
    const styles = {
      pending: 'border-amber-200 bg-amber-50 text-amber-700',
      approved: deliveredAt ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      delivered: 'border-blue-200 bg-blue-50 text-blue-700',
    };
    const labels = {
      pending: 'Ожидает',
      approved: deliveredAt ? 'Код выдан' : 'Одобрено',
      delivered: 'Код выдан',
    };
    const style = styles[normalized] ?? 'border-slate-200 bg-slate-50 text-slate-600';
    const label = labels[normalized] ?? 'Черновик';
    return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${style}`}>{label}</span>;
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Заявки на доступ</h3>
          <p className="text-sm text-slate-500">Ученики оставляют имя и фамилию, вы одобряете — система генерирует код.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
          onClick={loadRequests}
          disabled={loading}
        >
          Обновить список
        </button>
      </header>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Загружаем заявки…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Заявки пока не поступали.</p>
        ) : (
          <div className="space-y-3">
            {items.map((request) => (
              <article key={request.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{request.full_name ?? 'Без имени'}</p>
                    <p className="text-xs text-slate-500">Создана: {formatDate(request.created_at)} · ID: {request.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStatus(request.status, request.delivered_at)}
                    {request.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(request.id)}
                        disabled={busyId === request.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
                      >
                        {busyId === request.id ? 'Одобряем…' : 'Одобрить'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    Код: {request.code ? request.code : '—'}
                  </span>
                  {request.profile_id && <span className="text-slate-500">Профиль: {request.profile_id}</span>}
                  {request.delivered_at && <span className="text-slate-500">Код показан: {formatDate(request.delivered_at)}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryQuickAdd({ onAdd }) {
  const [value, setValue] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd?.(trimmed);
    setValue('');
  };

  return (
    <div className="rounded-2xl border border-white/60 bg-white/85 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={handleSubmit}>
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-semibold text-slate-900">Добавить тему</h4>
          <p className="text-xs text-slate-500">
            Новая тема сразу появится в списках карточек и кейсов. Можно использовать без создания карточки.
          </p>
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Например, Аналитика или Налоги"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:opacity-60"
          disabled={!value.trim()}
        >
          Добавить
        </button>
      </form>
    </div>
  );
}

function ProgressManager({ api, usersApi, cards = [], practiceCases = [], scheduleItems = [], onStatus }) {
  const [profiles, setProfiles] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [profileQuery, setProfileQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadProfiles = useCallback(async () => {
    if (!usersApi?.list) return;
    try {
      const result = await usersApi.list();
      setProfiles(Array.isArray(result) ? result : []);
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось загрузить список пользователей.');
    }
  }, [usersApi, onStatus]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const filteredProfiles = useMemo(() => {
    const query = profileQuery.trim().toLowerCase();
    const list = Array.isArray(profiles) ? profiles : [];
    if (!query) return list;
    return list.filter((profile) => {
      const code = String(profile.code ?? '').toLowerCase();
      const name = String(profile.name ?? '').toLowerCase();
      return code.includes(query) || name.includes(query);
    });
  }, [profiles, profileQuery]);

  const selectedProfile = useMemo(() => {
    if (!selectedCode) return null;
    return (profiles ?? []).find((profile) => String(profile.code) === String(selectedCode)) ?? null;
  }, [profiles, selectedCode]);

  const handleFetch = async (code) => {
    if (!code) {
      onStatus('error', 'Укажите код пользователя.');
      return;
    }
    setLoading(true);
    onStatus('', '');
    try {
      const result = await api.fetch(code);
      setData(result);
      onStatus('success', 'Прогресс загружен.');
    } catch (error) {
      setData(null);
      onStatus('error', error.message ?? 'Не удалось получить прогресс.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!selectedCode) {
      onStatus('error', 'Выберите код пользователя.');
      return;
    }
    if (!window.confirm('Сбросить прогресс пользователя?')) return;
    setLoading(true);
    onStatus('', '');
    try {
      await api.reset(selectedCode);
      setData(null);
      onStatus('success', 'Прогресс сброшен.');
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось сбросить прогресс.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Прогресс учеников</h3>
          <p className="text-sm text-slate-500">
            Просматривайте прогресс карточек/кейсов, повторение и выбранные темы.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-2 md:max-w-xl md:flex-row md:justify-end">
          <input
            value={profileQuery}
            onChange={(event) => setProfileQuery(event.target.value)}
            placeholder="Поиск по имени или коду"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 md:max-w-xs"
          />
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            value={selectedCode}
            onChange={(event) => setSelectedCode(event.target.value)}
          >
            <option value="">Выберите пользователя</option>
            {filteredProfiles.map((profile) => (
              <option key={profile.id} value={profile.code}>
                {profile.name} · {profile.code}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
            onClick={() => handleFetch(selectedCode)}
            disabled={loading}
          >
            Загрузить
          </button>
        </div>
      </header>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Загружаем данные…</p>
        ) : data ? (
          <ProgressOverview
            data={data}
            profile={selectedProfile}
            cards={cards}
            practiceCases={practiceCases}
            scheduleItems={scheduleItems}
            onReset={handleReset}
          />
        ) : (
          <p className="text-sm text-slate-500">Выберите пользователя и загрузите прогресс.</p>
        )}
      </div>
    </section>
  );
}

function ProgressOverview({ data, profile, cards = [], practiceCases = [], scheduleItems = [], onReset }) {
  const statuses = data?.statuses && typeof data.statuses === 'object' ? data.statuses : {};
  const caseStatuses = data?.caseStatuses && typeof data.caseStatuses === 'object' ? data.caseStatuses : {};
  const lastSeen = data?.lastSeenIndex && typeof data.lastSeenIndex === 'object' ? data.lastSeenIndex : {};
  const scheduleParticipation =
    data?.scheduleParticipation && typeof data.scheduleParticipation === 'object' ? data.scheduleParticipation : {};

  const cardList = Array.isArray(cards) ? cards : [];
  const caseList = Array.isArray(practiceCases) ? practiceCases : [];

  const ensureCaseStatus = (value) => {
    if (value === 'in_progress' || value === 'done') return value;
    return 'todo';
  };

  const cardsById = useMemo(() => {
    const map = new Map();
    cardList.forEach((card) => {
      map.set(String(card.id), card);
    });
    return map;
  }, [cardList]);

  const cardCounts = useMemo(() => {
    const known = new Set();
    let know = 0;
    let unsure = 0;
    let dontknow = 0;

    for (const [cardId, value] of Object.entries(statuses)) {
      if (!cardsById.has(String(cardId))) continue;
      known.add(String(cardId));
      if (value === 'know') know += 1;
      else if (value === 'dontknow') dontknow += 1;
      else unsure += 1;
    }

    const total = cardList.length;
    const withoutStatus = Math.max(0, total - known.size);
    return { total, know, unsure, dontknow, withoutStatus };
  }, [statuses, cardsById, cardList.length]);

  const caseCounts = useMemo(() => {
    let done = 0;
    let inProgress = 0;
    caseList.forEach((item) => {
      const status = ensureCaseStatus(caseStatuses[String(item.id)]);
      if (status === 'done') done += 1;
      else if (status === 'in_progress') inProgress += 1;
    });
    const total = caseList.length;
    const todo = Math.max(0, total - done - inProgress);
    return { total, done, inProgress, todo };
  }, [caseList, caseStatuses]);

  const cardsByCategory = useMemo(() => {
    const map = new Map();
    cardList.forEach((card) => {
      const category = card.category ?? DEFAULT_CATEGORY;
      if (!map.has(category)) {
        map.set(category, { total: 0, know: 0, unsure: 0, dontknow: 0 });
      }
      const entry = map.get(category);
      entry.total += 1;
      const status = statuses[String(card.id)];
      if (status === 'know') entry.know += 1;
      else if (status === 'dontknow') entry.dontknow += 1;
      else if (status) entry.unsure += 1;
    });
    return Array.from(map.entries())
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => a.category.localeCompare(b.category, 'ru'));
  }, [cardList, statuses]);

  const casesByCategory = useMemo(() => {
    const map = new Map();
    caseList.forEach((item) => {
      const category = item.category ?? 'Общая практика';
      if (!map.has(category)) {
        map.set(category, { total: 0, done: 0, inProgress: 0, todo: 0 });
      }
      const entry = map.get(category);
      entry.total += 1;
      const status = ensureCaseStatus(caseStatuses[String(item.id)]);
      if (status === 'done') entry.done += 1;
      else if (status === 'in_progress') entry.inProgress += 1;
      else entry.todo += 1;
    });
    return Array.from(map.entries())
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => a.category.localeCompare(b.category, 'ru'));
  }, [caseList, caseStatuses]);

  const scheduleSelected = useMemo(() => {
    const selectedIds = new Set(Object.keys(scheduleParticipation).filter((key) => scheduleParticipation[key]));
    const items = Array.isArray(scheduleItems) ? scheduleItems : [];
    const known = items
      .filter((item) => selectedIds.has(String(item.id)))
      .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''), 'ru'));
    const missing = Array.from(selectedIds).filter((id) => !items.some((item) => String(item.id) === String(id)));
    return { known, missing };
  }, [scheduleParticipation, scheduleItems]);

  const [activeView, setActiveView] = useState('overview');
  const [cardFilter, setCardFilter] = useState('all');
  const [cardCategory, setCardCategory] = useState('all');
  const [cardQuery, setCardQuery] = useState('');
  const [caseFilter, setCaseFilter] = useState('all');
  const [caseCategory, setCaseCategory] = useState('all');
  const [caseQuery, setCaseQuery] = useState('');

  const cardCategoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(cardList.map((card) => String(card.category ?? DEFAULT_CATEGORY)).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'ru'));
    return ['all', ...categories];
  }, [cardList]);

  const caseCategoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(caseList.map((item) => String(item.category ?? 'Общая практика')).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'ru'));
    return ['all', ...categories];
  }, [caseList]);

  const filteredCards = useMemo(() => {
    const query = cardQuery.trim().toLowerCase();
    return cardList
      .filter((card) => {
        const id = String(card.id);
        const status = statuses[id] ?? null;
        if (cardCategory !== 'all') {
          const category = String(card.category ?? DEFAULT_CATEGORY);
          if (category !== cardCategory) return false;
        }
        if (cardFilter === 'know' && status !== 'know') return false;
        if (cardFilter === 'dontknow' && status !== 'dontknow') return false;
        if (cardFilter === 'unsure' && status !== 'unsure') return false;
        if (cardFilter === 'review' && (!status || status === 'know')) return false;
        if (cardFilter === 'none' && status) return false;
        if (query) {
          const haystack = `${card.category ?? ''} ${card.question ?? ''} ${card.answer ?? ''}`.toLowerCase();
          if (!haystack.includes(query) && !id.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => String(a.category ?? '').localeCompare(String(b.category ?? ''), 'ru'));
  }, [cardList, statuses, cardCategory, cardFilter, cardQuery]);

  const filteredCases = useMemo(() => {
    const query = caseQuery.trim().toLowerCase();
    return caseList
      .filter((item) => {
        const id = String(item.id);
        const status = ensureCaseStatus(caseStatuses[id]);
        if (caseCategory !== 'all') {
          const category = String(item.category ?? 'Общая практика');
          if (category !== caseCategory) return false;
        }
        if (caseFilter === 'done' && status !== 'done') return false;
        if (caseFilter === 'in_progress' && status !== 'in_progress') return false;
        if (caseFilter === 'todo' && status !== 'todo') return false;
        if (query) {
          const haystack = `${item.category ?? ''} ${item.title ?? ''} ${item.prompt ?? ''}`.toLowerCase();
          if (!haystack.includes(query) && !id.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => String(a.category ?? '').localeCompare(String(b.category ?? ''), 'ru'));
  }, [caseList, caseStatuses, caseCategory, caseFilter, caseQuery]);

  const statusList = Object.entries(statuses).slice(0, 30);
  const hasMoreStatuses = Object.keys(statuses).length > statusList.length;

  const lastSeenEntries = useMemo(() => {
    return Object.entries(lastSeen)
      .map(([key, value]) => {
        const raw = String(key);
        const index = typeof value === 'number' ? value : Number(value ?? 0);
        const normalizedIndex = Number.isFinite(index) ? index : 0;
        let mode = 'прочее';
        let category = raw;
        if (raw.startsWith('card:')) {
          mode = 'карточки';
          category = raw.slice('card:'.length) || 'Все темы';
        } else if (raw.startsWith('case:') || raw.startsWith('practice:')) {
          mode = 'кейсы';
          category = raw.replace(/^case:|^practice:/, '') || 'Все темы';
        }
        return { raw, mode, category, index: normalizedIndex };
      })
      .sort((a, b) => a.mode.localeCompare(b.mode, 'ru') || a.category.localeCompare(b.category, 'ru'));
  }, [lastSeen]);

  const copySummary = async () => {
    const lines = [];
    if (profile?.name || profile?.code) {
      lines.push(`${profile?.name ?? 'Пользователь'} · ${profile?.code ?? ''}`.trim());
    }
    lines.push(`Карточки: знаю ${cardCounts.know}/${cardCounts.total}, на повторении ${cardCounts.unsure + cardCounts.dontknow}, без статуса ${cardCounts.withoutStatus}`);
    lines.push(`Кейсы: решено ${caseCounts.done}/${caseCounts.total}, в работе ${caseCounts.inProgress}, не начато ${caseCounts.todo}`);
    if (scheduleSelected.known.length) {
      lines.push(`Расписание: выбрано ${scheduleSelected.known.length}`);
    }
    const text = lines.filter(Boolean).join('\n');
	    try {
	      await navigator.clipboard.writeText(text);
	    } catch {
	      // ignore
	    }
	  };

  const viewTabs = [
    { id: 'overview', label: 'Сводка' },
    { id: 'cards', label: 'Карточки' },
    { id: 'cases', label: 'Кейсы' },
    { id: 'schedule', label: 'Расписание' },
    { id: 'raw', label: 'JSON' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {profile?.name && (
            <p className="text-sm font-semibold text-slate-900">
              {profile.name} <span className="text-slate-400">·</span>{' '}
              <span className="font-mono text-xs text-slate-500">{profile.code}</span>
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Карточки и кейсы считаются по данным прогресса (включая просмотренные материалы из ДЗ).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
            onClick={copySummary}
          >
            Скопировать сводку
          </button>
          <button
            type="button"
            className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
            onClick={onReset}
          >
            Сбросить прогресс
          </button>
        </div>
      </div>

      <div className="inline-flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2">
        {viewTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveView(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeView === tab.id ? 'bg-brand text-white shadow shadow-brand/25' : 'text-slate-600 hover:bg-brand/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeView === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 shadow-inner">
              <p className="text-xs uppercase tracking-widest text-slate-500">Карточки всего</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{cardCounts.total}</p>
              <p className="mt-1 text-xs text-slate-500">Без статуса: {cardCounts.withoutStatus}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-emerald-700 shadow-inner">
              <p className="text-xs uppercase tracking-widest text-emerald-700/80">Знаю</p>
              <p className="mt-2 text-2xl font-semibold">{cardCounts.know}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-amber-700 shadow-inner">
              <p className="text-xs uppercase tracking-widest text-amber-700/80">На повторении</p>
              <p className="mt-2 text-2xl font-semibold">{cardCounts.unsure + cardCounts.dontknow}</p>
              <p className="mt-1 text-xs text-amber-700/80">
                Не уверен: {cardCounts.unsure} · Не знаю: {cardCounts.dontknow}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-inner">
              <p className="text-xs uppercase tracking-widest text-slate-500">Кейсы</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {caseCounts.done} / {caseCounts.total}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                В работе: {caseCounts.inProgress} · Не начато: {caseCounts.todo}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <h4 className="text-sm font-semibold text-slate-900">Прогресс по темам (карточки)</h4>
              {cardsByCategory.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Карточек ещё нет.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {cardsByCategory.map((row) => {
                    const value = row.total ? Math.round((row.know / row.total) * 100) : 0;
                    return (
                      <li key={row.category} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-slate-700">{row.category}</span>
                          <span className="text-slate-500">
                            {row.know}/{row.total} · {value}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <h4 className="text-sm font-semibold text-slate-900">Прогресс по темам (кейсы)</h4>
              {casesByCategory.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Кейсов ещё нет.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {casesByCategory.map((row) => {
                    const value = row.total ? Math.round((row.done / row.total) * 100) : 0;
                    return (
                      <li key={row.category} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-slate-700">{row.category}</span>
                          <span className="text-slate-500">
                            {row.done}/{row.total} · {value}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${value}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Карточки и статусы (первые 30)</h4>
              {statusList.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Статусы карточек ещё не записаны.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-xs text-slate-600">
                  {statusList.map(([cardId, value]) => (
                    <li
                      key={cardId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <span className="font-semibold text-slate-700">#{cardId}</span>
                      <span className="uppercase tracking-widest text-[11px]">
                        {value === 'know' ? 'Знаю' : value === 'dontknow' ? 'Не знаю' : 'Не уверен'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {hasMoreStatuses && <p className="mt-3 text-xs text-slate-500">Показаны первые 30 карточек.</p>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <h4 className="text-sm font-semibold text-slate-900">Текущее положение</h4>
              {lastSeenEntries.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Нет данных о последнем просмотре.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-xs text-slate-600">
                  {lastSeenEntries.map((entry) => (
                    <li key={entry.raw} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="font-semibold text-slate-700">{entry.mode}</span>
                      <span className="ml-2 text-slate-500">{entry.category}</span>
                      <span className="ml-2 text-slate-400">· позиция {entry.index + 1}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'cards' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Карточки</h4>
              <p className="text-xs text-slate-500">Фильтруйте по статусу, теме и поиску по тексту.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <select
                value={cardFilter}
                onChange={(event) => setCardFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">Все</option>
                <option value="know">Знаю</option>
                <option value="review">На повторении</option>
                <option value="unsure">Не уверен</option>
                <option value="dontknow">Не знаю</option>
                <option value="none">Без статуса</option>
              </select>
              <select
                value={cardCategory}
                onChange={(event) => setCardCategory(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                {cardCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'Все темы' : category}
                  </option>
                ))}
              </select>
              <input
                value={cardQuery}
                onChange={(event) => setCardQuery(event.target.value)}
                placeholder="Поиск по тексту/ID"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 sm:col-span-2"
              />
            </div>
          </div>
          <div className="text-xs text-slate-500">Найдено: {filteredCards.length}</div>
          <div className="max-h-[520px] overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Тема</th>
                  <th className="px-4 py-3">Вопрос</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCards.map((card) => {
                  const status = statuses[String(card.id)] ?? null;
                  const label = status === 'know' ? 'Знаю' : status === 'dontknow' ? 'Не знаю' : status === 'unsure' ? 'Не уверен' : '—';
                  return (
                    <tr key={card.id} className="bg-white">
                      <td className="px-4 py-3 text-xs text-slate-500">{card.category ?? DEFAULT_CATEGORY}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 line-clamp-2">{card.question ?? `Карточка #${card.id}`}</div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600">{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'cases' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Кейсы</h4>
              <p className="text-xs text-slate-500">Фильтруйте по статусу, теме и поиску по тексту.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <select
                value={caseFilter}
                onChange={(event) => setCaseFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">Все</option>
                <option value="todo">Не начато</option>
                <option value="in_progress">В работе</option>
                <option value="done">Решено</option>
              </select>
              <select
                value={caseCategory}
                onChange={(event) => setCaseCategory(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                {caseCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'Все темы' : category}
                  </option>
                ))}
              </select>
              <input
                value={caseQuery}
                onChange={(event) => setCaseQuery(event.target.value)}
                placeholder="Поиск по тексту/ID"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 sm:col-span-2"
              />
            </div>
          </div>
          <div className="text-xs text-slate-500">Найдено: {filteredCases.length}</div>
          <div className="max-h-[520px] overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Тема</th>
                  <th className="px-4 py-3">Кейс</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((item) => {
                  const status = ensureCaseStatus(caseStatuses[String(item.id)]);
                  const label = status === 'done' ? 'Решено' : status === 'in_progress' ? 'В работе' : 'Не начато';
                  return (
                    <tr key={item.id} className="bg-white">
                      <td className="px-4 py-3 text-xs text-slate-500">{item.category ?? 'Общая практика'}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 line-clamp-2">{item.title ?? `Кейс #${item.id}`}</div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600">{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'schedule' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="text-sm font-semibold text-slate-900">Расписание</h4>
          <p className="text-xs text-slate-500">
            Отмеченные мероприятия (из блока расписания ученика): {scheduleSelected.known.length}
          </p>
          {scheduleSelected.known.length === 0 ? (
            <p className="text-sm text-slate-500">Ничего не отмечено.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {scheduleSelected.known.map((item) => (
                <li key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  {item.date && <p className="mt-1 text-xs text-slate-500">{item.date}</p>}
                </li>
              ))}
            </ul>
          )}
          {scheduleSelected.missing.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Есть отмеченные ID, которых нет в текущем расписании: {scheduleSelected.missing.join(', ')}
            </div>
          )}
        </div>
      )}

      {activeView === 'raw' && (
        <details open className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Полные данные (JSON)</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap bg-slate-900/90 p-3 text-slate-100">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function AssignmentsManager({ api, usersApi, onStatus, categoryOptions = [] }) {
  const [profiles, setProfiles] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: '',
    status: 'todo',
    difficulty: 'medium',
    due_date: '',
  });
  const [busy, setBusy] = useState(false);

  const loadProfiles = useCallback(async () => {
    if (!usersApi?.list) return;
    try {
      const data = await usersApi.list();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось загрузить пользователей.');
    }
  }, [usersApi, onStatus]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const loadTasks = useCallback(async (code) => {
    if (!code) {
      setTasks([]);
      return;
    }
    setLoading(true);
    onStatus('', '');
    try {
      const data = await api.list(code);
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось загрузить задачи.');
    } finally {
      setLoading(false);
    }
  }, [api, onStatus]);

  useEffect(() => {
    if (selectedCode) {
      loadTasks(selectedCode);
    } else {
      setTasks([]);
    }
  }, [selectedCode, loadTasks]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedCode) {
      onStatus('error', 'Выберите пользователя.');
      return;
    }
    if (!form.title.trim()) {
      onStatus('error', 'Добавьте название задачи.');
      return;
    }
    setBusy(true);
    onStatus('', '');
    try {
      await api.create(selectedCode, {
        title: form.title.trim(),
        category: form.category.trim() || null,
        status: form.status,
        difficulty: form.difficulty,
        due_date: form.due_date || null,
      });
      setForm({
        title: '',
        category: '',
        status: 'todo',
        difficulty: 'medium',
        due_date: '',
      });
      onStatus('success', 'Задача добавлена.');
      await loadTasks(selectedCode);
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось добавить задачу.');
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (task, status) => {
    setBusy(true);
    onStatus('', '');
    try {
      await api.updateStatus(selectedCode, task.id, status);
      onStatus('success', 'Статус обновлён.');
      await loadTasks(selectedCode);
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось обновить статус.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Удалить задачу?')) return;
    setBusy(true);
    onStatus('', '');
    try {
      await api.remove(selectedCode, taskId);
      onStatus('success', 'Задача удалена.');
      await loadTasks(selectedCode);
    } catch (error) {
      onStatus('error', error.message ?? 'Не удалось удалить задачу.');
    } finally {
      setBusy(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: 'todo', label: 'К началу' },
    { value: 'in_progress', label: 'В процессе' },
    { value: 'done', label: 'Завершено' },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Задачи пользователей</h3>
          <p className="text-sm text-slate-500">
            Назначайте индивидуальные задачи и контролируйте их выполнение.
          </p>
        </div>
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          value={selectedCode}
          onChange={(event) => setSelectedCode(event.target.value)}
        >
          <option value="">Выберите пользователя</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.code}>
              {profile.name} · {profile.code}
            </option>
          ))}
        </select>
      </header>

      {selectedCode ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
            {loading ? (
              <p className="text-sm text-slate-500">Загружаем задачи…</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-slate-500">Задачи ещё не назначены.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <article key={task.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{task.title}</h4>
                        <p className="text-xs text-slate-500">
                          Категория: {task.category ?? '—'} · Сложность:{' '}
                          {DIFFICULTY_OPTIONS.find((option) => option.value === task.difficulty)?.label ?? 'Средняя'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                        onClick={() => handleDelete(task.id)}
                        disabled={busy}
                      >
                        Удалить
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {task.due_date && <span>Срок: {new Date(task.due_date).toLocaleDateString('ru-RU')}</span>}
                      <select
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
                        value={task.status}
                        onChange={(event) => handleStatusChange(task, event.target.value)}
                        disabled={busy}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-900">Новая задача</h4>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Название</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Например, пройти тему по инвестициям"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Категория</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Например, Тренажёр"
                />
                <CategorySuggestions
                  options={categoryOptions}
                  onSelect={(option) => setForm((prev) => ({ ...prev, category: option }))}
                  label="Темы кейсов:"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Статус</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Сложность</label>
                  <select
                    value={form.difficulty}
                    onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Срок</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:opacity-60"
              >
                {busy ? 'Назначаем…' : 'Назначить задачу'}
              </button>
            </form>
          </aside>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Выберите пользователя, чтобы увидеть и назначить задачи.</p>
        </div>
      )}
    </section>
  );
}

function CategoryPills({ categories = [], onEdit, onDelete }) {
  if (!categories.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {categories.map((category) => (
        <div
          key={category}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
        >
          <span>{category}</span>
          <button
            type="button"
            onClick={() => onEdit?.(category)}
            className="text-slate-400 hover:text-brand"
            aria-label="Редактировать"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(category)}
            className="text-rose-500 hover:text-rose-600"
            aria-label="Удалить"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function CardsManager({
  items,
  categoryOptions = [],
  onCreate,
  onUpdate,
  onDelete,
  onRefresh,
  onStatus,
  onRenameCategory,
  onDeleteCategory,
  defaultCategory,
}) {
  const [form, setForm] = useState({ ...emptyCardForm });
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    onStatus(null, null);
    try {
      if (form.id) {
        await onUpdate(form.id, form);
        onStatus('success', 'Карточка обновлена.');
      } else {
        await onCreate(form);
        onStatus('success', 'Карточка создана.');
      }
      setForm({ ...emptyCardForm });
      if (onRefresh) await onRefresh();
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось сохранить карточку.');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (card) => {
    setForm({
      id: card.id,
      category: card.category ?? '',
      question: card.question ?? '',
      answer: card.answer ?? '',
      difficulty: card.difficulty ?? 'medium',
    });
    onStatus(null, null);
  };

  const handleDelete = async (card) => {
    if (!window.confirm('Удалить эту карточку?')) return;
    setBusy(true);
    onStatus(null, null);
    try {
      await onDelete(card.id);
      onStatus('success', 'Карточка удалена.');
      if (onRefresh) await onRefresh();
      if (form.id === card.id) {
        setForm({ ...emptyCardForm });
      }
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось удалить карточку.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Карточки ({items.length})</h3>
        </div>
        <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
          {items.length === 0 ? (
            <EmptyState message="Карточки ещё не добавлены." />
          ) : (
            items.map((card) => (
              <article
                key={card.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{card.question}</h4>
                    <p className="text-xs text-slate-500">
                      {card.category} · {difficultyLabel(card.difficulty)}
                    </p>
                  </div>
                  <ActionButtons onEdit={() => handleEdit(card)} onDelete={() => handleDelete(card)} />
                </div>
                <p className="whitespace-pre-line text-xs text-slate-600">{card.answer}</p>
              </article>
            ))
          )}
        </div>
      </div>
      <aside className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {form.id ? 'Редактирование карточки' : 'Новая карточка'}
          </h3>
          <p className="text-xs text-slate-500">Заполните вопрос, ответ и укажите тему и сложность.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <LabeledInput
            label="Категория"
            value={form.category}
            onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
            placeholder="Например, Налоги"
            required
          />
          <CategorySuggestions
            options={categoryOptions}
            onSelect={(option) => setForm((prev) => ({ ...prev, category: option }))}
            label="Темы карточек:"
          />
          <CategoryPills
            categories={categoryOptions}
            onEdit={(name) => {
              const next = window.prompt('Новое название темы', name);
              if (next === null) return;
              onRenameCategory?.(name, next || defaultCategory);
              if (form.category === name) {
                setForm((prev) => ({ ...prev, category: next || defaultCategory }));
              }
            }}
            onDelete={(name) => {
              if (!window.confirm(`Удалить тему «${name}»? Будет установлено "${defaultCategory}".`)) return;
              onDeleteCategory?.(name);
              if (form.category === name) {
                setForm((prev) => ({ ...prev, category: defaultCategory }));
              }
            }}
          />
          <LabeledTextarea
            label="Вопрос"
            value={form.question}
            onChange={(value) => setForm((prev) => ({ ...prev, question: value }))}
            rows={3}
            required
          />
          <LabeledTextarea
            label="Ответ"
            value={form.answer}
            onChange={(value) => setForm((prev) => ({ ...prev, answer: value }))}
            rows={4}
            required
          />
          <LabeledSelect
            label="Сложность"
            value={form.difficulty}
            onChange={(value) => setForm((prev) => ({ ...prev, difficulty: value }))}
            options={DIFFICULTY_OPTIONS}
          />
          <FormActions
            submitLabel={form.id ? 'Сохранить изменения' : 'Добавить карточку'}
            busy={busy}
            onReset={() => setForm({ ...emptyCardForm })}
          />
        </form>
      </aside>
    </section>
  );
}

function PracticeManager({
  items,
  categoryOptions = [],
  onCreate,
  onUpdate,
  onDelete,
  onUpload,
  onRefresh,
  onStatus,
  onRenameCategory,
  onDeleteCategory,
  defaultCategory,
}) {
  const [form, setForm] = useState({ ...emptyPracticeForm });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [imageLinkDraft, setImageLinkDraft] = useState('');
  const [imageBackLinkDraft, setImageBackLinkDraft] = useState('');
  const hasCategoryOptions = categoryOptions.length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    onStatus(null, null);
    try {
      const imagesFront = normalizeImageList(form.images_front);
      const imagesBack = normalizeImageList(form.images_back);
      const primaryImage = imagesFront[0] ?? normalizeImageList(form.image_url)[0] ?? null;
      const payload = {
        title: form.title.trim(),
        prompt: form.prompt,
        solution: form.solution,
        points: form.points === '' ? null : Number(form.points),
        difficulty: form.difficulty,
        category: form.category.trim() || 'Общая практика',
        mentor_comment: form.mentor_comment.trim(),
        logo_url: form.logo_url?.trim() || null,
        images_front: imagesFront,
        images_back: imagesBack,
        image_url: primaryImage,
      };
      if (form.id) {
        await onUpdate(form.id, payload);
        onStatus('success', 'Кейс обновлён.');
      } else {
        await onCreate(payload);
        onStatus('success', 'Кейс добавлен.');
      }
      setForm({ ...emptyPracticeForm });
      if (onRefresh) await onRefresh();
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось сохранить кейс.');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (item) => {
    const imagesFront = normalizeImageList(item.images_front ?? item.image_url);
    const imagesBack = normalizeImageList(item.images_back);
    setForm({
      id: item.id,
      category: item.category ?? 'Общая практика',
      title: item.title ?? '',
      prompt: item.prompt ?? '',
      solution: item.solution ?? '',
      points: item.points ?? '',
      difficulty: item.difficulty ?? 'medium',
      mentor_comment: item.mentor_comment ?? '',
      logo_url: item.logo_url ?? '',
      image_url: imagesFront[0] ?? item.image_url ?? '',
      images_front: imagesFront,
      images_back: imagesBack,
    });
    onStatus(null, null);
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Удалить практическое задание?')) return;
    setBusy(true);
    onStatus(null, null);
    try {
      await onDelete(item.id);
      onStatus('success', 'Кейс удалён.');
      if (onRefresh) await onRefresh();
      if (form.id === item.id) {
        setForm({ ...emptyPracticeForm });
      }
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось удалить практику.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Кейсы ({items.length})</h3>
        <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
          {items.length === 0 ? (
            <EmptyState message="Практические кейсы ещё не добавлены." />
            ) : (
              items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.logo_url && (
                        <img
                          src={item.logo_url}
                          alt={item.title}
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                        />
                      )}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{item.category ?? 'Общая практика'}</p>
                      <p className="text-xs text-slate-500">
                        {difficultyLabel(item.difficulty)} · {item.points ? `${item.points} баллов` : 'без оценки'}
                      </p>
                      </div>
                    </div>
                    <ActionButtons onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item)} />
                  </div>
                  {(() => {
                    const normalized = normalizeImageList(item.images_front, item.image_url, item.images_back);
                    return normalized.length ? (
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
                        {normalized.map((url) => (
                          <div key={url} className="overflow-hidden rounded-lg border border-slate-200">
                            <img src={url} alt={item.title} className="h-32 w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {item.prompt && (
                    <p className="whitespace-pre-line text-xs text-slate-600 line-clamp-3">{item.prompt}</p>
                  )}
                  {item.mentor_comment && item.mentor_comment.trim() && (
                    <div className="rounded-xl border border-brand/25 bg-brand/5 px-3 py-2 text-xs text-brand-dark whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold">Комментарий Тимура:</span> {item.mentor_comment}
                    </div>
                  )}
                </article>
              ))
            )}
        </div>
      </div>
      <aside className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {form.id ? 'Редактирование задания' : 'Новое задание'}
          </h3>
          <p className="text-xs text-slate-500">
            Опишите условие, подготовьте решение и, при необходимости, укажите оценивание.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <LabeledInput
            label="Название"
            value={form.title}
            onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
            required
          />
          <LabeledInput
            label="Тема / категория"
            value={form.category}
            onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
            placeholder="Например, Налоги или Банки и кредиты"
            required
          />
          <CategoryPills
            categories={categoryOptions}
            onEdit={(name) => {
              const next = window.prompt('Новое название темы', name);
              if (next === null) return;
              onRenameCategory?.(name, next || defaultCategory);
              if (form.category === name) {
                setForm((prev) => ({ ...prev, category: next || defaultCategory }));
              }
            }}
            onDelete={(name) => {
              if (!window.confirm(`Удалить тему «${name}»? Будет установлено "${defaultCategory}".`)) return;
              onDeleteCategory?.(name);
              if (form.category === name) {
                setForm((prev) => ({ ...prev, category: defaultCategory }));
              }
            }}
          />
          <LabeledInput
            label="Логотип (URL, опционально)"
            type="url"
            value={form.logo_url}
            onChange={(value) => setForm((prev) => ({ ...prev, logo_url: value }))}
            placeholder="https://...logo.png"
          />
          <div className="space-y-2">
            <LabeledInput
              label="Ссылка на изображение (лицевая сторона)"
              type="url"
              value={imageLinkDraft}
              onChange={(value) => setImageLinkDraft(value)}
              placeholder="https://..."
            />
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Или загрузите файл (JPG/PNG), можно несколько
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={async (event) => {
                const files = event.target.files;
                if (!files || !onUpload) return;
                setUploading(true);
                onStatus(null, null);
                const added = [];
                try {
                  for (const file of files) {
                    const uploaded = await onUpload(file);
                    if (uploaded?.url) {
                      added.push(uploaded.url);
                    }
                  }
                  if (added.length) {
                    setForm((prev) => ({
                      ...prev,
                      images_front: Array.from(new Set([...(prev.images_front ?? []), ...added])),
                    }));
                    onStatus('success', `Загружено изображений: ${added.length}`);
                  }
                } catch (error) {
                  onStatus('error', error instanceof Error ? error.message : 'Не удалось загрузить изображение.');
                } finally {
                  setUploading(false);
                  event.target.value = '';
                }
              }}
              disabled={uploading}
            />
            {uploading && <p className="text-xs text-slate-500">Загрузка…</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const url = imageLinkDraft.trim();
                  if (!url) return;
                  setForm((prev) => ({ ...prev, images_front: Array.from(new Set([...(prev.images_front ?? []), url])) }));
                  setImageLinkDraft('');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand/10 disabled:opacity-60"
                disabled={!imageLinkDraft.trim()}
              >
                Добавить ссылку на лицевую
              </button>
              {form.images_front?.length > 0 && (
                <span className="text-xs text-slate-500">Лицевая: {form.images_front.length}</span>
              )}
            </div>
            {form.images_front?.length > 0 && (
              <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                {form.images_front.map((url) => (
                  <div
                    key={url}
                    className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    <a href={url} target="_blank" rel="noreferrer" className="max-w-[160px] truncate text-brand hover:text-brand-dark">
                      {url}
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          images_front: (prev.images_front ?? []).filter((entry) => entry !== url),
                        }))
                      }
                      className="text-rose-500 hover:text-rose-600"
                      aria-label="Удалить"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <LabeledInput
              label="Ссылка на изображение (оборот)"
              type="url"
              value={imageBackLinkDraft}
              onChange={(value) => setImageBackLinkDraft(value)}
              placeholder="https://..."
            />
            <div className="flex flex-wrap gap-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                Или загрузите файл (JPG/PNG) на оборот
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (event) => {
                  const files = event.target.files;
                  if (!files || !onUpload) return;
                  setUploadingBack(true);
                  onStatus(null, null);
                  const added = [];
                  try {
                    for (const file of files) {
                      const uploaded = await onUpload(file);
                      if (uploaded?.url) {
                        added.push(uploaded.url);
                      }
                    }
                    if (added.length) {
                      setForm((prev) => ({
                        ...prev,
                        images_back: Array.from(new Set([...(prev.images_back ?? []), ...added])),
                      }));
                      onStatus('success', `Загружено изображений (оборот): ${added.length}`);
                    }
                  } catch (error) {
                    onStatus('error', error instanceof Error ? error.message : 'Не удалось загрузить изображение.');
                  } finally {
                    setUploadingBack(false);
                    event.target.value = '';
                  }
                }}
                disabled={uploadingBack}
              />
              {uploadingBack && <p className="text-xs text-slate-500">Загрузка оборота…</p>}

              <button
                type="button"
                onClick={() => {
                  const url = imageBackLinkDraft.trim();
                  if (!url) return;
                  setForm((prev) => ({ ...prev, images_back: Array.from(new Set([...(prev.images_back ?? []), url])) }));
                  setImageBackLinkDraft('');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand/10 disabled:opacity-60"
                disabled={!imageBackLinkDraft.trim()}
              >
                Добавить на оборот
              </button>
              {form.images_back?.length > 0 && (
                <span className="text-xs text-slate-500">Оборот: {form.images_back.length}</span>
              )}
            </div>
            {form.images_back?.length > 0 && (
              <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                {form.images_back.map((url) => (
                  <div
                    key={url}
                    className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    <a href={url} target="_blank" rel="noreferrer" className="max-w-[160px] truncate text-brand hover:text-brand-dark">
                      {url}
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          images_back: (prev.images_back ?? []).filter((entry) => entry !== url),
                        }))
                      }
                      className="text-rose-500 hover:text-rose-600"
                      aria-label="Удалить"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {hasCategoryOptions && (
            <CategorySuggestions
              options={categoryOptions}
              onSelect={(option) => setForm((prev) => ({ ...prev, category: option }))}
              label="Темы из карточек:"
            />
          )}
          <LabeledTextarea
            label="Условие"
            value={form.prompt}
            onChange={(value) => setForm((prev) => ({ ...prev, prompt: value }))}
            rows={5}
            required
          />
          <LabeledTextarea
            label="Решение"
            value={form.solution}
            onChange={(value) => setForm((prev) => ({ ...prev, solution: value }))}
            rows={5}
            required
          />
          <LabeledTextarea
            label="Комментарий от Тимура"
            value={form.mentor_comment}
            onChange={(value) => setForm((prev) => ({ ...prev, mentor_comment: value }))}
            rows={6}
            placeholder="Подсказки, на что обратить внимание ученику"
          />
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              label="Баллы"
              type="number"
              min="0"
              value={form.points}
              onChange={(value) => setForm((prev) => ({ ...prev, points: value }))}
              placeholder="Например, 10"
            />
            <LabeledSelect
              label="Сложность"
              value={form.difficulty}
              onChange={(value) => setForm((prev) => ({ ...prev, difficulty: value }))}
              options={DIFFICULTY_OPTIONS}
            />
          </div>
          <FormActions
            submitLabel={form.id ? 'Сохранить изменения' : 'Добавить задание'}
            busy={busy}
            onReset={() => setForm({ ...emptyPracticeForm })}
          />
        </form>
      </aside>
    </section>
  );
}

function KnowledgeManager({
  items,
  categoryOptions = [],
  tagOptions = [],
  students = [],
  onCreate,
  onUpdate,
  onDelete,
  onUpload,
  onSendToStudents,
  onRefresh,
  onStatus,
}) {
  const [form, setForm] = useState({ ...emptyKnowledgeForm });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [list, setList] = useState(items);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setList(items);
  }, [items]);

  useEffect(() => {
    if (!selectedResourceId && list.length > 0) {
      setSelectedResourceId(list[0].id);
    }
  }, [list, selectedResourceId]);

  const studentList = useMemo(() => (students ?? []).filter((item) => !item.is_admin), [students]);
  const allStudentIds = useMemo(() => studentList.map((item) => item.id), [studentList]);
  const allSelected = selectedStudents.length > 0 && selectedStudents.length === allStudentIds.length;

  const toggleStudent = (id) => {
    setSelectedStudents((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleSendToStudents = async () => {
    if (!onSendToStudents) return;
    if (!selectedResourceId) {
      onStatus('error', 'Выберите материал для отправки.');
      return;
    }
    if (selectedStudents.length === 0) {
      onStatus('error', 'Выберите учеников, которым отправить материал.');
      return;
    }
    setSending(true);
    onStatus(null, null);
    try {
      await onSendToStudents(selectedResourceId, selectedStudents);
      onStatus(
        'success',
        `Материал отправлен ${selectedStudents.length === 1 ? 'ученику' : `${selectedStudents.length} ученикам`}.`,
      );
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось отправить материал.');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    onStatus(null, null);
    try {
      let result;
      const tags = parseTags(form.tags);

      const deriveTitle = (fileName, total) => {
        const baseTitle = stripExtension(fileName);
        const prefix = form.title.trim();
        if (total > 1 && prefix) return `${prefix} — ${baseTitle}`;
        return prefix || baseTitle;
      };

      if (form.id) {
        const replacement = uploadedFiles[0];
        const payload = {
          ...form,
          type: replacement?.type ?? form.type,
          url: replacement?.url ?? (form.url || null),
          content: '',
          tags,
        };

        if (!payload.title?.trim()) {
          throw new Error('Укажите название материала.');
        }
        if (!payload.url) {
          throw new Error('Укажите ссылку или загрузите файл.');
        }

        result = await onUpdate({ ...payload, id: form.id });
        if (result) {
          setList((prev) => prev.map((entry) => (entry.id === result.id ? result : entry)));
        }
        setUploadedFiles([]);
        onStatus('success', 'Материал обновлён.');
      } else if (uploadedFiles.length > 0) {
        const created = [];
        for (const file of uploadedFiles) {
          const payload = {
            ...form,
            title: deriveTitle(file.name, uploadedFiles.length),
            type: file.type,
            url: file.url,
            content: '',
            tags,
          };
          if (!payload.category?.trim()) {
            throw new Error('Укажите категорию материала.');
          }
          if (!payload.title?.trim()) {
            throw new Error('Не удалось определить название материала. Укажите его вручную.');
          }
          const entry = await onCreate(payload);
          if (entry) {
            created.push(entry);
          }
        }

        if (created.length) {
          setList((prev) => [...created.reverse(), ...prev]);
          setSelectedResourceId((prev) => prev || created[created.length - 1].id);
        }
        setUploadedFiles([]);
        onStatus('success', created.length === 1 ? 'Материал добавлен.' : `Добавлено материалов: ${created.length}.`);
      } else {
        const payload = {
          ...form,
          url: form.url || null,
          content: '',
          tags,
        };

        if (!payload.title?.trim()) {
          throw new Error('Укажите название материала.');
        }
        if (!payload.url) {
          throw new Error('Укажите ссылку или загрузите файл.');
        }

        result = await onCreate(payload);
        if (result) {
          setList((prev) => [result, ...prev]);
          setSelectedResourceId((prev) => prev || result.id);
        }
        onStatus('success', 'Материал добавлен.');
      }
      setForm({ ...emptyKnowledgeForm });
      if (onRefresh) await onRefresh();
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось сохранить материал.');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (item) => {
    setUploadedFiles([]);
    setForm({
      id: item.id,
      category: item.category ?? '',
      title: item.title ?? '',
      description: item.description ?? '',
      type: item.type ?? 'pdf',
      url: item.url ?? '',
      content: '',
      difficulty: item.difficulty ?? 'medium',
      tags: stringifyTags(item.tags),
    });
    onStatus(null, null);
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Удалить материал из базы знаний?')) return;
    setBusy(true);
    onStatus(null, null);
    try {
      await onDelete(item.id);
      onStatus('success', 'Материал удалён.');
      if (onRefresh) await onRefresh();
      setList((prev) => prev.filter((entry) => entry.id !== item.id));
      if (form.id === item.id) {
        setForm({ ...emptyKnowledgeForm });
      }
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось удалить материал.');
    } finally {
      setBusy(false);
    }
  };

  const stripExtension = (name = '') => name.replace(/\.[^./\\]+$/, '');
  const getUploadedType = (file) => {
    const name = String(file?.name ?? '').toLowerCase();
    const mime = String(file?.type ?? '').toLowerCase();
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    return 'image';
  };

  const handleUpload = async (files) => {
    const queue = Array.isArray(files) ? files : Array.from(files ?? []);
    if (queue.length === 0) return;
    if (!onUpload) {
      onStatus('error', 'Загрузка сейчас недоступна.');
      return;
    }
    setUploading(true);
    onStatus(null, null);
    try {
      const uploaded = [];
      for (const file of queue) {
        const result = await onUpload(file);
        if (!result?.url) {
          throw new Error(`Не удалось получить ссылку для файла «${file.name}».`);
        }
        uploaded.push({
          name: file.name,
          url: result.url,
          type: getUploadedType(file),
        });
      }

      const nextTotal = uploadedFiles.length + uploaded.length;
      setUploadedFiles((prev) => [...prev, ...uploaded]);

      if (nextTotal === 1 && uploaded.length === 1) {
        const entry = uploaded[0];
        setForm((prev) => ({
          ...prev,
          url: entry.url,
          type: entry.type,
          title: prev.title.trim() ? prev.title : stripExtension(entry.name),
        }));
        onStatus('success', 'Файл загружен. Ссылка добавлена.');
      } else {
        setForm((prev) => ({ ...prev, url: '' }));
        onStatus('success', `Загружено файлов: ${uploaded.length}. Будут добавлены отдельными материалами.`);
      }
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось загрузить файл.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Материалы базы ({list.length})</h3>
        <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
          {list.length === 0 ? (
            <EmptyState message="Материалы ещё не добавлены. Загрузите презентации (PDF) или шпоры (изображения)." />
          ) : (
            list.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-500">
                      {item.category} · {difficultyLabel(item.difficulty)} · {item.type === 'pdf' ? 'Презентация' : 'Шпора'}
                    </p>
                  </div>
                  <ActionButtons onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item)} />
                </div>
                {item.description ? (
                  <p className="text-xs text-slate-600">{item.description}</p>
                ) : (
                  <p className="text-xs text-slate-400">Описание отсутствует</p>
                )}
                {item.tags && item.tags.length > 0 && (
                  <p className="text-[11px] uppercase tracking-widest text-slate-400">
                    {item.tags.map((tag) => `#${tag}`).join(' ')}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Отправить материал ученикам</h4>
              <p className="text-xs text-slate-500">Материал появится в разделе «Теория» у выбранных учеников.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedStudents(allStudentIds)}
                disabled={studentList.length === 0 || allSelected}
                className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-50"
              >
                Выбрать всех
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudents([])}
                disabled={selectedStudents.length === 0}
                className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-50"
              >
                Сбросить
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <LabeledSelect
              label="Материал"
              value={selectedResourceId}
              onChange={(value) => setSelectedResourceId(value)}
              options={list.map((item) => ({
                value: item.id,
                label: `${item.category} · ${item.title}`,
              }))}
            />
            <div className="grid max-h-52 gap-2 overflow-auto rounded-xl border border-slate-100 bg-white p-2">
              {studentList.length === 0 ? (
                <p className="text-xs text-slate-500">Список учеников пуст.</p>
              ) : (
                studentList.map((student) => {
                  const isSelected = selectedStudents.includes(student.id);
                  return (
                    <label
                      key={student.id}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-sm ${
                        isSelected ? 'border-brand/60 bg-brand/5 text-brand-dark' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStudent(student.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                      />
                      <span>{student.name ?? student.code}</span>
                    </label>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={handleSendToStudents}
              disabled={sending || studentList.length === 0 || !selectedResourceId}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:opacity-60"
            >
              {sending ? 'Отправляем…' : 'Отправить выбранным'}
            </button>
          </div>
        </div>
      </div>
      <aside className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {form.id ? 'Редактирование материала' : 'Новый материал'}
          </h3>
         <p className="text-xs text-slate-500">
            Добавляйте презентации (PDF) и шпоры (изображения). Файлы автоматически попадают в Supabase Storage.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
        <LabeledInput
          label="Категория"
          value={form.category}
          onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
          placeholder="Например, Банковское дело"
          required
        />
        <CategorySuggestions
          options={categoryOptions}
          onSelect={(option) => setForm((prev) => ({ ...prev, category: option }))}
          label="Популярные категории:"
        />
          <LabeledInput
            label="Название"
            value={form.title}
            onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
            required={uploadedFiles.length === 0}
          />
          <LabeledTextarea
            label="Описание"
            value={form.description}
            onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
            rows={3}
          />
          <LabeledSelect
            label="Тип"
            value={form.type}
            onChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
            options={KNOWLEDGE_TYPE_OPTIONS}
          />
          <LabeledSelect
            label="Сложность"
            value={form.difficulty}
            onChange={(value) => setForm((prev) => ({ ...prev, difficulty: value }))}
            options={DIFFICULTY_OPTIONS}
          />
          <LabeledInput
            label="Теги"
            value={form.tags}
            onChange={(value) => setForm((prev) => ({ ...prev, tags: value }))}
            placeholder="#шпоры, #презентация"
          />
          <TagSuggestions
            options={tagOptions}
            onSelect={(tag) =>
              setForm((prev) => {
                const existing = parseTags(prev.tags);
                if (existing.includes(tag)) return prev;
                const next = [...existing, tag].filter(Boolean);
                return {
                  ...prev,
                  tags: next.join(', '),
                };
              })
            }
          />
          <div className="space-y-2">
            <LabeledInput
              label="Ссылка на файл или ресурс"
              value={form.url}
              onChange={(value) => setForm((prev) => ({ ...prev, url: value }))}
              type="url"
              placeholder="https://..."
              required={uploadedFiles.length === 0}
            />
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Загрузка файла
            </label>
            <input
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) {
                  handleUpload(files);
                }
                event.target.value = '';
              }}
            />
            {uploading && <p className="text-xs text-slate-500">Загрузка…</p>}
            {uploadedFiles.length > 1 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                <p className="font-semibold">Прикреплено файлов: {uploadedFiles.length}</p>
                <ul className="mt-2 space-y-1">
                  {uploadedFiles.map((file, index) => (
                    <li key={`${file.url}-${index}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== index))}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
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
          <FormActions
            submitLabel={form.id ? 'Сохранить изменения' : 'Добавить материал'}
            busy={busy}
            onReset={() => {
              setForm({ ...emptyKnowledgeForm });
              setUploadedFiles([]);
            }}
          />
        </form>
      </aside>
    </section>
  );
}


function ScheduleManager({ items, onCreate, onUpdate, onDelete, onRefresh, onStatus }) {
  const [form, setForm] = useState({ ...emptyScheduleForm });
  const [busy, setBusy] = useState(false);
  const levelOptions = [
    { value: '1 уровень', label: '1 уровень' },
    { value: '2 уровень', label: '2 уровень' },
    { value: '3 уровень', label: '3 уровень' },
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
      onStatus(null, null);
    try {
      const normalizedDates = normalizeScheduleDates(form);
      const payload = {
        ...form,
        title: form.title.trim(),
        date: normalizedDates.orderDate || null,
        date_meta: normalizedDates.meta,
        start: form.start || null,
        end: form.end || null,
        format: form.format || null,
        registration: form.registration || null,
        registration_url: form.registration_url || null,
        logo_url: form.logo_url || null,
        registration_start: form.registration_start || null,
        registration_end: form.registration_end || null,
        level: form.level || null,
      };
      if (form.id) {
        await onUpdate({ ...payload, id: form.id });
        onStatus('success', 'Мероприятие обновлено.');
      } else {
        await onCreate(payload);
        onStatus('success', 'Мероприятие добавлено.');
      }
      setForm({ ...emptyScheduleForm });
      if (onRefresh) await onRefresh();
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось сохранить мероприятие.');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (item) => {
    const parsedDates = parseScheduleMeta(item);
    setForm({
      id: item.id,
      title: item.title ?? '',
      status: item.status ?? 'open',
      date: item.date ?? '',
      start: item.start ?? '',
      end: item.end ?? '',
      format: item.format ?? '',
      level: item.level ?? item.direction ?? '',
      registration: item.registration ?? '',
      registration_start: item.registration_start ?? '',
      registration_end: item.registration_end ?? '',
      registration_url: item.registration_url ?? '',
      logo_url: item.logo_url ?? '',
      date_meta: item.date_meta ?? null,
      date_type: parsedDates.type,
      date_single: parsedDates.single ?? '',
      date_range_start: parsedDates.rangeStart ?? '',
      date_range_end: parsedDates.rangeEnd ?? '',
      multiple_dates: parsedDates.multiple.length ? parsedDates.multiple : [''],
    });
    onStatus(null, null);
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Удалить мероприятие из расписания?')) return;
    setBusy(true);
    onStatus(null, null);
    try {
      await onDelete(item.id);
      onStatus('success', 'Мероприятие удалено.');
      if (onRefresh) await onRefresh();
      if (form.id === item.id) {
        setForm({ ...emptyScheduleForm });
      }
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось удалить мероприятие.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Расписание ({items.length})</h3>
        <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
          {items.length === 0 ? (
            <EmptyState message="Расписание ещё не заполнено. Добавьте мероприятия и этапы." />
	          ) : (
	            items.map((item) => {
	              const parsed = parseScheduleMeta(item);
	              const dateLabel = parsed.displayDate || item.date || 'Дата не указана';
	              const hasTime = Boolean(item.start || item.end);
	              const timeLabel = hasTime ? `${item.start || '—'}–${item.end || '—'}` : 'Время не указано';
	              return (
	                <article
	                  key={item.id}
	                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
	                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.logo_url && (
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <img
                            src={item.logo_url}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        </div>
                      )}
	                      <div>
	                        <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
	                        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
	                          {dateLabel}
	                        </p>
	                      </div>
	                    </div>
	                    <p className="text-xs text-slate-500">
	                      {SCHEDULE_STATUS_OPTIONS.find((option) => option.value === item.status)?.label ?? 'Без статуса'}
	                    </p>
	                    <ActionButtons onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item)} />
	                  </div>
	                  <p className="text-xs text-slate-600">
	                    {timeLabel} · {item.format || 'формат не указан'}
	                  </p>
	                  {item.registration_url && (
	                    <a
	                      href={item.registration_url}
	                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand hover:text-brand-dark"
                    >
                      Ссылка на регистрацию
                    </a>
                  )}
                  {item.registration && (
                    <p className="text-[11px] uppercase tracking-widest text-slate-400">
                      Комментарий: {item.registration}
                    </p>
                  )}
                  {item.registration_start && (
                    <p className="text-[11px] uppercase tracking-widest text-slate-400">
                      Регистрация: c {item.registration_start} до {item.registration_end || '—'}
                    </p>
                  )}
                  {(item.level || item.direction) && (
                    <p className="text-xs text-slate-500">Уровень: {item.level || item.direction}</p>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
      <aside className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {form.id ? 'Редактирование мероприятия' : 'Новое мероприятие'}
          </h3>
          <p className="text-xs text-slate-500">
            Дату, время и ссылки можно оставить пустыми — заполните позже, когда появятся детали.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <LabeledInput
            label="Название"
            value={form.title}
            onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <LabeledSelect
              label="Статус"
              value={form.status}
              onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              options={SCHEDULE_STATUS_OPTIONS}
            />
            <LabeledSelect
              label="Тип даты"
              value={form.date_type}
              onChange={(value) => setForm((prev) => ({ ...prev, date_type: value }))}
              options={[
                { value: 'single', label: 'Один день' },
                { value: 'range', label: 'Диапазон' },
                { value: 'multiple', label: 'Несколько дат' },
              ]}
            />
          </div>
          {form.date_type === 'single' && (
            <LabeledInput
              label="Дата"
              type="date"
              value={form.date_single}
              onChange={(value) => setForm((prev) => ({ ...prev, date_single: value }))}
            />
          )}
          {form.date_type === 'range' && (
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput
                label="Дата начала"
                type="date"
                value={form.date_range_start}
                onChange={(value) => setForm((prev) => ({ ...prev, date_range_start: value }))}
              />
              <LabeledInput
                label="Дата окончания"
                type="date"
                value={form.date_range_end}
                onChange={(value) => setForm((prev) => ({ ...prev, date_range_end: value }))}
              />
            </div>
          )}
          {form.date_type === 'multiple' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Даты</label>
              <div className="space-y-2">
                {form.multiple_dates.map((value, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="date"
                      value={value}
                      onChange={(event) => {
                        const next = [...form.multiple_dates];
                        next[index] = event.target.value;
                        setForm((prev) => ({ ...prev, multiple_dates: next }));
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.multiple_dates.filter((_, idx) => idx !== index);
                        setForm((prev) => ({ ...prev, multiple_dates: next.length ? next : [''] }));
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, multiple_dates: [...prev.multiple_dates, ''] }))
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
              >
                Добавить дату
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              label="Начало"
              type="time"
              value={form.start}
              onChange={(value) => setForm((prev) => ({ ...prev, start: value }))}
            />
            <LabeledInput
              label="Окончание"
              type="time"
              value={form.end}
              onChange={(value) => setForm((prev) => ({ ...prev, end: value }))}
            />
          </div>
          <LabeledInput
            label="Формат"
            value={form.format}
            onChange={(value) => setForm((prev) => ({ ...prev, format: value }))}
            placeholder="Онлайн, очно и т.д."
          />
          <LabeledSelect
            label="Уровень олимпиады"
            value={form.level}
            onChange={(value) => setForm((prev) => ({ ...prev, level: value }))}
            options={levelOptions}
          />
          <LabeledInput
            label="Ссылка на логотип"
            value={form.logo_url}
            onChange={(value) => setForm((prev) => ({ ...prev, logo_url: value }))}
            placeholder="https://..."
          />
          <LabeledInput
            label="Ссылка на регистрацию"
            value={form.registration_url}
            onChange={(value) => setForm((prev) => ({ ...prev, registration_url: value }))}
            placeholder="https://..."
          />
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              label="Регистрация с"
              type="date"
              value={form.registration_start}
              onChange={(value) => setForm((prev) => ({ ...prev, registration_start: value }))}
            />
            <LabeledInput
              label="Регистрация до"
              type="date"
              value={form.registration_end}
              onChange={(value) => setForm((prev) => ({ ...prev, registration_end: value }))}
            />
          </div>
          <LabeledInput
            label="Комментарий"
            value={form.registration}
            onChange={(value) => setForm((prev) => ({ ...prev, registration: value }))}
            placeholder="Примечания, требования и т.п."
          />
          <FormActions
            submitLabel={form.id ? 'Сохранить изменения' : 'Добавить событие'}
            busy={busy}
            onReset={() => setForm({ ...emptyScheduleForm })}
          />
        </form>
      </aside>
    </section>
  );
}

function normalizeScheduleDates(form) {
  const type = form.date_type ?? 'single';
  const multiple = (form.multiple_dates ?? []).filter(Boolean);
  const meta = {
    type,
    single_date: type === 'single' ? form.date_single || form.date : '',
    date_range_start: type === 'range' ? form.date_range_start : '',
    date_range_end: type === 'range' ? form.date_range_end : '',
    multiple_dates: type === 'multiple' ? multiple : [],
  };

  const candidates = [];
  if (meta.single_date) candidates.push(meta.single_date);
  if (meta.date_range_start) candidates.push(meta.date_range_start);
  if (meta.multiple_dates.length) candidates.push(...meta.multiple_dates);
  const orderDate = candidates.length ? candidates.sort()[0] : form.date || null;

  return {
    meta,
    orderDate,
  };
}

function parseScheduleMeta(item = {}) {
  const metaRaw = item.date_meta;
  const meta = typeof metaRaw === 'string' ? safeParseJSON(metaRaw, {}) : metaRaw ?? {};
  const type = meta.type ?? 'single';
  const multiple = Array.isArray(meta.multiple_dates) ? meta.multiple_dates : [];
  const displayDate =
    type === 'range' && meta.date_range_start && meta.date_range_end
      ? `${formatDate(meta.date_range_start)} – ${formatDate(meta.date_range_end)}`
      : type === 'multiple' && multiple.length
        ? multiple.map(formatDate).join(', ')
        : meta.single_date
          ? formatDate(meta.single_date)
          : item.date ?? '';

  return {
    type,
    single: meta.single_date ?? '',
    rangeStart: meta.date_range_start ?? '',
    rangeEnd: meta.date_range_end ?? '',
    multiple,
    displayDate,
  };
}

function PersonalManager({
  knowledgeResources,
  usersApi,
  onLoadByCode,
  onAddEntry,
  onAddEntries,
  onRemoveEntry,
  onUpload,
  onStatus,
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ ...emptyPersonalForm });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfiles, setSelectedProfiles] = useState([]);

  useEffect(() => {
    const loadProfiles = async () => {
      if (!usersApi?.list) return;
      try {
        const data = await usersApi.list();
        setProfiles(Array.isArray(data) ? data : []);
      } catch (error) {
        onStatus('error', error.message ?? 'Не удалось загрузить пользователей.');
      }
    };
    loadProfiles();
  }, [usersApi, onStatus]);

  const studentProfiles = useMemo(() => (profiles ?? []).filter((item) => !item.is_admin), [profiles]);
  const allStudentIds = useMemo(() => studentProfiles.map((item) => item.id), [studentProfiles]);
  const allSelected = selectedProfiles.length > 0 && selectedProfiles.length === allStudentIds.length;

  const handleLoad = async () => {
    if (!code.trim()) {
      onStatus('error', 'Введите код ученика.');
      return;
    }
    setLoading(true);
    onStatus(null, null);
    try {
      const result = await onLoadByCode(code);
      setProfile(result.profile);
      setItems(result.items ?? []);
      setSelectedProfiles((prev) =>
        prev.includes(result.profile.id) ? prev : [...prev, result.profile.id],
      );
      onStatus('success', `Загружены материалы для ${result.profile.name}.`);
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось найти ученика.');
      setProfile(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUseResource = (resourceId) => {
    if (!resourceId) {
      setForm((prev) => ({
        ...emptyPersonalForm,
        resourceId: '',
        difficulty: prev.difficulty,
      }));
      setUploadedFiles([]);
      return;
    }
    const resource = knowledgeResources.find((item) => item.id === resourceId);
    if (!resource) return;
    setUploadedFiles([]);
    setForm({
      resourceId,
      title: resource.title ?? '',
      description: resource.description ?? '',
      type: resource.type ?? 'pdf',
      url: resource.url ?? '',
      content: resource.type === 'text' ? resource.content ?? '' : '',
      difficulty: resource.difficulty ?? 'medium',
      tags: stringifyTags(resource.tags),
    });
  };

  const stripExtension = (name = '') => name.replace(/\.[^./\\]+$/, '');
  const getUploadedType = (file) => {
    const name = String(file?.name ?? '').toLowerCase();
    const mime = String(file?.type ?? '').toLowerCase();
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    return 'image';
  };

  const handleUpload = async (files) => {
    const queue = Array.isArray(files) ? files : Array.from(files ?? []);
    if (queue.length === 0) return;
    if (!onUpload) {
      onStatus('error', 'Загрузка сейчас недоступна.');
      return;
    }
    setUploading(true);
    onStatus(null, null);
    try {
      const uploaded = [];
      for (const file of queue) {
        const result = await onUpload(file);
        if (!result?.url) {
          throw new Error(`Не удалось получить ссылку для файла «${file.name}».`);
        }
        uploaded.push({
          name: file.name,
          url: result.url,
          type: getUploadedType(file),
        });
      }

      const nextTotal = uploadedFiles.length + uploaded.length;
      setUploadedFiles((prev) => [...prev, ...uploaded]);

      if (nextTotal === 1 && uploaded.length === 1) {
        const entry = uploaded[0];
        setForm((prev) => ({
          ...prev,
          resourceId: '',
          url: entry.url,
          type: entry.type,
          title: prev.title.trim() ? prev.title : stripExtension(entry.name),
        }));
        onStatus('success', 'Файл загружен и добавлен в карточку.');
      } else {
        setForm((prev) => ({ ...prev, resourceId: '', url: '' }));
        onStatus('success', `Загружено файлов: ${uploaded.length}. Будут добавлены отдельными материалами.`);
      }
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось загрузить файл.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const targets = new Set(selectedProfiles);
    if (profile?.id) {
      targets.add(profile.id);
    }
    const targetIds = Array.from(targets);
    if (!targetIds.length) {
      onStatus('error', 'Выберите хотя бы одного ученика или найдите по коду.');
      return;
    }
    if (uploadedFiles.length === 0 && !form.url) {
      onStatus('error', 'Укажите ссылку или загрузите файл.');
      return;
    }
    setBusy(true);
    onStatus(null, null);
    try {
      const tags = parseTags(form.tags);

      const deriveTitle = (fileName, total) => {
        const baseTitle = stripExtension(fileName);
        const prefix = form.title.trim();
        if (total > 1 && prefix) return `${prefix} — ${baseTitle}`;
        return prefix || baseTitle;
      };

      if (uploadedFiles.length > 0) {
        let createdCount = 0;
        for (const file of uploadedFiles) {
          const payload = {
            resource_id: null,
            title: deriveTitle(file.name, uploadedFiles.length),
            description: form.description,
            type: file.type,
            url: file.url,
            content: '',
            difficulty: form.difficulty,
            tags,
          };
          const created =
            (onAddEntries && (await onAddEntries(targetIds, payload))) ||
            (await Promise.all(targetIds.map((userId) => onAddEntry(userId, payload))));
          createdCount += 1;
          if (profile?.id) {
            const forProfile = (created ?? []).filter((entry) => String(entry.user_id) === String(profile.id));
            if (forProfile.length) {
              setItems((prev) => [...prev, ...forProfile]);
            }
          }
        }

        setUploadedFiles([]);
        setForm({ ...emptyPersonalForm, type: form.type });
        onStatus(
          'success',
          `Добавлено материалов: ${createdCount}. Получателей: ${targetIds.length}.`,
        );
      } else {
        const payload = {
          resource_id: form.resourceId || null,
          title: form.title,
          description: form.description,
          type: form.type,
          url: form.url || null,
          content: form.type === 'text' ? form.content : '',
          difficulty: form.difficulty,
          tags,
        };
        const created =
          (onAddEntries && (await onAddEntries(targetIds, payload))) ||
          (await Promise.all(targetIds.map((userId) => onAddEntry(userId, payload))));
        if (profile?.id) {
          const forProfile = (created ?? []).filter((entry) => String(entry.user_id) === String(profile.id));
          if (forProfile.length) {
            setItems((prev) => [...prev, ...forProfile]);
          }
        }
        setForm({ ...emptyPersonalForm, type: payload.type });
        onStatus(
          'success',
          `Материал добавлен ${targetIds.length === 1 ? 'ученику' : `${targetIds.length} ученикам`}.`,
        );
      }
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось добавить материал.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (entry) => {
    if (!profile) return;
    if (!window.confirm('Удалить материал из персональной подборки?')) return;
    onStatus(null, null);
    try {
      await onRemoveEntry(profile.id, entry.id);
      setItems((prev) => prev.filter((item) => item.id !== entry.id));
      onStatus('success', 'Материал удалён.');
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Не удалось удалить материал.');
    }
  };

  const resourceOptions = useMemo(
    () =>
      knowledgeResources
        .filter((item) => item.type === 'pdf' || item.type === 'image')
        .map((item) => ({
          value: item.id,
          label: `${item.category} · ${item.title}`,
        })),
    [knowledgeResources],
  );

  const profileOptions = useMemo(
    () =>
      studentProfiles.map((item) => ({
        value: item.code,
        label: `${item.name} · ${item.code}`,
      })),
    [studentProfiles],
  );

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Выбор ученика</h3>
          <p className="mt-1 text-sm text-slate-500">
            Укажите код доступа ученика. После загрузки вы сможете добавить персональные материалы.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            >
              <option value="">Выберите пользователя</option>
              {profileOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="Например, TIMUR-2024"
            />
            <button
              type="button"
              onClick={handleLoad}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:opacity-60"
            >
              {loading ? 'Поиск…' : 'Загрузить'}
            </button>
          </div>
          {profile && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p className="font-semibold">
                {profile.name} · {profile.code}
              </p>
              <p>Материалов: {items.length}</p>
            </div>
          )}
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Выбрать несколько учеников</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProfiles(allStudentIds)}
                  disabled={studentProfiles.length === 0 || allSelected}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  Выбрать всех
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProfiles([])}
                  disabled={selectedProfiles.length === 0}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  Сбросить
                </button>
              </div>
            </div>
            <div className="grid max-h-52 gap-2 overflow-auto rounded-xl border border-slate-100 bg-white p-2">
              {studentProfiles.length === 0 ? (
                <p className="text-xs text-slate-500">Список учеников пуст.</p>
              ) : (
                studentProfiles.map((p) => {
                  const isSelected = selectedProfiles.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-sm ${
                        isSelected ? 'border-brand/60 bg-brand/5 text-brand-dark' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelectedProfiles((prev) =>
                            prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                      />
                      <span>{p.name ?? p.code}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Персональные материалы</h3>
          <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
            {items.length === 0 ? (
              <EmptyState message="Материалы ученика ещё не добавлены." />
            ) : (
              items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-500">
                        {difficultyLabel(item.difficulty)} · {item.type.toUpperCase()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(item)}
                      className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                    >
                      Удалить
                    </button>
                  </div>
                  {item.description ? (
                    <p className="text-xs text-slate-600">{item.description}</p>
                  ) : (
                    <p className="text-xs text-slate-400">Описание отсутствует</p>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      <aside className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Добавить материал ученикам</h3>
          <p className="text-xs text-slate-500">
            Можно выбрать готовый материал из базы знаний или создать отдельный ресурс специально для ученика.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <LabeledSelect
            label="Взять из базы знаний"
            value={form.resourceId}
            onChange={(value) => handleUseResource(value)}
            options={[{ value: '', label: 'Не выбрано' }, ...resourceOptions]}
          />
          <LabeledInput
            label="Название"
            value={form.title}
            onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
            required={uploadedFiles.length === 0}
          />
          <LabeledTextarea
            label="Описание"
            value={form.description}
            onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
            rows={3}
          />
          <LabeledSelect
            label="Тип"
            value={form.type}
            onChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
            options={KNOWLEDGE_TYPE_OPTIONS}
          />
          <LabeledSelect
            label="Сложность"
            value={form.difficulty}
            onChange={(value) => setForm((prev) => ({ ...prev, difficulty: value }))}
            options={DIFFICULTY_OPTIONS}
          />
          <LabeledInput
            label="Теги"
            value={form.tags}
            onChange={(value) => setForm((prev) => ({ ...prev, tags: value }))}
            placeholder="#налоги, #пересмотреть"
          />
          {form.type === 'text' ? (
            <LabeledTextarea
              label="Текст"
              value={form.content}
              onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
              rows={6}
            />
          ) : (
            <div className="space-y-2">
              <LabeledInput
                label="Ссылка"
                type="url"
                value={form.url}
                onChange={(value) => setForm((prev) => ({ ...prev, url: value }))}
                placeholder="https://..."
              />
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                Загрузка файла
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length) {
                    handleUpload(files);
                  }
                  event.target.value = '';
                }}
              />
              {uploading && <p className="text-xs text-slate-500">Загрузка…</p>}
              {uploadedFiles.length > 1 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  <p className="font-semibold">Прикреплено файлов: {uploadedFiles.length}</p>
                  <ul className="mt-2 space-y-1">
                    {uploadedFiles.map((file, index) => (
                      <li key={`${file.url}-${index}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== index))}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
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
          )}
          <FormActions
            submitLabel="Добавить выбранным"
            busy={busy}
            onReset={() => {
              setForm({ ...emptyPersonalForm });
              setUploadedFiles([]);
            }}
          />
        </form>
      </aside>
    </section>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function ActionButtons({ onEdit, onDelete }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg border border-brand/40 px-3 py-1 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand/10"
      >
        Редактировать
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
      >
        Удалить
      </button>
    </div>
  );
}

function LabeledInput({ label, type = 'text', value, onChange, placeholder, required, min }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
    </div>
  );
}

function LabeledTextarea({ label, value, onChange, rows = 4, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
    </div>
  );
}

function LabeledSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FormActions({ submitLabel, busy, onReset }) {
  return (
    <div className="flex gap-3">
      <button
        type="submit"
        disabled={busy}
        className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? 'Сохраняем…' : submitLabel}
      </button>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:border-slate-400"
      >
        Очистить
      </button>
    </div>
  );
}
