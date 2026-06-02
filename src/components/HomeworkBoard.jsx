import { useEffect, useMemo, useRef, useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';
import ResourcePreviewModal from './ResourcePreviewModal.jsx';

const STATUS_META = {
  assigned: {
    label: 'Не отправлено',
    accent: 'bg-slate-200 text-slate-700',
    description: 'Ознакомьтесь с заданием и прикрепите решение.',
  },
  in_progress: {
    label: 'Отправлено',
    accent: 'bg-amber-100 text-amber-700',
    description: 'Решение отправлено наставнику. Можно заменить файлы до начала проверки.',
  },
  in_review: {
    label: 'На проверке',
    accent: 'bg-brand/10 text-brand-dark',
    description: 'Репетитор проверяет ваши ответы.',
  },
  completed: {
    label: 'Проверено',
    accent: 'bg-emerald-100 text-emerald-700',
    description: 'ДЗ проверено. Ознакомьтесь с комментариями наставника.',
  },
  rejected: {
    label: 'Отклонено',
    accent: 'bg-rose-100 text-rose-700',
    description: 'Наставник вернул задание. Исправьте и отправьте снова.',
  },
};

const difficultyLabel = {
  easy: 'Лёгкая',
  medium: 'Средняя',
  hard: 'Сложная',
};

export default function HomeworkBoard({
  assignments,
  submissions,
  cards,
  practiceCases,
  knowledgeResources,
  theoryItems,
  personalTheory,
  progress,
  user,
  onEnsureSubmission,
  onUploadFile,
  onRemoveFile,
  onUpdateSubmission,
  onProgressChange,
  onAddTaskFromAssignment,
  onRefresh,
  uploading = false,
  onBack,
}) {
  const submissionsMap = useMemo(() => {
    const map = new Map();
    (submissions ?? []).forEach((submission) => {
      map.set(submission.homework_id, submission);
    });
    return map;
  }, [submissions]);

  const [notes, setNotes] = useState({});
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [statusMessages, setStatusMessages] = useState({});
  const [deckPreview, setDeckPreview] = useState(null);

  const filteredAssignments = useMemo(() => {
    if (!Array.isArray(assignments)) return [];
    return assignments.filter((assignment) => {
      if (!assignment.assign_to || assignment.assign_to === 'all') return true;
      if (!user?.id) return false;
      const rawTargets = assignment.target_profiles ?? assignment.target_profile_ids ?? [];
      if (!Array.isArray(rawTargets)) return false;
      const targetIds = rawTargets
        .map((entry) => {
          if (entry && typeof entry === 'object') {
            return entry.id ?? entry.profile_id ?? null;
          }
          return entry;
        })
        .filter(Boolean);
      if (targetIds.length === 0) return false;
      return targetIds.some((profileId) => String(profileId) === String(user.id));
    });
  }, [assignments, user?.id]);

  const groupedAssignments = useMemo(() => {
    const upcoming = [];
    const completed = [];
    filteredAssignments.forEach((assignment) => {
      const submission = submissionsMap.get(assignment.id);
      const status = submission?.status ?? 'assigned';
      if (status === 'completed') {
        completed.push({ assignment, submission });
      } else {
        upcoming.push({ assignment, submission });
      }
    });

    upcoming.sort((a, b) => {
      if (a.assignment.due_date && b.assignment.due_date) {
        return new Date(a.assignment.due_date) - new Date(b.assignment.due_date);
      }
      if (a.assignment.due_date) return -1;
      if (b.assignment.due_date) return 1;
      return new Date(b.assignment.created_at) - new Date(a.assignment.created_at);
    });

    completed.sort((a, b) => new Date(b.submission?.updated_at ?? 0) - new Date(a.submission?.updated_at ?? 0));

    return { upcoming, completed };
  }, [filteredAssignments, submissionsMap]);

  const handleNoteChange = (assignmentId, value) => {
    setNotes((prev) => ({
      ...prev,
      [assignmentId]: value,
    }));
  };

  const handleUpload = async (assignmentId, files, comment) => {
    if (!files || files.length === 0) return;
    setErrors((prev) => ({ ...prev, [assignmentId]: '' }));
    setStatusMessages((prev) => ({ ...prev, [assignmentId]: '' }));
    try {
      const submission = submissionsMap.get(assignmentId) ?? (await onEnsureSubmission?.(assignmentId));
      if (!submission) {
        throw new Error('Не удалось создать отправку.');
      }
      for (const file of files) {
        const uploadResult = await onUploadFile(assignmentId, file, {
          note: comment ?? '',
        });
        if (!uploadResult) break;
      }
      await onUpdateSubmission?.(assignmentId, {
        status: submission?.status ?? 'assigned',
        student_note: comment ?? submission?.student_note ?? '',
      });
      await onRefresh?.();
      setStatusMessages((prev) => ({ ...prev, [assignmentId]: 'Файлы добавлены' }));
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [assignmentId]: error instanceof Error ? error.message : 'Не удалось загрузить файл.',
      }));
    }
  };

  const handleSubmit = async (assignmentId, note) => {
    setErrors((prev) => ({ ...prev, [assignmentId]: '' }));
    setStatusMessages((prev) => ({ ...prev, [assignmentId]: '' }));
    try {
      const submission = submissionsMap.get(assignmentId) ?? (await onEnsureSubmission?.(assignmentId));
      if (!submission) {
        throw new Error('Не удалось создать отправку.');
      }
      await onUpdateSubmission?.(assignmentId, {
        status: 'in_progress',
        student_note: note ?? submission.student_note ?? '',
      });
      await onRefresh?.();
      setStatusMessages((prev) => ({ ...prev, [assignmentId]: 'Отправлено' }));
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [assignmentId]: error instanceof Error ? error.message : 'Не удалось отправить задание.',
      }));
    }
  };

  const renderResources = (assignment, submission) => {
    if (!assignment.links || assignment.links.length === 0) {
      return null;
    }

    const canViewSolutions =
      Boolean(user?.isAdmin) || Boolean(submission?.status && submission.status !== 'assigned');

    const grouped = assignment.links.reduce((acc, link) => {
      const type = link.resource_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(link);
      return acc;
    }, {});

    const renderItemTitle = (link) => {
      switch (link.resource_type) {
        case 'card': {
          const card = cards.find((item) => String(item.id) === String(link.reference_id));
          return card ? `Карточка: ${card.question}` : `Карточка #${link.reference_id}`;
        }
        case 'practice': {
          const practice = practiceCases.find((item) => item.id === link.reference_id);
          return practice ? `Практика: ${practice.title}` : `Практика #${link.reference_id}`;
        }
        case 'knowledge': {
          const resource = knowledgeResources.find((item) => item.id === link.reference_id);
          return resource ? `Материал: ${resource.title}` : `Материал #${link.reference_id}`;
        }
        case 'theory': {
          const theory = theoryItems.find((item) => item.id === link.reference_id);
          return theory ? `Теория: ${theory.title}` : `Теория #${link.reference_id}`;
        }
        case 'personal': {
          const personal = personalTheory.find((item) => String(item.id) === String(link.reference_id));
          return personal ? `Моя теория: ${personal.title}` : `Моя теория #${link.reference_id}`;
        }
        default:
          return `${link.resource_type} · ${link.reference_id}`;
      }
    };

    return (
      <div className="space-y-3">
        {Object.entries(grouped).map(([type, links]) => (
          <div key={type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{typeLabel(type)}</h4>
              {(type === 'card' || type === 'practice') && (
                <button
                  type="button"
                  onClick={() => handleOpenDeck(assignment, type, canViewSolutions)}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-brand transition hover:border-brand hover:bg-brand/10"
                >
                  Открыть {type === 'card' ? 'карточки' : 'кейсы'}
                </button>
              )}
            </div>
            <ul className="space-y-1 text-sm text-slate-600">
              {links.map((link) => {
                const isPractice = type === 'practice';
                const practice =
                  isPractice &&
                  practiceCases.find((item) => String(item.id) === String(link.reference_id));
                return (
                  <li
                    key={link.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-white/60 bg-white/90 px-3 py-2 shadow-sm"
                  >
	                    <div className="min-w-0 space-y-1">
	                      <span className="block break-words [overflow-wrap:anywhere]">{renderItemTitle(link)}</span>
	                      {isPractice && practice?.mentor_comment && (
	                        <p className="text-[11px] text-slate-500 line-clamp-2 break-words [overflow-wrap:anywhere]">
	                          {practice.mentor_comment}
	                        </p>
	                      )}
	                    </div>
                    {type !== 'card' && type !== 'practice' && (
                      <button
                        type="button"
                        onClick={() => handleOpenResource(assignment, link, canViewSolutions)}
                        className="rounded-lg border border-brand/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-brand transition hover:border-brand hover:bg-brand/10"
                      >
                        Открыть
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  const typeLabel = (type) => {
    switch (type) {
      case 'card':
        return 'Карточки';
      case 'practice':
        return 'Практика';
      case 'knowledge':
        return 'База знаний';
      case 'theory':
        return 'Теория';
      case 'personal':
        return 'Моя теория';
      default:
        return type;
    }
  };

  const buildDeckItems = (assignment, type) => {
    const linksOfType = (assignment.links ?? []).filter((item) => item.resource_type === type);
    if (type === 'card') {
      return linksOfType
        .map((entry) => {
          const card = cards.find((cardItem) => String(cardItem.id) === String(entry.reference_id));
          if (!card) {
            return {
              id: entry.reference_id ?? entry.id ?? `missing-${Math.random().toString(36).slice(2, 8)}`,
              type: 'card',
              title: 'Карточка недоступна',
              question: `Карточка #${entry.reference_id ?? '—'} не найдена.`,
              answer: '',
              difficulty: 'medium',
            };
          }
          return {
            id: card.id,
            type: 'card',
            title: card.category ?? 'Без категории',
            question: card.question,
            answer: card.answer,
            difficulty: card.difficulty,
          };
        });
    }
    if (type === 'practice') {
      return linksOfType.map((entry) => {
        const practice = practiceCases.find((item) => String(item.id) === String(entry.reference_id));
        if (!practice) {
          return {
            id: entry.reference_id ?? entry.id ?? `missing-${Math.random().toString(36).slice(2, 8)}`,
            type: 'practice',
            title: 'Кейс недоступен',
            prompt: `Кейс #${entry.reference_id ?? '—'} не найден.`,
            solution: '',
            difficulty: 'medium',
            points: null,
            category: '',
            mentor_comment: '',
            image_url: null,
            images_front: [],
            images_back: [],
            logo_url: null,
          };
        }
        return {
          id: practice.id,
          type: 'practice',
          title: practice.title,
          prompt: practice.prompt,
          solution: practice.solution,
          difficulty: practice.difficulty,
          points: practice.points,
          category: practice.category,
          mentor_comment: practice.mentor_comment,
          image_url: practice.image_url,
          logo_url: practice.logo_url,
          images_front: Array.isArray(practice.images_front)
            ? practice.images_front
            : practice.image_url
              ? [practice.image_url]
              : [],
          images_back: Array.isArray(practice.images_back) ? practice.images_back : [],
        };
      });
    }
    return [];
  };

  const handleOpenDeck = (assignment, type, canViewSolutions) => {
    const items = buildDeckItems(assignment, type);
    if (items.length === 0) return;
    setDeckPreview({
      items,
      index: 0,
      canViewSolutions,
      type,
      assignmentTitle: assignment.title,
    });
  };

  const handleOpenResource = (assignment, link, canViewSolutions) => {
    if (link.resource_type === 'card' || link.resource_type === 'practice') {
      handleOpenDeck(assignment, link.resource_type, canViewSolutions);
      return;
    }

    setPreview({
      type: link.resource_type,
      id: link.reference_id,
      canViewSolution: canViewSolutions,
      allowReveal: link.resource_type === 'card' || link.resource_type === 'practice',
    });
  };

  const renderAssignmentCard = ({ assignment, submission }) => {
    const status = submission?.status ?? 'assigned';
    const meta = STATUS_META[status] ?? STATUS_META.assigned;
    const noteValue = notes[assignment.id] ?? submission?.student_note ?? '';
    const canEditFiles = !['in_review', 'completed'].includes(status);
    const canResubmit = !['in_review', 'completed'].includes(status);

    return (
      <article
        key={assignment.id}
        className="relative overflow-hidden rounded-[2.4rem] border border-white/60 bg-white/90 p-7 shadow-[0_26px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl transition hover:shadow-[0_30px_95px_rgba(15,23,42,0.18)]"
      >
        <header className="flex flex-wrap items-start gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] ${meta.accent}`}
              >
                {meta.label}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-dark">
                {difficultyLabel[assignment.difficulty] ?? 'Средняя'}
              </span>
              {assignment.due_date && (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                  К сроку: {new Date(assignment.due_date).toLocaleDateString('ru-RU')}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-slate-900">{assignment.title}</h3>
              {assignment.description && (
                <p className="text-sm leading-relaxed text-slate-600">{assignment.description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            <span>Создано: {new Date(assignment.created_at).toLocaleDateString('ru-RU')}</span>
            {submission?.updated_at && (
              <span>Обновлено: {new Date(submission.updated_at).toLocaleDateString('ru-RU')}</span>
            )}
          </div>
        </header>

        {(assignment.links?.length || assignment.files?.length) && (
          <section className="mt-6 rounded-2xl border border-white/70 bg-white/90 px-5 py-4 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Связанные материалы</h4>
            </div>
            {renderResources(assignment, submission) ?? (
              <p className="mt-2 text-sm text-slate-500">Связанных материалов нет.</p>
            )}
            {assignment.files?.length > 0 && (
              <div className="mt-4 space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Файлы</h5>
                <ul className="space-y-2 text-sm text-slate-600">
                  {assignment.files.map((file) => (
                    <li key={file.id}>
                      <a
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-brand hover:text-brand-dark"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm7 2a1 1 0 00-1 1v4.586L7.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l4-4a1 1 0 10-1.414-1.414L11 10.586V6a1 1 0 00-1-1z" />
                        </svg>
                        {file.title ?? file.file_url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="mt-6 space-y-4 rounded-2xl border border-white/70 bg-white/95 px-5 py-5 shadow-[0_18px_55px_rgba(15,23,42,0.12)]">
          <header className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-900">Ваше решение</h4>
            <p className="text-xs text-slate-500">{meta.description}</p>
          </header>

          {submission?.files?.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Прикреплено</h5>
              <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                {submission.files.map((file) => (
                  <li key={file.id} className="rounded-xl border border-white/60 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{file.role === 'tutor' ? 'Комментарий наставника' : 'Файл ученика'}</span>
                      <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                        {new Date(file.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand hover:text-brand-dark">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm7 2a1 1 0 00-1 1v4.586L7.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l4-4a1 1 0 10-1.414-1.414L11 10.586V6a1 1 0 00-1-1z" />
                        </svg>
                        Открыть файл
                      </a>
                      {file.role !== 'tutor' && canEditFiles && onRemoveFile && (
                        <button
                          type="button"
                          onClick={() => onRemoveFile(submission.id, file.id)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                          disabled={uploading}
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                    {file.note && <p className="mt-2 text-xs text-slate-500">{file.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canResubmit && (
            <div className="flex flex-col gap-4">
              <textarea
                value={noteValue}
                onChange={(event) => handleNoteChange(assignment.id, event.target.value)}
                placeholder="Комментарий к решению (необязательно)"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                rows={3}
              />

              <div className="flex flex-wrap items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark">
                  <input
                    type="file"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    multiple
                    onChange={async (event) => {
                      const files = event.target.files;
                      if (files?.length) {
                        await handleUpload(assignment.id, files, noteValue);
                        event.target.value = '';
                      }
                    }}
                    disabled={!canEditFiles}
                  />
                  {uploading ? 'Загружаем…' : 'Прикрепить файл'}
                </label>
                <button
                  type="button"
                  onClick={() => handleSubmit(assignment.id, noteValue)}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-white/90 px-4 py-2 text-sm font-semibold text-brand transition hover:border-brand hover:bg-brand/10"
                  disabled={uploading || status === 'in_review'}
                >
                  Отправить на проверку
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3.172 7.172a4 4 0 015.656-5.656L10 2.343l1.172-1.172a4 4 0 115.656 5.656L10 13.657l-6.828-6.829z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onAddTaskFromAssignment?.(assignment)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                >
                  Добавить в задачи
                </button>
              </div>
            </div>
          )}

          {submission?.reviewer_note && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                status === 'completed'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : status === 'rejected'
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <h5 className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-600">Комментарий наставника</h5>
              <p className="mt-2 whitespace-pre-wrap">{submission.reviewer_note}</p>
            </div>
          )}
          {errors[assignment.id] && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors[assignment.id]}
            </div>
          )}
          {!errors[assignment.id] && statusMessages[assignment.id] && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {statusMessages[assignment.id]}
            </div>
          )}
        </section>
      </article>
    );
  };

  return (
    <div className="relative min-h-screen bg-transparent py-12">
      <AmbientBackdrop variant="default" />
      <header className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-6 sm:px-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-brand/30 bg-white/80 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M12.707 15.707a1 1 0 01-1.414 0L6.586 11l4.707-4.707a1 1 0 10-1.414-1.414L3.464 10.586a1 1 0 000 1.414l5.414 5.414a1 1 0 001.414 0z" />
            </svg>
            Назад в кабинет
          </button>
        )}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-brand-dark">
              Домашние задания
            </span>
            <h1 className="text-3xl font-display font-semibold text-slate-900">Ваши задания</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Прикрепляйте решения, отправляйте на проверку и изучайте комментарии наставника. Используйте связанные материалы, чтобы подготовиться максимально эффективно.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 sm:px-6">
        {groupedAssignments.upcoming.length === 0 ? (
          <div className="rounded-[2.4rem] border border-white/60 bg-white/85 p-12 text-center shadow-[0_28px_80px_rgba(15,23,42,0.15)] backdrop-blur-xl">
            <h2 className="text-2xl font-semibold text-slate-900">Домашних заданий пока нет</h2>
            <p className="mt-2 text-sm text-slate-600">
              Как только репетитор назначит новые задания, они появятся здесь.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900">Текущие задания</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {groupedAssignments.upcoming.map(renderAssignmentCard)}
            </div>
          </div>
        )}

        {groupedAssignments.completed.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900">Выполненные задания</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {groupedAssignments.completed.map(renderAssignmentCard)}
            </div>
          </div>
        )}
      </main>
      {preview && (
        <ResourcePreviewModal
          data={preview}
          onClose={() => setPreview(null)}
          cards={cards}
          practiceCases={practiceCases}
          knowledgeResources={knowledgeResources}
          theoryItems={theoryItems}
          personalTheory={personalTheory}
        />
      )}
      {deckPreview && (
        <DeckModal
          data={deckPreview}
          onClose={() => setDeckPreview(null)}
          progress={progress}
          onProgressChange={onProgressChange}
        />
      )}
    </div>
  );
}

function DeckModal({ data, onClose, progress, onProgressChange }) {
  const [index, setIndex] = useState(data.index ?? 0);
  const [flipped, setFlipped] = useState(false);
  const [cardHeight, setCardHeight] = useState(520);
  const frontContentRef = useRef(null);
  const backContentRef = useRef(null);
  const touchMovedRef = useRef(false);
  const visitedRef = useRef({ card: new Set(), practice: new Set() });
  const committedRef = useRef(false);
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
  const handleFrontTouchEnd = (event) => {
    if (touchMovedRef.current) {
      event.stopPropagation();
      event.preventDefault();
      setTimeout(() => {
        touchMovedRef.current = false;
      }, 50);
      return;
    }
    touchMovedRef.current = false;
  };

  useEffect(() => {
    setIndex(data.index ?? 0);
    setFlipped(false);
    visitedRef.current = { card: new Set(), practice: new Set() };
    committedRef.current = false;
  }, [data]);

  const items = data.items ?? [];
  const current = items[index];
  const total = items.length;
  const isFirst = index <= 0;
  const isLast = total > 0 ? index >= total - 1 : true;
  const isCard = current?.type === 'card';
  const isPractice = current?.type === 'practice';

  const difficultyLabel = current?.difficulty ? current.difficulty : 'medium';
  const canView = Boolean(data.canViewSolutions);

  useEffect(() => {
    if (!current || !current.id || !current.type) return;
    if (current.type !== 'card' && current.type !== 'practice') return;
    visitedRef.current[current.type].add(String(current.id));
  }, [current?.id, current?.type]);

  const commitProgress = () => {
    if (committedRef.current) return;
    committedRef.current = true;

    if (!onProgressChange) return;

    const existingCardStatuses =
      progress?.statuses && typeof progress.statuses === 'object' ? progress.statuses : {};
    const existingCaseStatuses =
      progress?.caseStatuses && typeof progress.caseStatuses === 'object' ? progress.caseStatuses : {};

    const cardUpdates = {};
    visitedRef.current.card.forEach((id) => {
      const key = String(id);
      if (typeof existingCardStatuses[key] !== 'string') {
        cardUpdates[key] = 'unsure';
      }
    });

    const caseUpdates = {};
    visitedRef.current.practice.forEach((id) => {
      const key = String(id);
      const value = existingCaseStatuses[key];
      if (value !== 'in_progress' && value !== 'done') {
        caseUpdates[key] = 'in_progress';
      }
    });

    const payload = {};
    if (Object.keys(cardUpdates).length > 0) payload.statuses = cardUpdates;
    if (Object.keys(caseUpdates).length > 0) payload.caseStatuses = caseUpdates;
    if (Object.keys(payload).length > 0) {
      onProgressChange(payload);
    }
  };

  const handleClose = () => {
    commitProgress();
    onClose?.();
  };

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

  const next = () => {
    if (total === 0) return;
    setFlipped(false);
    if (isLast) {
      handleClose();
      return;
    }
    setIndex((prev) => Math.min(prev + 1, total - 1));
  };
  const prev = () => {
    if (total === 0) return;
    setFlipped(false);
    setIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="relative w-full max-w-5xl rounded-[2rem] border border-white/20 bg-white/95 p-6 shadow-[0_40px_120px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Повторение</p>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-slate-900">
                {data.type === 'card' ? 'Карточки' : 'Кейсы'}
              </h3>
              {data.assignmentTitle && (
                <span className="text-xs text-slate-500 line-clamp-1">{data.assignmentTitle}</span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {index + 1} / {total}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
          >
            Закрыть
          </button>
        </div>

        <div className="mt-6">
          <div
            className="card-3d-container glow-border"
            style={{
              height: `${cardHeight}px`,
              maxHeight: '82vh',
              minHeight: '460px',
            }}
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
              setFlipped((prev) => !prev);
            }}
          >
            <div className={`card-3d ${flipped ? 'card-3d-flipped' : ''}`}>
              <div className="card-3d-face card-3d-front">
                <div
                  className={`card-3d-content custom-scrollbar ${isCard ? 'justify-center' : ''}`}
                  ref={frontContentRef}
                  onWheelCapture={handleFrontWheel}
                  onTouchStartCapture={() => {
                    touchMovedRef.current = false;
                  }}
                  onTouchMoveCapture={() => {
                    touchMovedRef.current = true;
                  }}
                  onTouchEndCapture={handleFrontTouchEnd}
                  onClickCapture={(event) => {
                    if (touchMovedRef.current) {
                      event.stopPropagation();
                      touchMovedRef.current = false;
                    }
                  }}
                >
                  <div className="space-y-3">
                    {current?.title && (
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{current.title}</p>
                    )}
                    {isCard && (
                      <p className="text-xl font-semibold leading-snug text-slate-900 whitespace-pre-wrap">
                        {current.question}
                      </p>
                    )}
                    {isPractice && (
                      <div className="space-y-3">
                        {(current.title || current.logo_url) && (
                          <div className="flex items-center gap-2">
                            {current.logo_url && (
                              <img
                                src={current.logo_url}
                                alt={current.title}
                                className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                              />
                            )}
                            {current.title && (
                              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {current.title}
                              </p>
                            )}
                          </div>
                        )}
                        <p className="text-base leading-relaxed text-slate-900 whitespace-pre-wrap">
                          {current.prompt || 'Условие не указано.'}
                        </p>
                        {current.images_front?.length > 0 && (
                          <div className="grid grid-cols-1 gap-2">
                            {current.images_front.map((url) => (
                              <div key={url} className="overflow-hidden rounded-2xl border border-slate-100">
                                <img
                                  src={url}
                                  alt={current.title}
                                  className="w-full max-h-64 object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Нажмите, чтобы посмотреть {isCard ? 'ответ' : 'решение'}
                  </div>
                </div>
              </div>
              <div className="card-3d-face card-3d-back">
                <div
                  className={`card-3d-content custom-scrollbar ${isCard ? 'justify-center' : ''}`}
                  ref={backContentRef}
                  onWheelCapture={handleBackWheel}
                  onTouchStartCapture={() => {
                    touchMovedRef.current = false;
                  }}
                  onTouchMoveCapture={() => {
                    touchMovedRef.current = true;
                  }}
                  onClickCapture={(event) => {
                    if (touchMovedRef.current) {
                      event.stopPropagation();
                      touchMovedRef.current = false;
                    }
                  }}
                >
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      {isCard ? 'Ответ' : 'Решение'}
                    </p>
                    {isCard && canView && (
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{current.answer || 'Ответ не указан.'}</p>
                    )}
                    {isPractice && canView && (
                      <>
                        {(current.logo_url || current.title) && (
                          <div className="flex items-center gap-2">
                            {current.logo_url && (
                              <img
                                src={current.logo_url}
                                alt={current.title}
                                className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                              />
                            )}
                            {current.title && (
                              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {current.title}
                              </p>
                            )}
                          </div>
                        )}
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">
                          {current.solution || 'Решение не указано.'}
                        </p>
                        {current.images_back?.length > 0 && (
                          <div className="grid grid-cols-1 gap-2">
                            {current.images_back.map((url) => (
                              <div key={url} className="overflow-hidden rounded-2xl border border-slate-100">
                                <img
                                  src={url}
                                  alt={current.title}
                                  className="w-full max-h-64 object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        {current.mentor_comment && (
                          <div className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-brand-dark whitespace-pre-wrap break-words">
                            <span className="font-semibold">Комментарий Тимура: </span>
                            {current.mentor_comment}
                          </div>
                        )}
                      </>
                    )}
                    {!canView && (
                      <p className="text-sm text-slate-500">
                        Ответ станет доступен после отправки решения или для наставника.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {difficultyLabel}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:pointer-events-none disabled:opacity-50"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark"
            >
              {isLast ? 'Готово' : 'Дальше'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
