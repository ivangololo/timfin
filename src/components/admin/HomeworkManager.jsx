import { useEffect, useMemo, useState } from 'react';
import ResourcePreviewModal from '../ResourcePreviewModal.jsx';

const difficultyOptions = [
  { value: 'easy', label: 'Лёгкая' },
  { value: 'medium', label: 'Средняя' },
  { value: 'hard', label: 'Сложная' },
];

const difficultyDisplay = (value) => difficultyOptions.find((option) => option.value === value)?.label ?? 'Средняя';

const resourceTabs = [
  { id: 'card', label: 'Карточки' },
  { id: 'practice', label: 'Кейсы' },
  { id: 'knowledge', label: 'Презентации/шпоры' },
];

const submissionStatuses = [
  { id: 'assigned', label: 'Не отправлено' },
  { id: 'in_progress', label: 'Отправлено' },
  { id: 'in_review', label: 'На проверке' },
  { id: 'rejected', label: 'Отклонено' },
  { id: 'completed', label: 'Проверено' },
];

const statusDescriptions = {
  assigned: 'Задание назначено ученику',
  in_progress: 'Ученик отправил решение и ждёт проверки',
  in_review: 'Решение проверяется наставником',
  completed: 'Проверка завершена',
  rejected: 'Отправлено на доработку',
};

const statusPalette = {
  assigned: 'bg-slate-200 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-700',
  in_review: 'bg-brand/10 text-brand-dark',
  completed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const statusLabel = submissionStatuses.reduce((acc, status) => {
  acc[status.id] = status.label;
  return acc;
}, {});

const tabLabel = (type) => resourceTabs.find((tab) => tab.id === type)?.label ?? type;

export default function HomeworkManager({
  assignments = [],
  submissions = [],
  cards = [],
  practiceCases = [],
  knowledgeResources = [],
  profiles = [],
  recipientStudentIds = [],
  onStatus,
  onCreateAssignment,
  onDeleteAssignment,
  onUploadSubmissionFile,
  onUpdateSubmission,
  onRefresh,
  onBack,
  uploading = false,
  supportsTargeting = true,
}) {
  const [selectedResourceTab, setSelectedResourceTab] = useState('knowledge');
  const [form, setForm] = useState(initialFormState());
  const [feedbackNotes, setFeedbackNotes] = useState({});
  const [preview, setPreview] = useState(null);
  const [showTargetError, setShowTargetError] = useState(false);
  const [useRecipientsList, setUseRecipientsList] = useState(false);
  const [reviewQuery, setReviewQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);
  const [busySubmissionId, setBusySubmissionId] = useState(null);
  const assignmentsById = useMemo(() => {
    const map = new Map();
    assignments.forEach((assignment) => map.set(assignment.id, assignment));
    return map;
  }, [assignments]);
  const sortedSubmissions = useMemo(() => {
    return [...submissions].sort(
      (a, b) => new Date(b.updated_at ?? b.created_at ?? 0) - new Date(a.updated_at ?? a.created_at ?? 0),
    );
  }, [submissions]);

  const reviewCounts = useMemo(() => {
    const counts = submissionStatuses.reduce(
      (acc, status) => {
        acc[status.id] = 0;
        return acc;
      },
      { all: 0 },
    );

    sortedSubmissions.forEach((submission) => {
      const status = submission.status ?? 'assigned';
      counts.all += 1;
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      }
    });

    return counts;
  }, [sortedSubmissions]);

  const filteredReviewSubmissions = useMemo(() => {
    const normalizedQuery = reviewQuery.trim().toLowerCase();
    return sortedSubmissions.filter((submission) => {
      const status = submission.status ?? 'assigned';
      if (reviewFilter !== 'all' && status !== reviewFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      const studentName = String(submission.user?.name ?? '').toLowerCase();
      const studentCode = String(submission.user?.code ?? '').toLowerCase();
      const assignmentTitle = String(assignmentsById.get(submission.homework_id)?.title ?? '').toLowerCase();
      return (
        studentName.includes(normalizedQuery) ||
        studentCode.includes(normalizedQuery) ||
        assignmentTitle.includes(normalizedQuery)
      );
    });
  }, [sortedSubmissions, reviewQuery, reviewFilter, assignmentsById]);

  useEffect(() => {
    if (filteredReviewSubmissions.length === 0) {
      setActiveSubmissionId(null);
      return;
    }
    if (!activeSubmissionId || !filteredReviewSubmissions.some((item) => item.id === activeSubmissionId)) {
      setActiveSubmissionId(filteredReviewSubmissions[0].id);
    }
  }, [filteredReviewSubmissions, activeSubmissionId]);

  const activeSubmission = useMemo(() => {
    if (!activeSubmissionId) return null;
    return (
      filteredReviewSubmissions.find((item) => item.id === activeSubmissionId) ??
      sortedSubmissions.find((item) => item.id === activeSubmissionId) ??
      null
    );
  }, [activeSubmissionId, filteredReviewSubmissions, sortedSubmissions]);

  useEffect(() => {
    if (!activeSubmission?.id) return;
    setFeedbackNotes((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, activeSubmission.id)) return prev;
      return { ...prev, [activeSubmission.id]: activeSubmission.reviewer_note ?? '' };
    });
  }, [activeSubmission?.id, activeSubmission?.reviewer_note]);

  useEffect(() => {
    if (!supportsTargeting) {
      setForm((prev) => {
        if (prev.assignTo === 'all' && prev.targetProfiles.length === 0) {
          return prev;
        }
        return { ...prev, assignTo: 'all', targetProfiles: [] };
      });
      setShowTargetError(false);
      setUseRecipientsList(false);
    }
  }, [supportsTargeting]);

  useEffect(() => {
    if (!useRecipientsList) return;
    setForm((prev) => ({
      ...prev,
      assignTo: 'selected',
      targetProfiles: recipientStudentIds.map(String),
    }));
    if (recipientStudentIds.length > 0) {
      setShowTargetError(false);
    }
  }, [useRecipientsList, recipientStudentIds]);

  const resourceOptions = useMemo(
    () => ({
      card: cards.map((card) => ({
        id: String(card.id),
        title: card.question,
        helper: `${card.category ?? 'Без категории'} · ${difficultyDisplay(card.difficulty)}`,
      })),
      practice: practiceCases.map((item) => ({
        id: String(item.id),
        title: item.title,
        helper: `${difficultyDisplay(item.difficulty)} · ${item.points ?? 0} баллов`,
      })),
      knowledge: (knowledgeResources ?? [])
        .filter((item) => item.type === 'pdf' || item.type === 'image')
        .map((item) => ({
          id: String(item.id),
          title: item.title,
          helper: item.category
            ? `${item.category} · ${item.type === 'pdf' ? 'Презентация' : 'Шпора'}`
            : item.type === 'pdf'
              ? 'Презентация'
          : 'Шпора',
        })),
    }),
    [cards, practiceCases, knowledgeResources],
  );

  const profileOptions = useMemo(
    () =>
      (profiles ?? [])
        .map((profile) => ({
          id: profile.id,
          name: profile.name ?? profile.code,
          code: profile.code,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [profiles],
  );

  const resourcePreview = useMemo(() => {
    const groups = {};
    resourceTabs.forEach((tab) => {
      groups[tab.id] = [];
    });

    Object.entries(form.links).forEach(([type, ids]) => {
      const options = resourceOptions[type] ?? [];
      if (!groups[type]) return;
      ids.forEach((rawId) => {
        const normalized = String(rawId);
        const match = options.find((option) => option.id === normalized);
        if (match) {
          groups[type].push(match);
        }
      });
    });

    const total = Object.values(groups).reduce((sum, list) => sum + list.length, 0);
    return { groups, total };
  }, [form.links, resourceOptions]);

  const selectedTabLabel = tabLabel(selectedResourceTab);
  const currentOptions = resourceOptions[selectedResourceTab] ?? [];

  const resetForm = () => {
    setForm(initialFormState());
    setShowTargetError(false);
    setUseRecipientsList(false);
  };

  const handleToggleResource = (type, id) => {
    setForm((prev) => {
      const current = (prev.links[type] ?? []).map(String);
      const normalizedId = String(id);
      const exists = current.includes(normalizedId);
      const updated = exists ? current.filter((value) => value !== normalizedId) : [...current, normalizedId];
      return {
        ...prev,
        links: {
          ...prev.links,
          [type]: updated,
        },
      };
    });
  };

  const handleFileSelection = (event) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setForm((prev) => ({
      ...prev,
      files: [
        ...prev.files,
        ...files.map((file) => ({
          file,
          title: file.name,
          description: '',
        })),
      ],
    }));
    event.target.value = '';
  };

  const handleCreateAssignment = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    if (form.assignTo === 'selected' && form.targetProfiles.length === 0) {
      setShowTargetError(true);
      return;
    }
    if (!onCreateAssignment) {
      onStatus?.('error', 'Функция создания заданий недоступна.');
      return;
    }
    const targetIds = form.targetProfiles.map(String);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      difficulty: form.difficulty,
      due_date: form.due_date || null,
      links: Object.entries(form.links).flatMap(([resource_type, ids]) =>
        ids.map((reference_id) => ({
          resource_type,
          reference_id: String(reference_id),
        })),
      ),
      files: form.files,
      assignTo: form.assignTo,
      targetProfileIds: targetIds,
    };
    try {
      await onCreateAssignment(payload);
      resetForm();
      await onRefresh?.();
      onStatus?.('success', 'Домашнее задание создано.');
    } catch (error) {
      onStatus?.('error', error instanceof Error ? error.message : 'Не удалось создать домашнее задание.');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Удалить домашнее задание?')) return;
    if (!onDeleteAssignment) {
      onStatus?.('error', 'Функция удаления заданий недоступна.');
      return;
    }
    try {
      await onDeleteAssignment(assignmentId);
      await onRefresh?.();
      onStatus?.('success', 'Домашнее задание удалено.');
    } catch (error) {
      onStatus?.('error', error instanceof Error ? error.message : 'Не удалось удалить домашнее задание.');
    }
  };

  const setSubmissionNote = (submissionId, value) => {
    setFeedbackNotes((prev) => ({
      ...prev,
      [submissionId]: value,
    }));
  };

  const handleUploadFeedbackFiles = async (submission, files) => {
    if (!files?.length) return;
    if (!onUploadSubmissionFile) {
      onStatus?.('error', 'Загрузка файлов недоступна.');
      return;
    }
    setBusySubmissionId(submission.id);
    try {
      for (const file of files) {
        await onUploadSubmissionFile(submission.id, file, {
          role: 'tutor',
          note: feedbackNotes[submission.id] ?? submission.reviewer_note ?? '',
        });
      }
      if (onUpdateSubmission) {
        await onUpdateSubmission(submission.id, {
          reviewer_note: feedbackNotes[submission.id] ?? submission.reviewer_note ?? '',
        });
      }
      await onRefresh?.();
      onStatus?.('success', 'Файл прикреплён.');
    } catch (error) {
      onStatus?.('error', error instanceof Error ? error.message : 'Не удалось прикрепить файл.');
    } finally {
      setBusySubmissionId(null);
    }
  };

  const handleUpdateSubmissionStatus = async (submission, status) => {
    if (!onUpdateSubmission) {
      onStatus?.('error', 'Изменение статуса недоступно.');
      return;
    }
    setBusySubmissionId(submission.id);
    try {
      await onUpdateSubmission(submission.id, {
        status,
        reviewer_note: feedbackNotes[submission.id] ?? submission.reviewer_note ?? '',
      });
      await onRefresh?.();
      onStatus?.('success', 'Статус обновлён.');
    } catch (error) {
      onStatus?.('error', error instanceof Error ? error.message : 'Не удалось обновить статус.');
    } finally {
      setBusySubmissionId(null);
    }
  };

  return (
    <>
      <div className="space-y-10">
        <div className="flex flex-col gap-3 rounded-3xl border border-white/60 bg-white/90 px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Домашние задания</h2>
            <p className="text-xs text-slate-500">Создавайте задания, прикрепляйте материалы и отслеживайте прогресс учеников.</p>
          </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M12.707 15.707a1 1 0 01-1.414 0L6.586 11l4.707-4.707a1 1 0 10-1.414-1.414l-5.414 5.414a1 1 0 000 1.414l5.414 5.414a1 1 0 001.414 0z" />
            </svg>
            Назад
          </button>
        )}
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_minmax(0,1fr)]">
        <form
          onSubmit={handleCreateAssignment}
          className="flex flex-col gap-6 rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_28px_60px_rgba(15,23,42,0.15)] backdrop-blur"
        >
          <HeaderBlock
            title="Создать домашнее задание"
            subtitle="Назначьте задание, добавьте материалы и файлы — ученики увидят его мгновенно."
          />

          <FieldBlock
            label="Название"
            element={
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="Домашнее задание по теме «Налоги»"
              />
            }
          />

          <FieldBlock
            label="Описание"
            element={
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                rows={3}
                placeholder="Кратко опишите, что нужно сделать и на что обратить внимание."
              />
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock
              label="Сложность"
              element={
                <select
                  value={form.difficulty}
                  onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                >
                  {difficultyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            />
            <FieldBlock
              label="Дедлайн"
              element={
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              }
            />
          </div>

          <FieldBlock
            label="Кому назначить"
            element={
              <div className="space-y-4">
                <div className="inline-flex rounded-2xl border border-white/60 bg-white/90 p-1 shadow-inner">
                  <button
                    type="button"
                    onClick={() => {
                      setUseRecipientsList(false);
                      setShowTargetError(false);
                      setForm((prev) => ({ ...prev, assignTo: 'all', targetProfiles: [] }));
                    }}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      form.assignTo === 'all'
                        ? 'bg-brand text-white shadow-lg shadow-brand/30'
                        : 'text-slate-600 hover:bg-brand/10'
                    }`}
                  >
                    Всем ученикам
                  </button>
                  {supportsTargeting && (
                    <button
                      type="button"
                      onClick={() => {
                        setUseRecipientsList(false);
                        setForm((prev) => ({ ...prev, assignTo: 'selected' }));
                        if (form.targetProfiles.length > 0) {
                          setShowTargetError(false);
                        }
                      }}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        form.assignTo === 'selected'
                          ? 'bg-brand text-white shadow-lg shadow-brand/30'
                          : 'text-slate-600 hover:bg-brand/10'
                      }`}
                    >
                      Выбрать учеников
                    </button>
                  )}
                  {supportsTargeting && (
                    <button
                      type="button"
                      onClick={() => {
                        setUseRecipientsList(true);
                        setForm((prev) => ({
                          ...prev,
                          assignTo: 'selected',
                          targetProfiles: recipientStudentIds.map(String),
                        }));
                        if (recipientStudentIds.length > 0) {
                          setShowTargetError(false);
                        }
                      }}
                      disabled={recipientStudentIds.length === 0}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        useRecipientsList
                          ? 'bg-brand text-white shadow-lg shadow-brand/30'
                          : 'text-slate-600 hover:bg-brand/10'
                      } ${recipientStudentIds.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      Моим получателям
                    </button>
                  )}
                </div>
                {supportsTargeting ? (
                  <>
                    {form.assignTo === 'selected' && (
                      <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-white/60 bg-white/90 p-3 shadow-inner">
                        {profileOptions.length === 0 ? (
                          <p className="text-xs text-slate-400">Нет учеников. Добавьте их на вкладке «Пользователи».</p>
                        ) : (
                          profileOptions.map((profile) => {
                            const checked = form.targetProfiles.includes(profile.id);
                            return (
                              <label
                                key={profile.id}
                                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                                  checked
                                    ? 'border-brand bg-brand/10 text-brand-dark shadow-[0_10px_22px_rgba(37,99,235,0.18)]'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand/40'
                                }`}
                              >
                                <div>
                                  <p className="font-semibold leading-snug text-slate-800">{profile.name}</p>
                                  <p className="text-xs text-slate-400">{profile.code}</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setForm((prev) => {
                                      setUseRecipientsList(false);
                                      const current = new Set(prev.targetProfiles);
                                      if (current.has(profile.id)) {
                                        current.delete(profile.id);
                                      } else {
                                        current.add(profile.id);
                                      }
                                      const updated = Array.from(current);
                                      if (updated.length > 0) {
                                        setShowTargetError(false);
                                      }
                                      return { ...prev, targetProfiles: updated };
                                    })
                                  }
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}
                    {form.assignTo === 'selected' && form.targetProfiles.length === 0 && showTargetError && (
                          <p className="text-xs text-rose-500">Выберите хотя бы одного ученика, чтобы назначить задание выборочно.</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400">Назначение конкретным ученикам станет доступно после обновления базы данных.</p>
                )}
                {supportsTargeting && recipientStudentIds.length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Кнопка «Моим получателям» подставляет список из раздела «Получатели ДЗ» и отправит задание только им.
                  </p>
                )}
              </div>
            }
          />

          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Связанные материалы
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Отметьте карточки, кейсы и презентации/шпоры, которые должны сопровождать задание.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {resourceTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedResourceTab(tab.id)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] transition ${
                      selectedResourceTab === tab.id
                        ? 'border-brand bg-brand text-white shadow shadow-brand/30'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand/40 hover:text-brand'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-white/90 to-brand/5 p-4 shadow-inner">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Выбранные материалы</p>
                <p className="text-xs text-slate-500">Быстрый доступ к содержимому — откройте карточку или кейс в отдельном окне.</p>
              </div>
              {resourcePreview.total === 0 ? (
                <p className="text-sm text-slate-500">
                  Пока не выбрано ни одного материала. Используйте переключатели выше, чтобы добавить источники.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
              {resourceTabs.map((tab) => {
                const items = resourcePreview.groups[tab.id];
                if (!items || items.length === 0) return null;
                return (
                  <div
                    key={tab.id}
                    className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                  >
                    <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {tab.label} · {items.length}
                    </h4>
                    <ul className="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-1 text-xs text-slate-600">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-2 rounded-xl border border-white/70 bg-white px-3 py-2 shadow-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">{item.title}</p>
                            {item.helper && <p className="mt-1 text-[11px] text-slate-500">{item.helper}</p>}
                          </div>
                          <QuickPreviewButton
                            type={tab.id}
                            item={item}
                            onPreview={(resource) => setPreview(resource)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

            <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-inner">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-800">{selectedTabLabel}</h4>
                <span className="text-xs text-slate-500">
                  Выбрано: {form.links[selectedResourceTab]?.length ?? 0} из {currentOptions.length}
                </span>
              </div>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                {currentOptions.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Нет элементов для категории «{selectedTabLabel}». Добавьте материалы в соответствующий раздел.
                  </p>
                ) : (
                  currentOptions.map((option) => {
                    const checked = (form.links[selectedResourceTab] ?? []).includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                          checked
                            ? 'border-brand bg-brand/10 text-brand-dark shadow-[0_10px_24px_rgba(59,130,246,0.18)]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-brand/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => handleToggleResource(selectedResourceTab, option.id)}
                        />
                        <div>
                          <p className="font-medium leading-snug text-slate-800">{option.title}</p>
                          {option.helper && <p className="text-xs text-slate-500">{option.helper}</p>}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Файлы задания</label>
            <div className="rounded-2xl border border-white/60 bg-white/90 px-4 py-4 shadow-inner">
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-brand/30 bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow shadow-brand/30 transition hover:bg-brand-dark">
                <input type="file" multiple className="hidden" onChange={handleFileSelection} />
                Прикрепить файлы
              </label>
              {form.files.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {form.files.map((fileWrapper, index) => (
                    <li
                      key={`${fileWrapper.file.name}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white px-3 py-2 shadow-sm"
                    >
                      <span>{fileWrapper.file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            files: prev.files.filter((_, idx) => idx !== index),
                          }))
                        }
                        className="text-xs text-rose-500 hover:text-rose-600"
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
              disabled={uploading}
            >
              Сбросить
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
              disabled={uploading || !form.title.trim()}
            >
              {uploading ? 'Создаём…' : 'Создать задание'}
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_28px_60px_rgba(15,23,42,0.15)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Назначенные задания</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
              >
                Обновить
              </button>
            </div>
      </div>

        <div className="grid gap-4">
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-500">Домашних заданий пока нет — создайте первое задание с левой стороны.</p>
          ) : (
            assignments.map((assignment) => {
            const assignmentSubmissions = submissions.filter(
              (item) => item.homework_id === assignment.id,
            );
                const linksByType = (assignment.links ?? []).reduce((acc, link) => {
                  const key = link.resource_type;
                  acc[key] = (acc[key] ?? 0) + 1;
                  return acc;
                }, {});
                const files = assignment.files ?? [];
                const targetLabel = assignment.assign_to === 'selected'
                  ? `Назначено: ${(assignment.target_profiles || []).length} ученикам`
                  : 'Назначено всем ученикам';
                const dueDate =
                  assignment.due_date && !Number.isNaN(Date.parse(assignment.due_date))
                    ? new Date(assignment.due_date).toLocaleDateString('ru-RU')
                    : 'Без срока';

                return (
                  <article
                    key={assignment.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/95 px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-semibold text-slate-900">{assignment.title}</h4>
                        <p className="text-xs text-slate-500">
                          Сложность: {difficultyDisplay(assignment.difficulty)} · Дедлайн: {dueDate}
                        </p>
                        <p className="text-xs text-slate-500">{targetLabel}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="inline-flex items-center gap-2 self-start rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                      >
                        Удалить
                      </button>
                    </div>

                    {Object.keys(linksByType).length > 0 && (
                      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        {Object.entries(linksByType).map(([type, count]) => (
                          <div
                            key={type}
                            className="rounded-xl border border-white/70 bg-slate-50 px-3 py-2 shadow-inner"
                          >
                            <p className="font-semibold text-slate-800">{tabLabel(type)}</p>
                            <p>{count} материал(а)</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {files.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Файлы задания</h5>
                        <ul className="space-y-2 text-xs text-slate-600">
                          {files.map((file) => (
                            <li
                              key={file.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white px-3 py-2"
                            >
                              <span className="font-semibold text-slate-800">{file.title ?? file.file_url}</span>
                              <a
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brand hover:text-brand-dark"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M8 2a2 2 0 00-2 2v6a2 2 0 104 0V6h2v4a4 4 0 11-8 0V4a4 4 0 018 0v1a1 1 0 11-2 0V4a2 2 0 00-2-2z" />
                                  <path d="M5 18a1 1 0 110-2h10a1 1 0 110 2H5z" />
                                </svg>
                                Скачать
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>Ответов: {assignmentSubmissions.length}</span>
                      {assignmentSubmissions.some((item) => item.status === 'in_review') && (
                        <span className="text-brand-dark">
                          На проверке: {assignmentSubmissions.filter((item) => item.status === 'in_review').length}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Рабочая среда проверки</h3>
            <p className="text-sm text-slate-600">
              Входящие решения учеников (по «Получателям ДЗ»): статусы, комментарии и файлы.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
          >
            Обновить
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/90 p-6 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
            <input
              type="text"
              value={reviewQuery}
              onChange={(event) => setReviewQuery(event.target.value)}
              placeholder="Поиск: ученик, код, задание…"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReviewFilter('all')}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] transition ${
                  reviewFilter === 'all'
                    ? 'border-brand bg-brand text-white shadow shadow-brand/30'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand/40 hover:text-brand'
                }`}
              >
                Все · {reviewCounts.all}
              </button>
              {submissionStatuses.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => setReviewFilter(status.id)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] transition ${
                    reviewFilter === status.id
                      ? 'border-brand bg-brand text-white shadow shadow-brand/30'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand/40 hover:text-brand'
                  }`}
                >
                  {status.label} · {reviewCounts[status.id] ?? 0}
                </button>
              ))}
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {filteredReviewSubmissions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {sortedSubmissions.length === 0
                    ? 'Пока нет отправленных домашних заданий.'
                    : 'Ничего не найдено по выбранному фильтру.'}
                </div>
              ) : (
                filteredReviewSubmissions.map((submission) => {
                  const assignment = assignmentsById.get(submission.homework_id);
                  const student = submission.user;
                  const updatedAt = new Date(submission.updated_at ?? submission.created_at).toLocaleString('ru-RU');
                  const studentFilesCount = submission.files?.filter((file) => file.role !== 'tutor').length ?? 0;
                  const isActive = submission.id === activeSubmissionId;
                  return (
                    <button
                      key={submission.id}
                      type="button"
                      onClick={() => setActiveSubmissionId(submission.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? 'border-brand/50 bg-brand/5 shadow-[0_18px_40px_rgba(37,99,235,0.14)]'
                          : 'border-white/60 bg-white hover:border-brand/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                            {assignment?.title ?? `Задание #${submission.homework_id}`}
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {student?.name ?? 'Ученик'} · {student?.code ?? '—'}
                          </p>
                          <p className="text-xs text-slate-500">Обновлено: {updatedAt}</p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                            statusPalette[submission.status] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabel[submission.status] ?? submission.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                          Файлов: {studentFilesCount}
                        </span>
                        {submission.student_note && (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                            Есть комментарий
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
            {!activeSubmission ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Выберите работу слева, чтобы открыть карточку проверки.
              </div>
            ) : (
              (() => {
                const assignment = assignmentsById.get(activeSubmission.homework_id);
                const student = activeSubmission.user;
                const updatedAt = new Date(activeSubmission.updated_at ?? activeSubmission.created_at).toLocaleString('ru-RU');
                const noteValue = feedbackNotes[activeSubmission.id] ?? activeSubmission.reviewer_note ?? '';
                const studentFiles = activeSubmission.files?.filter((file) => file.role !== 'tutor') ?? [];
                const tutorFiles = activeSubmission.files?.filter((file) => file.role === 'tutor') ?? [];
                const isBusy = busySubmissionId === activeSubmission.id;
                const currentStatus = activeSubmission.status ?? 'assigned';

                const statusFlow = [
                  { id: 'assigned', label: statusLabel.assigned, description: statusDescriptions.assigned },
                  { id: 'in_progress', label: statusLabel.in_progress, description: statusDescriptions.in_progress },
                  { id: 'in_review', label: statusLabel.in_review, description: statusDescriptions.in_review },
                  { id: 'completed', label: statusLabel.completed, description: statusDescriptions.completed },
                  { id: 'rejected', label: statusLabel.rejected, description: statusDescriptions.rejected },
                ];

                const linearOrder = ['assigned', 'in_progress', 'in_review', 'completed'];
                const currentIndex = linearOrder.indexOf(currentStatus);
                const isStepDone = (stepId) => {
                  if (currentStatus === 'rejected') return false;
                  const index = linearOrder.indexOf(stepId);
                  if (index === -1 || currentIndex === -1) return false;
                  return index <= currentIndex;
                };

                const renderFileName = (file) => {
                  const raw = String(file?.title ?? file?.file_url ?? '').split('?')[0];
                  const last = raw.split('/').pop();
                  return last || 'Файл';
                };

                return (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                          {assignment?.title ?? `Задание #${activeSubmission.homework_id}`}
                        </p>
                        <h4 className="text-xl font-semibold text-slate-900">
                          {student?.name ?? 'Ученик'} · {student?.code ?? '—'}
                        </h4>
                        <p className="text-xs text-slate-500">Обновлено: {updatedAt}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] ${
                          statusPalette[currentStatus] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {statusLabel[currentStatus] ?? currentStatus}
                      </span>
                    </div>

                    {assignment?.description && (
                      <div className="rounded-2xl border border-white/60 bg-white px-4 py-3 text-sm text-slate-600 shadow-inner">
                        {assignment.description}
                      </div>
                    )}

                    <div className="rounded-3xl border border-white/60 bg-white/95 p-5 shadow-inner">
                      <h5 className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                        Статус проверки
                      </h5>
                      <div className="mt-4 space-y-2">
                        {statusFlow.map((step) => {
                          const active = currentStatus === step.id;
                          const done = isStepDone(step.id);
                          const isRejected = step.id === 'rejected';
                          return (
                            <button
                              key={step.id}
                              type="button"
                              onClick={() => handleUpdateSubmissionStatus(activeSubmission, step.id)}
                              disabled={isBusy}
                              className={`w-full rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                                active
                                  ? isRejected
                                    ? 'border-rose-300 bg-rose-50'
                                    : 'border-brand/40 bg-brand/5'
                                  : 'border-slate-200 bg-white hover:border-brand/30'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                                    active
                                      ? isRejected
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-brand/10 text-brand-dark'
                                      : done
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {done ? '✓' : active ? '•' : ''}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                                  <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/60 bg-white px-4 py-3 shadow-inner">
                      <h5 className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                        Комментарий ученика
                      </h5>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                        {activeSubmission.student_note ? activeSubmission.student_note : 'Комментариев нет.'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                        Комментарий наставника
                      </label>
                      <textarea
                        value={noteValue}
                        onChange={(event) => setSubmissionNote(activeSubmission.id, event.target.value)}
                        placeholder="Напишите фидбек для ученика (появится в ДЗ)"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                        rows={4}
                        disabled={isBusy}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateSubmissionStatus(activeSubmission, currentStatus)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-60"
                        >
                          Сохранить комментарий
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateSubmissionStatus(activeSubmission, 'completed')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                        >
                          Отметить «Проверено»
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateSubmissionStatus(activeSubmission, 'rejected')}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                        >
                          На доработку
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Файлы ученика</h5>
                        {studentFiles.length === 0 ? (
                          <p className="text-sm text-slate-500">Файлов нет.</p>
                        ) : (
                          <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                            {studentFiles.map((file) => (
                              <li key={file.id} className="rounded-2xl border border-white/60 bg-slate-50 px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <a
                                    href={file.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-brand hover:text-brand-dark"
                                  >
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm7 2a1 1 0 00-1 1v4.586L7.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l4-4a1 1 0 10-1.414-1.414L11 10.586V6a1 1 0 00-1-1z" />
                                    </svg>
                                    {renderFileName(file)}
                                  </a>
                                  <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                                    {new Date(file.created_at).toLocaleDateString('ru-RU')}
                                  </span>
                                </div>
                                {file.note && <p className="mt-2 text-xs text-slate-500">{file.note}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h5 className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                            Файлы наставника
                          </h5>
                          <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-xl border border-brand/30 bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark">
                            <input
                              type="file"
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              multiple
                              onChange={(event) => {
                                const files = Array.from(event.target.files ?? []);
                                if (files.length) {
                                  handleUploadFeedbackFiles(activeSubmission, files);
                                  event.target.value = '';
                                }
                              }}
                              disabled={isBusy}
                            />
                            Прикрепить файл
                          </label>
                        </div>
                        {tutorFiles.length === 0 ? (
                          <p className="text-sm text-slate-500">Пока нет файлов.</p>
                        ) : (
                          <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                            {tutorFiles.map((file) => (
                              <li key={file.id} className="rounded-2xl border border-white/60 bg-slate-50 px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <a
                                    href={file.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-brand hover:text-brand-dark"
                                  >
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm7 2a1 1 0 00-1 1v4.586L7.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l4-4a1 1 0 10-1.414-1.414L11 10.586V6a1 1 0 00-1-1z" />
                                    </svg>
                                    {renderFileName(file)}
                                  </a>
                                  <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                                    {new Date(file.created_at).toLocaleDateString('ru-RU')}
                                  </span>
                                </div>
                                {file.note && <p className="mt-2 text-xs text-slate-500">{file.note}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </section>
      </div>
      {preview && (
        <ResourcePreviewModal
          data={preview}
          onClose={() => setPreview(null)}
          knowledgeResources={knowledgeResources}
          cards={cards}
          practiceCases={practiceCases}
          theoryItems={[]}
          personalTheory={[]}
        />
      )}
    </>
  );
}

function HeaderBlock({ title, subtitle }) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}

function FieldBlock({ label, element }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{label}</label>
      {element}
    </div>
  );
}

function initialFormState() {
  return {
    title: '',
    description: '',
    difficulty: 'medium',
    due_date: '',
    assignTo: 'selected',
    targetProfiles: [],
    links: {
      card: [],
      practice: [],
      knowledge: [],
    },
    files: [],
  };
}

function QuickPreviewButton({ type, item, onPreview }) {
  return (
    <button
      type="button"
      onClick={() => onPreview({ type, id: item.id, canViewSolution: true, allowReveal: true })}
      className="rounded-lg border border-brand/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-brand transition hover:border-brand hover:bg-brand/10"
    >
      Открыть
    </button>
  );
}
