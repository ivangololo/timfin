import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPanel from './components/AdminPanel.jsx';
import Dashboard from './components/Dashboard.jsx';
import LoginForm from './components/LoginForm.jsx';
import ReviewDeck from './components/ReviewDeck.jsx';
import ScheduleTable from './components/ScheduleTable.jsx';
import TheorySection from './components/TheorySection.jsx';
import TrainingDeck from './components/TrainingDeck.jsx';
import KnowledgeBase from './components/KnowledgeBase.jsx';
import HomeworkBoard from './components/HomeworkBoard.jsx';
import fallbackCards from './data/cards.json';
import fallbackTheory from './data/theory.json';
import fallbackSchedule from './data/schedule.json';
import fallbackPractice from './data/practice.json';
import fallbackKnowledge from './data/knowledgeBase.json';
import {
  fetchCards,
  fetchSchedule,
  fetchTheory,
  fetchTasks,
  fetchPractice,
  fetchKnowledgeBase,
  fetchPersonalTheory,
  addPersonalTheoryEntry,
  addPersonalTheoryEntries,
  removePersonalTheoryEntry,
  uploadKnowledgeAsset,
  uploadPracticeImage,
  adminListProfiles,
  adminCreateProfile,
  adminUpdateProfile,
  adminDeleteProfile,
  adminListAccessCodes,
  adminCreateAccessCode,
  adminDeleteAccessCode,
  adminAssignAccessCode,
  adminFetchProgress,
  adminResetProgress,
  adminListTasks,
  adminCreateTask as adminCreateTaskEntry,
  adminUpdateTaskStatus as adminUpdateTaskStatusEntry,
  adminDeleteTask as adminDeleteTaskEntry,
  adminUpsertKnowledgeResource,
  adminDeleteKnowledgeResource,
  adminUpsertTheory,
  adminDeleteTheory,
  adminUpsertSchedule,
  adminDeleteSchedule,
  createCard,
  updateCard,
  deleteCard,
  submitAccessRequest,
  createPracticeCase,
  updatePracticeCase,
  deletePracticeCase,
  fetchProfileByCode,
  loadProgress,
  loadUser,
  logout,
  saveProgress,
  createTask,
  updateTaskStatus,
  deleteTask,
  signInWithCode,
  loadAccessRequestId,
  clearAccessRequestId,
  claimAccessCode,
  fetchHomeworkAssignments,
  fetchHomeworkSubmissionsForUser,
  ensureHomeworkSubmission,
  addHomeworkSubmissionFile,
  deleteHomeworkSubmissionFile,
  updateHomeworkSubmission,
  uploadHomeworkAsset,
  adminFetchHomework,
  adminCreateHomework,
  adminDeleteHomework,
  fetchHomeworkRecipients,
  saveHomeworkRecipients,
  adminListAccessRequests,
  adminApproveAccessRequest,
} from './services/supabaseClient.js';

const INITIAL_PROGRESS = {
  statuses: {},
  caseStatuses: {},
  lastSeenIndex: {},
  scheduleParticipation: {},
};

const isPdfResource = (item) => {
  if (!item) return false;
  if (item.type === 'pdf') return true;
  const url = (item.url ?? '').toLowerCase();
  return url.endsWith('.pdf');
};

const isImageResource = (item) => {
  if (!item) return false;
  if (item.type === 'image') return true;
  const url = item.url ?? '';
  return item.type === 'file' && /\.(png|jpe?g|gif|webp)$/i.test(url);
};

const sanitizeFileName = (name) => {
  const base = (name ?? 'file').split('/').pop().split('\\').pop();
  const normalized = base.normalize('NFKD').replace(/[^\w.-]+/g, '_');
  const compacted = normalized.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return compacted || `file-${Date.now()}`;
};

const compressImageFile = async (file, options = {}) => {
  if (!(file instanceof File) || !file.type?.startsWith('image/')) return file;
  const maxSide = options.maxSide ?? 1600;
  const quality = options.quality ?? 0.7;
  const minSize = options.minSize ?? 1.2 * 1024 * 1024; // 1.2 MB
  if (file.size <= minSize) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      if (!scale || scale >= 1) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], sanitizeFileName(`${file.name}-compressed.jpg`), { type: 'image/jpeg' });
          resolve(compressed);
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

const ensureCaseStatus = (value) => {
  if (value === 'in_progress' || value === 'done') return value;
  return 'todo';
};

const normalizeProgress = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { ...INITIAL_PROGRESS };
  }

  const statuses = {};
  if (raw.statuses && typeof raw.statuses === 'object') {
    for (const [key, value] of Object.entries(raw.statuses)) {
      if (typeof value === 'string') {
        statuses[String(key)] = value;
      }
    }
  }

  const caseStatuses = {};
  if (raw.caseStatuses && typeof raw.caseStatuses === 'object') {
    for (const [key, value] of Object.entries(raw.caseStatuses)) {
      if (typeof value === 'string') {
        caseStatuses[String(key)] = value;
      }
    }
  }

  if (Array.isArray(raw.knownCardIds)) {
    for (const id of raw.knownCardIds) {
      statuses[String(id)] = 'know';
    }
  }

  if (Array.isArray(raw.reviewCardIds)) {
    for (const id of raw.reviewCardIds) {
      const key = String(id);
      if (statuses[key] !== 'know') {
        statuses[key] = raw.reviewStatuses?.[key] ?? 'unsure';
      }
    }
  }

  if (Array.isArray(raw.flaggedCardIds)) {
    for (const id of raw.flaggedCardIds) {
      const key = String(id);
      if (statuses[key] !== 'know') {
        statuses[key] = 'unsure';
      }
    }
  }

  if (typeof raw.reviewStatuses === 'object') {
    for (const [key, value] of Object.entries(raw.reviewStatuses)) {
      if (!statuses[String(key)] && typeof value === 'string') {
        statuses[String(key)] = value;
      }
    }
  }

  const scheduleParticipation = {};
  if (raw.scheduleParticipation && typeof raw.scheduleParticipation === 'object') {
    for (const [key, value] of Object.entries(raw.scheduleParticipation)) {
      if (value) {
        scheduleParticipation[String(key)] = true;
      }
    }
  } else if (Array.isArray(raw.selectedScheduleIds)) {
    raw.selectedScheduleIds.forEach((id) => {
      scheduleParticipation[String(id)] = true;
    });
  }

  return {
    statuses,
    caseStatuses,
    lastSeenIndex: raw.lastSeenIndex && typeof raw.lastSeenIndex === 'object' ? raw.lastSeenIndex : {},
    scheduleParticipation,
  };
};

const cloneFallback = (data) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
};

const prepareFallbackSchedule = (items) =>
  cloneFallback(items).map((item) => ({
    ...item,
    date_display: item.date_display ?? item.date ?? '',
    order_date: item.order_date ?? item.date ?? null,
    level: item.level ?? item.direction ?? null,
    status_effective: item.status_effective ?? item.status ?? 'open',
  }));

const STARTUP_TIMEOUT_MS = 3500;
const USER_STARTUP_TIMEOUT_MS = 2500;

const withTimeout = (promise, label, timeoutMs = STARTUP_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });

const loadWithFallback = async (label, loader, fallback) => {
  try {
    return { data: await withTimeout(loader(), label), usedFallback: false };
  } catch (error) {
    console.warn(`Failed to load ${label}, using bundled fallback`, error);
    return {
      data: typeof fallback === 'function' ? fallback() : cloneFallback(fallback),
      usedFallback: true,
    };
  }
};

const loadInitialContent = async () => {
  const [cards, theory, schedule, practice, knowledge, homework] = await Promise.all([
    loadWithFallback('cards', fetchCards, fallbackCards),
    loadWithFallback('theory', fetchTheory, fallbackTheory),
    loadWithFallback('schedule', fetchSchedule, () => prepareFallbackSchedule(fallbackSchedule)),
    loadWithFallback('practice', fetchPractice, fallbackPractice),
    loadWithFallback('knowledge base', fetchKnowledgeBase, fallbackKnowledge),
    loadWithFallback('homework assignments', fetchHomeworkAssignments, []),
  ]);

  return {
    cards: cards.data,
    theory: theory.data,
    schedule: schedule.data,
    practice: practice.data,
    knowledge: knowledge.data,
    homework: homework.data,
    usedFallback: [cards, theory, schedule, practice, knowledge, homework].some((result) => result.usedFallback),
  };
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [authLoading, setAuthLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [cards, setCards] = useState([]);
  const [theoryItems, setTheoryItems] = useState([]);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [practiceCases, setPracticeCases] = useState([]);
  const [knowledgeResources, setKnowledgeResources] = useState([]);
  const [personalTheory, setPersonalTheory] = useState([]);
  const [homeworkAssignments, setHomeworkAssignments] = useState([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState([]);
  const [adminHomeworkAssignments, setAdminHomeworkAssignments] = useState([]);
  const [adminHomeworkSubmissions, setAdminHomeworkSubmissions] = useState([]);
  const [homeworkUploading, setHomeworkUploading] = useState(false);
  const [adminHomeworkUploading, setAdminHomeworkUploading] = useState(false);
  const [adminHomeworkSupportsTargets, setAdminHomeworkSupportsTargets] = useState(true);
  const [homeworkRecipients, setHomeworkRecipients] = useState([]);
  const [homeworkRecipientsSupported, setHomeworkRecipientsSupported] = useState(true);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [knowledgeTab, setKnowledgeTab] = useState('presentations');
  const [trainerFocusCategory, setTrainerFocusCategory] = useState(null);
  const [trainerFocusMode, setTrainerFocusMode] = useState('cards');
  const [globalError, setGlobalError] = useState('');
  const [offlineNotice, setOfflineNotice] = useState('');
  const [accessRequestId, setAccessRequestId] = useState(null);
  const [accessRequestStatus, setAccessRequestStatus] = useState('');
  const [accessRequestName, setAccessRequestName] = useState('');
  const [accessRequestCode, setAccessRequestCode] = useState('');
  const [accessRequestLoading, setAccessRequestLoading] = useState(false);
  const [accessRequestError, setAccessRequestError] = useState('');

  const applyClaimResult = useCallback(
    (result, requestId, fallbackName) => {
      if (!result) return;
      const status = result.status ?? 'pending';
      setAccessRequestStatus(status);

      if (status === 'approved' && result.code) {
        setAccessRequestCode(result.code);
        setAccessRequestName(result.full_name ?? fallbackName ?? accessRequestName ?? '');
        clearAccessRequestId();
        setAccessRequestId(null);
      } else {
        if (requestId) {
          setAccessRequestId(requestId);
        }
        setAccessRequestCode('');
        if (fallbackName || result.full_name) {
          setAccessRequestName((prev) => prev || fallbackName || result.full_name || '');
        }
      }
    },
    [accessRequestName],
  );

  useEffect(() => {
    const bootstrap = async () => {
      const storedRequestId = loadAccessRequestId();
      if (storedRequestId) {
        setAccessRequestId(storedRequestId);
        setAccessRequestStatus('pending');
      }

      try {
        const [existingUser, content] = await Promise.all([
          withTimeout(loadUser(), 'saved user', USER_STARTUP_TIMEOUT_MS).catch((error) => {
            console.warn('Failed to restore saved user', error);
            return null;
          }),
          loadInitialContent(),
        ]);

        if (content.usedFallback) {
          setOfflineNotice(
            'Не удалось подключиться к базе данных. Показаны встроенные материалы, вход, заявки и сохранение прогресса заработают после восстановления доступа.',
          );
        } else {
          setOfflineNotice('');
        }

        setCards(content.cards);
        setTheoryItems(content.theory);
        setScheduleItems(content.schedule);
        setPracticeCases(content.practice);
        setKnowledgeResources(content.knowledge);
        setHomeworkAssignments(content.homework);

        if (existingUser) {
          setUser(existingUser);
          const storedProgress = await withTimeout(
            loadProgress(existingUser.id),
            'saved progress',
            USER_STARTUP_TIMEOUT_MS,
          ).catch((error) => {
            console.warn('Failed to load saved progress', error);
            return INITIAL_PROGRESS;
          });
          setProgress(normalizeProgress(storedProgress));
          const storedTasks = await withTimeout(fetchTasks(existingUser.id), 'tasks', USER_STARTUP_TIMEOUT_MS).catch((error) => {
            console.warn('Failed to load tasks', error);
            return [];
          });
          setTasks(storedTasks ?? []);
          setPersonalLoading(true);
          const personal = await withTimeout(
            fetchPersonalTheory(existingUser.id),
            'personal theory',
            USER_STARTUP_TIMEOUT_MS,
          ).catch((error) => {
            console.warn('Failed to load personal theory', error);
            return [];
          });
          setPersonalTheory(personal ?? []);
          setPersonalLoading(false);
          const submissions = await withTimeout(
            fetchHomeworkSubmissionsForUser(existingUser.id),
            'homework submissions',
            USER_STARTUP_TIMEOUT_MS,
          ).catch((error) => {
            console.warn('Failed to load homework submissions', error);
            return [];
          });
          setHomeworkSubmissions(submissions ?? []);
        } else if (storedRequestId) {
          try {
            const result = await withTimeout(claimAccessCode(storedRequestId), 'access request', USER_STARTUP_TIMEOUT_MS);
            applyClaimResult(result, storedRequestId);
          } catch (error) {
            console.warn('Не удалось проверить статус заявки', error);
          }
        }
      } catch (error) {
        console.error(error);
        setGlobalError(error instanceof Error ? error.message : 'Не удалось загрузить данные. Обновите страницу и попробуйте снова.');
      } finally {
        setInitialising(false);
      }
    };

    bootstrap();
  }, [applyClaimResult]);

  const handleAccessRequestSubmit = async (fullName) => {
    setAccessRequestLoading(true);
    setAccessRequestError('');
    try {
      const request = await submitAccessRequest(fullName);
      setAccessRequestId(request?.id ?? null);
      setAccessRequestStatus(request?.status ?? 'pending');
      setAccessRequestName(request?.full_name ?? fullName);
      setAccessRequestCode('');
    } catch (error) {
      setAccessRequestError(error instanceof Error ? error.message : 'Не удалось отправить заявку.');
    } finally {
      setAccessRequestLoading(false);
    }
  };

  const handleAccessRequestCheck = async () => {
    if (!accessRequestId) {
      setAccessRequestError('Сначала оставьте заявку.');
      return;
    }
    setAccessRequestLoading(true);
    setAccessRequestError('');
    try {
      const result = await claimAccessCode(accessRequestId);
      applyClaimResult(result, accessRequestId, accessRequestName);
    } catch (error) {
      setAccessRequestError(error instanceof Error ? error.message : 'Не удалось проверить статус заявки.');
    } finally {
      setAccessRequestLoading(false);
    }
  };

  const handleLogin = async (code) => {
    setAuthLoading(true);
    setPersonalLoading(true);
    try {
      const signedUser = await signInWithCode(code);

      const [assignments, storedProgress, storedTasks, personal, submissions] = await Promise.all([
        fetchHomeworkAssignments(),
        loadProgress(signedUser.id),
        fetchTasks(signedUser.id),
        fetchPersonalTheory(signedUser.id),
        fetchHomeworkSubmissionsForUser(signedUser.id),
      ]);

      setHomeworkAssignments(assignments);
      setProgress(normalizeProgress(storedProgress));
      setTasks(storedTasks ?? []);
      setPersonalTheory(personal ?? []);
      setHomeworkSubmissions(submissions ?? []);
      setUser(signedUser);
      setView('dashboard');
      clearAccessRequestId();
      setAccessRequestId(null);
      setAccessRequestStatus('');
      setAccessRequestCode('');
      setAccessRequestError('');
      setAccessRequestName('');
    } finally {
      setAuthLoading(false);
      setPersonalLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setProgress({ ...INITIAL_PROGRESS });
    setTasks([]);
    setPersonalTheory([]);
    setHomeworkSubmissions([]);
    setAdminHomeworkAssignments([]);
    setAdminHomeworkSubmissions([]);
    setTrainerFocusCategory(null);
    setTrainerFocusMode('cards');
    setAccessRequestId(null);
    setAccessRequestStatus('');
    setAccessRequestCode('');
    setAccessRequestName('');
    setAccessRequestError('');
    setAccessRequestLoading(false);
    setView('dashboard');
  };

  const persistProgress = useCallback(
    (nextState) => {
      if (!user) return;
      const mergedStatuses = nextState.statuses ?? {};
      const knownCardIds = Object.entries(mergedStatuses)
        .filter(([, status]) => status === 'know')
        .map(([id]) => id);
      const reviewCardIds = Object.entries(mergedStatuses)
        .filter(([, status]) => status !== 'know')
        .map(([id]) => id);
      const payload = {
        ...nextState,
        knownCardIds,
        reviewCardIds,
        reviewStatuses: mergedStatuses,
      };
      saveProgress(user.id, payload).catch((error) => {
        console.warn('Не удалось сохранить прогресс', error);
      });
    },
    [user],
  );

  const handleProgressChange = useCallback(
    (partial) => {
      let nextState = null;
      setProgress((prev) => {
        const incomingStatuses = partial.statuses && typeof partial.statuses === 'object' ? partial.statuses : {};
        const sanitizedStatuses = Object.fromEntries(
          Object.entries(incomingStatuses).map(([key, value]) => [String(key), value]),
        );

        const mergedStatuses = {
          ...(prev.statuses ?? {}),
          ...sanitizedStatuses,
        };

        const incomingCaseStatuses =
          partial.caseStatuses && typeof partial.caseStatuses === 'object' ? partial.caseStatuses : {};
        const mergedCaseStatuses = {
          ...(prev.caseStatuses ?? {}),
          ...Object.fromEntries(Object.entries(incomingCaseStatuses).map(([key, value]) => [String(key), value])),
        };

        const lastSeenUpdates =
          partial.lastSeenIndex && typeof partial.lastSeenIndex === 'object' ? partial.lastSeenIndex : {};
        const mergedLastSeen = {
          ...(prev.lastSeenIndex ?? {}),
          ...Object.fromEntries(Object.entries(lastSeenUpdates).map(([key, value]) => [String(key), value])),
        };

        const participationUpdates =
          partial.scheduleParticipation && typeof partial.scheduleParticipation === 'object'
            ? partial.scheduleParticipation
            : {};
        const mergedParticipation = { ...(prev.scheduleParticipation ?? {}) };
        for (const [key, value] of Object.entries(participationUpdates)) {
          const normalizedKey = String(key);
          if (value) {
            mergedParticipation[normalizedKey] = true;
          } else {
            delete mergedParticipation[normalizedKey];
          }
        }

        nextState = {
          statuses: mergedStatuses,
          caseStatuses: mergedCaseStatuses,
          lastSeenIndex: mergedLastSeen,
          scheduleParticipation: mergedParticipation,
        };

        return nextState;
      });

      if (nextState) {
        persistProgress(nextState);
      }
    },
    [persistProgress],
  );

  const handleCardStatusChange = (cardId, status) => {
    handleProgressChange({
      statuses: {
        [String(cardId)]: status,
      },
    });
  };

  const handleTaskCreate = useCallback(async (payload) => {
    if (!user) {
      throw new Error('Требуется авторизация');
    }
    const created = await createTask(user.id, payload);
    setTasks((prev) => [...prev, created]);
  }, [user]);

  const handleTaskStatusChange = useCallback(
    async (taskId, nextStatus) => {
      if (!user) {
        throw new Error('Требуется авторизация');
      }
      const updated = await updateTaskStatus(user.id, taskId, nextStatus);
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: updated?.status ?? nextStatus,
              }
            : task,
        ),
      );
    },
    [user],
  );

  const handleCaseStatusChange = useCallback(
    (caseId, status, options = {}) => {
      const updates = {
        caseStatuses: {
          [String(caseId)]: status,
        },
      };
      const lastSeenUpdates = {};
      if (options.lastSeenKey) {
        lastSeenUpdates[options.lastSeenKey] = options.nextIndex ?? 0;
      }
      if (Array.isArray(options.additionalLastSeenKeys)) {
        options.additionalLastSeenKeys.forEach((key) => {
          lastSeenUpdates[String(key)] = options.nextIndex ?? 0;
        });
      }
      if (Object.keys(lastSeenUpdates).length > 0) {
        updates.lastSeenIndex = lastSeenUpdates;
      }
      handleProgressChange(updates);
    },
    [handleProgressChange],
  );

  const handleScheduleParticipationToggle = useCallback(
    (scheduleId) => {
      const key = String(scheduleId);
      const isSelected = Boolean(progress.scheduleParticipation?.[key]);
      handleProgressChange({
        scheduleParticipation: {
          [key]: !isSelected,
        },
      });
    },
    [handleProgressChange, progress.scheduleParticipation],
  );

  const handleTaskDelete = useCallback(
    async (taskId) => {
      if (!user) {
        throw new Error('Требуется авторизация');
      }
      await deleteTask(user.id, taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    },
    [user],
  );

  const totalsByCategory = useMemo(() => {
    return cards.reduce((acc, card) => {
      acc[card.category] = (acc[card.category] ?? 0) + 1;
      return acc;
    }, {});
  }, [cards]);

  const caseTotalsByCategory = useMemo(() => {
    return practiceCases.reduce((acc, item) => {
      const category = item.category ?? 'Общая практика';
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});
  }, [practiceCases]);

  const progressByCategory = useMemo(() => {
    const statuses = progress.statuses ?? {};
    const knownSet = new Set(
      Object.entries(statuses)
        .filter(([, status]) => status === 'know')
        .map(([id]) => id),
    );
    return Object.fromEntries(
      Object.entries(totalsByCategory).map(([category, total]) => {
        const learned = cards
          .filter((card) => card.category === category)
          .filter((card) => knownSet.has(String(card.id))).length;
        return [category, Math.min(learned, total)];
      }),
    );
  }, [cards, progress.statuses, totalsByCategory]);

  const caseProgressByCategory = useMemo(() => {
    const statuses = progress.caseStatuses ?? {};
    return Object.fromEntries(
      Object.entries(caseTotalsByCategory).map(([category, total]) => {
        const solved = practiceCases
          .filter((item) => (item.category ?? 'Общая практика') === category)
          .filter((item) => (statuses[String(item.id)] ?? 'todo') === 'done').length;
        return [category, Math.min(solved, total)];
      }),
    );
  }, [practiceCases, progress.caseStatuses, caseTotalsByCategory]);

  const reviewSummary = useMemo(() => {
    const statuses = progress.statuses ?? {};
    return cards.reduce(
      (acc, card) => {
        const key = String(card.id);
        const status = statuses[key];
        if (status && status !== 'know') {
          acc.total += 1;
          acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
          acc.byCategory[card.category] = (acc.byCategory[card.category] ?? 0) + 1;
          if (!acc.byCategoryStatus[card.category]) {
            acc.byCategoryStatus[card.category] = { unsure: 0, dontknow: 0 };
          }
          acc.byCategoryStatus[card.category][status] =
            (acc.byCategoryStatus[card.category][status] ?? 0) + 1;
          if (!acc.cardIds.includes(key)) {
            acc.cardIds.push(key);
          }
        }
        return acc;
      },
      { total: 0, byStatus: { unsure: 0, dontknow: 0 }, byCategory: {}, byCategoryStatus: {}, cardIds: [] },
    );
  }, [cards, progress.statuses]);

  const caseStatusSummary = useMemo(() => {
    const statuses = progress.caseStatuses ?? {};
    return practiceCases.reduce(
      (acc, item) => {
        const key = String(item.id);
        const rawStatus = statuses[key] ?? 'todo';
        const status = rawStatus === 'in_progress' || rawStatus === 'done' ? rawStatus : 'todo';
        acc.total += 1;
        acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
        const category = item.category ?? 'Общая практика';
        if (!acc.byCategory[category]) {
          acc.byCategory[category] = { todo: 0, in_progress: 0, done: 0 };
        }
        acc.byCategory[category][status] = (acc.byCategory[category][status] ?? 0) + 1;
        return acc;
      },
      { total: 0, byStatus: { todo: 0, in_progress: 0, done: 0 }, byCategory: {} },
    );
  }, [practiceCases, progress.caseStatuses]);

  const reviewCards = useMemo(() => {
    const statuses = progress.statuses ?? {};
    return cards.filter((card) => {
      const status = statuses[String(card.id)];
      return status && status !== 'know';
    });
  }, [cards, progress.statuses]);

  const reviewCases = useMemo(() => {
    const statuses = progress.caseStatuses ?? {};
    return practiceCases.filter((item) => ensureCaseStatus(statuses[String(item.id)]) !== 'done');
  }, [practiceCases, progress.caseStatuses]);

  const theoryAllItems = useMemo(() => [...knowledgeResources, ...personalTheory], [knowledgeResources, personalTheory]);

  const presentationCount = useMemo(
    () => personalTheory.filter((item) => isPdfResource(item)).length,
    [personalTheory],
  );

  const cheatsheetCount = useMemo(
    () => personalTheory.filter((item) => isImageResource(item)).length,
    [personalTheory],
  );

  const homeworkPendingCount = useMemo(() => {
    if (!Array.isArray(homeworkAssignments) || homeworkAssignments.length === 0) {
      return 0;
    }
    return homeworkAssignments.reduce((acc, assignment) => {
      const submission = homeworkSubmissions.find((item) => item.homework_id === assignment.id);
      if (!submission) return acc + 1;
      return submission.status === 'assigned' || submission.status === 'in_progress' ? acc + 1 : acc;
    }, 0);
  }, [homeworkAssignments, homeworkSubmissions]);

  const handleNavigate = (nextView, options = {}) => {
    if (nextView === 'knowledge') {
      setKnowledgeTab(options.tab ?? 'presentations');
    }
    if (nextView === 'trainer') {
      setTrainerFocusCategory(options.category ?? null);
      if (options.mode === 'cases' || options.mode === 'cards') {
        setTrainerFocusMode(options.mode);
      } else {
        setTrainerFocusMode('cards');
      }
    }
    if (nextView === 'admin' && !(user?.isAdmin)) {
      setView('dashboard');
      return;
    }
    if (nextView === 'homework') {
      refreshHomework().catch((error) => {
        console.warn('Не удалось обновить домашние задания', error);
      });
    }
    setView(nextView);
  };

  const handlePersonalTheoryAdd = async (payload) => {
    if (!user) throw new Error('Требуется авторизация');
    const entry = await addPersonalTheoryEntry(user.id, payload);
    setPersonalTheory((prev) => [...prev, entry]);
    return entry;
  };

  const handlePersonalTheoryRemove = async (entryId) => {
    if (!user) return;
    await removePersonalTheoryEntry(user.id, entryId);
    setPersonalTheory((prev) => prev.filter((item) => item.id !== entryId));
  };

  const refreshCards = useCallback(async () => {
    const updated = await fetchCards();
    setCards(updated);
  }, []);

  const refreshPractice = useCallback(async () => {
    const updated = await fetchPractice();
    setPracticeCases(updated);
  }, []);

  const refreshKnowledge = useCallback(async () => {
    const updated = await fetchKnowledgeBase();
    setKnowledgeResources(updated);
  }, []);

  const refreshTheory = useCallback(async () => {
    const updated = await fetchTheory();
    setTheoryItems(updated);
  }, []);

  const refreshSchedule = useCallback(async () => {
    const updated = await fetchSchedule();
    setScheduleItems(updated);
  }, []);

  const refreshHomework = useCallback(async () => {
    const assignments = await fetchHomeworkAssignments();
    setHomeworkAssignments(assignments);
    if (user) {
      const submissions = await fetchHomeworkSubmissionsForUser(user.id);
      setHomeworkSubmissions(submissions ?? []);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refreshHomework().catch((error) => {
      console.warn('Не удалось обновить домашние задания пользователя', error);
    });
  }, [user, refreshHomework]);

  const handleCardCreate = useCallback(async (payload) => {
    const created = await createCard(payload);
    await refreshCards();
    return created;
  }, [refreshCards]);

  const handleCardUpdate = useCallback(async (id, payload) => {
    const updated = await updateCard(id, payload);
    await refreshCards();
    return updated;
  }, [refreshCards]);

  const handleCardDelete = useCallback(async (id) => {
    await deleteCard(id);
    await refreshCards();
  }, [refreshCards]);

  const handlePracticeCreate = useCallback(async (payload) => {
    const created = await createPracticeCase(payload);
    await refreshPractice();
    return created;
  }, [refreshPractice]);

  const handlePracticeUpdate = useCallback(async (id, payload) => {
    const updated = await updatePracticeCase(id, payload);
    await refreshPractice();
    return updated;
  }, [refreshPractice]);

  const handlePracticeDelete = useCallback(async (id) => {
    await deletePracticeCase(id);
    await refreshPractice();
  }, [refreshPractice]);

  const handleEnsureHomeworkSubmission = useCallback(async (assignmentId) => {
    if (!user) {
      throw new Error('Требуется авторизация');
    }
    const submission = await ensureHomeworkSubmission(user.id, assignmentId);
    if (!submission) return null;
    setHomeworkSubmissions((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === submission.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = submission;
        return next;
      }
      return [...prev, submission];
    });
    return submission;
  }, [user]);

  const handleUploadHomeworkFile = useCallback(
    async (assignmentId, file, meta = {}) => {
      if (!user) {
        throw new Error('Требуется авторизация');
      }
      setHomeworkUploading(true);
      try {
        const fileToUpload = await compressImageFile(file);
        const submission =
          homeworkSubmissions.find((item) => item.homework_id === assignmentId) ??
          (await handleEnsureHomeworkSubmission(assignmentId));
        if (!submission) {
          throw new Error('Не удалось создать отправку');
        }
        const path = `submissions/${user.id}/${assignmentId}/${Date.now()}-${sanitizeFileName(fileToUpload.name)}`;
        const asset = await uploadHomeworkAsset(fileToUpload, path);
        await addHomeworkSubmissionFile(
          submission.id,
          {
            uploaded_by: user.id,
            role: 'student',
            file_url: asset.url,
            file_type: asset.type ?? fileToUpload.type ?? file.type ?? 'file',
            note: meta.note ?? '',
          },
          { profileId: user.id },
        );
        await refreshHomework();
        return true;
      } finally {
        setHomeworkUploading(false);
      }
    },
    [user, homeworkSubmissions, handleEnsureHomeworkSubmission, refreshHomework],
  );

  const handleUpdateHomeworkSubmission = useCallback(
    async (assignmentId, payload) => {
      if (!user) {
        throw new Error('Требуется авторизация');
      }
    const submission =
      homeworkSubmissions.find((item) => item.homework_id === assignmentId) ??
      (await handleEnsureHomeworkSubmission(assignmentId));
    if (!submission) {
      throw new Error('Не удалось найти отправку');
    }
    const updated = await updateHomeworkSubmission(submission.id, payload, { profileId: user.id });
      setHomeworkSubmissions((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === updated.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = updated;
          return next;
        }
        return [...prev, updated];
      });
      await refreshHomework();
      return updated;
    },
    [user, homeworkSubmissions, handleEnsureHomeworkSubmission, refreshHomework],
  );

  const handleRemoveHomeworkFile = useCallback(
    async (submissionId, fileId) => {
      if (!user) {
        throw new Error('Требуется авторизация');
      }
      setHomeworkUploading(true);
      try {
        await deleteHomeworkSubmissionFile(fileId, { profileId: user.id });
        await refreshHomework();
        return true;
      } finally {
        setHomeworkUploading(false);
      }
    },
    [user, refreshHomework],
  );

  const handleAddTaskFromHomework = useCallback(
    async (assignment) => {
      if (!user) return;
      await handleTaskCreate({
        title: `ДЗ: ${assignment.title}`,
        category: 'Домашнее',
        status: 'todo',
        difficulty: assignment.difficulty ?? 'medium',
      });
    },
    [user, handleTaskCreate],
  );

  const handleAdminFetchPersonalTheory = useCallback(async (code) => {
    const profile = await fetchProfileByCode(code);
    if (!profile) {
      throw new Error('Профиль с таким кодом не найден');
    }
    const items = await fetchPersonalTheory(profile.id);
    return {
      profile: {
        id: profile.id,
        name: profile.name,
        code: profile.code,
        isAdmin: Boolean(profile.is_admin),
      },
      items,
    };
  }, []);

  const handleAdminAddPersonalEntry = useCallback(async (userId, payload) => {
    const entry = await addPersonalTheoryEntry(userId, payload);
    if (user && user.id === userId) {
      setPersonalTheory((prev) => [...prev, entry]);
    }
    return entry;
  }, [user]);

  const handleAdminAddPersonalEntries = useCallback(async (userIds, payload) => {
    const targets = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    if (targets.length === 0) {
      throw new Error('Не выбраны ученики для загрузки материалов.');
    }
    const entries = await addPersonalTheoryEntries(targets, payload);
    if (user) {
      const mine = entries.filter((entry) => String(entry.user_id) === String(user.id));
      if (mine.length) {
        setPersonalTheory((prev) => [...prev, ...mine]);
      }
    }
    return entries;
  }, [user]);

  const handleAdminSendKnowledgeToStudents = useCallback(
    async (resourceId, userIds) => {
      const targets = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
      if (targets.length === 0) {
        throw new Error('Выберите хотя бы одного ученика.');
      }
      const resource = knowledgeResources.find((item) => String(item.id) === String(resourceId));
      if (!resource) {
        throw new Error('Материал не найден.');
      }
      const payload = {
        resource_id: resource.id,
        title: resource.title,
        description: resource.description ?? '',
        type: resource.type ?? 'pdf',
        url: resource.url ?? null,
        content: '',
        difficulty: resource.difficulty ?? 'medium',
        tags: resource.tags ?? [],
      };
      const entries = await addPersonalTheoryEntries(targets, payload);
      if (user) {
        const mine = entries.filter((entry) => String(entry.user_id) === String(user.id));
        if (mine.length) {
          setPersonalTheory((prev) => [...prev, ...mine]);
        }
      }
      return entries;
    },
    [knowledgeResources, user],
  );

  const handleAdminRemovePersonalEntry = useCallback(async (userId, entryId) => {
    await removePersonalTheoryEntry(userId, entryId);
    if (user && user.id === userId) {
      setPersonalTheory((prev) => prev.filter((item) => item.id !== entryId));
    }
    return true;
  }, [user]);

  const requireAdminCode = useCallback(() => {
    if (!user?.isAdmin || !user?.code) {
      throw new Error('Недостаточно прав для выполнения операции администратора.');
    }
    return user.code;
  }, [user]);

  const requireOwnerCode = useCallback(() => {
    if (!user?.isOwner || !user?.code) {
      throw new Error('Недостаточно прав: требуется владелец.');
    }
    return user.code;
  }, [user]);

  const handleAdminListProfiles = useCallback(async () => {
    const adminCode = requireAdminCode();
    return adminListProfiles(adminCode);
  }, [requireAdminCode]);

  const handleAdminCreateProfile = useCallback(
    async (payload) => {
      const adminCode = requireAdminCode();
      const created = await adminCreateProfile(adminCode, payload);
      // Создаём/подтверждаем код доступа автоматически, чтобы пользователь мог войти.
      if (payload?.code) {
        adminCreateAccessCode(adminCode, {
          code: payload.code,
          owner_name: payload.name ?? '',
        }).catch((error) => {
          const message = String(error?.message ?? '').toLowerCase();
          if (!message.includes('duplicate') && !message.includes('unique')) {
            console.warn('Не удалось создать код доступа для профиля', error);
          }
        });
      }
      return created;
    },
    [requireAdminCode],
  );

  const handleAdminUpdateProfile = useCallback(async (profileId, payload) => {
    const adminCode = requireAdminCode();
    const updated = await adminUpdateProfile(adminCode, profileId, payload);
    if (user && String(user.id) === String(profileId)) {
      const nextUser = {
        ...user,
        name: payload?.name ?? user.name,
        isAdmin: Boolean(updated?.is_admin ?? payload?.is_admin ?? user.isAdmin),
      };
      setUser(nextUser);
      try {
        localStorage.setItem('user', JSON.stringify(nextUser));
      } catch (error) {
        console.warn('localStorage setItem failed', error);
      }
      if (!nextUser.isAdmin && view === 'admin') {
        setView('dashboard');
      }
    }
    return updated;
  }, [requireAdminCode, user, view]);

  const handleAdminDeleteProfile = useCallback(async (profileId) => {
    const adminCode = requireAdminCode();
    await adminDeleteProfile(adminCode, profileId);
  }, [requireAdminCode]);

  const handleAdminListAccessCodes = useCallback(async () => {
    const adminCode = requireOwnerCode();
    return adminListAccessCodes(adminCode);
  }, [requireOwnerCode]);

  const handleAdminCreateAccessCode = useCallback(async (payload) => {
    const adminCode = requireOwnerCode();
    const created = await adminCreateAccessCode(adminCode, payload);
    return created;
  }, [requireOwnerCode]);

  const handleAdminDeleteAccessCode = useCallback(async (codeId) => {
    const adminCode = requireOwnerCode();
    await adminDeleteAccessCode(adminCode, codeId);
  }, [requireOwnerCode]);

  const handleAdminAssignAccessCode = useCallback(async (payload) => {
    const adminCode = requireOwnerCode();
    const updated = await adminAssignAccessCode(adminCode, payload);
    return updated;
  }, [requireOwnerCode]);

  const handleAdminListAccessRequests = useCallback(async () => {
    const adminCode = requireAdminCode();
    return adminListAccessRequests(adminCode);
  }, [requireAdminCode]);

  const handleAdminApproveAccessRequest = useCallback(async (requestId) => {
    const adminCode = requireOwnerCode();
    const result = await adminApproveAccessRequest(adminCode, requestId);
    return result;
  }, [requireOwnerCode]);

  const handleAdminFetchProgress = useCallback(async (targetCode) => {
    const adminCode = requireAdminCode();
    const data = await adminFetchProgress(adminCode, targetCode);
    return data;
  }, [requireAdminCode]);

  const handleAdminResetProgress = useCallback(async (targetCode) => {
    const adminCode = requireAdminCode();
    await adminResetProgress(adminCode, targetCode);
  }, [requireAdminCode]);

  const handleAdminListTasks = useCallback(async (targetCode) => {
    const adminCode = requireAdminCode();
    return adminListTasks(adminCode, targetCode);
  }, [requireAdminCode]);

  const handleAdminCreateTask = useCallback(async (targetCode, payload) => {
    const adminCode = requireAdminCode();
    const created = await adminCreateTaskEntry(adminCode, targetCode, payload);
    return created;
  }, [requireAdminCode]);

  const handleAdminUpdateTaskStatus = useCallback(async (targetCode, taskId, status) => {
    const adminCode = requireAdminCode();
    const updated = await adminUpdateTaskStatusEntry(adminCode, targetCode, taskId, status);
    return updated;
  }, [requireAdminCode]);

  const handleAdminDeleteTask = useCallback(async (targetCode, taskId) => {
    const adminCode = requireAdminCode();
    await adminDeleteTaskEntry(adminCode, targetCode, taskId);
  }, [requireAdminCode]);

  const handleAdminUpsertKnowledge = useCallback(async (payload) => {
    const adminCode = requireAdminCode();
    const result = await adminUpsertKnowledgeResource(adminCode, payload);
    await refreshKnowledge();
    return result;
  }, [requireAdminCode, refreshKnowledge]);

  const handleAdminDeleteKnowledge = useCallback(async (resourceId) => {
    const adminCode = requireAdminCode();
    await adminDeleteKnowledgeResource(adminCode, resourceId);
    await refreshKnowledge();
  }, [requireAdminCode, refreshKnowledge]);

  const handleAdminUpsertTheory = useCallback(async (payload) => {
    const adminCode = requireAdminCode();
    const result = await adminUpsertTheory(adminCode, payload);
    await refreshTheory();
    return result;
  }, [requireAdminCode, refreshTheory]);

  const handleAdminDeleteTheory = useCallback(async (theoryId) => {
    const adminCode = requireAdminCode();
    await adminDeleteTheory(adminCode, theoryId);
    await refreshTheory();
  }, [requireAdminCode, refreshTheory]);

  // Синхронизация прав администратора при смене статуса в базе.
  useEffect(() => {
    let cancelled = false;
    const syncProfile = async () => {
      if (!user?.code) return;
      try {
        const profile = await fetchProfileByCode(user.code);
        if (!profile) return;
        const next = {
          id: profile.id,
          name: profile.name ?? user.name,
          code: profile.code ?? user.code,
          isAdmin: Boolean(profile.is_admin),
          isOwner: Boolean(profile.is_owner),
        };
        if (cancelled) return;
        setUser(next);
        try {
          localStorage.setItem('user', JSON.stringify(next));
        } catch (error) {
          console.warn('localStorage setItem failed', error);
        }
        if (!next.isAdmin && view === 'admin') {
          setView('dashboard');
        }
      } catch (error) {
        console.warn('Не удалось синхронизировать профиль', error);
      }
    };
    syncProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.code, view]);

  const handleAdminUpsertSchedule = useCallback(async (payload) => {
    const adminCode = requireAdminCode();
    const result = await adminUpsertSchedule(adminCode, payload);
    await refreshSchedule();
    return result;
  }, [requireAdminCode, refreshSchedule]);

  const handleAdminDeleteSchedule = useCallback(async (scheduleId) => {
    const adminCode = requireAdminCode();
    await adminDeleteSchedule(adminCode, scheduleId);
    await refreshSchedule();
  }, [requireAdminCode, refreshSchedule]);

  const refreshAdminHomework = useCallback(async () => {
    const adminCode = requireAdminCode();
    const data = await adminFetchHomework(adminCode);
    setAdminHomeworkAssignments(data.assignments ?? []);
    setAdminHomeworkSubmissions(data.submissions ?? []);
    setAdminHomeworkSupportsTargets(data.supportsTargets !== false);
    return data;
  }, [requireAdminCode]);

  const handleAdminCreateHomeworkEntry = useCallback(
    async (payload) => {
      const adminCode = requireAdminCode();
      setAdminHomeworkUploading(true);
      try {
        const files = Array.isArray(payload.files) ? payload.files : [];
        const uploadedFiles = [];
        for (const fileEntry of files) {
          if (!fileEntry?.file) continue;
          const path = `assignments/${Date.now()}-${sanitizeFileName(fileEntry.file.name)}`;
          const asset = await uploadHomeworkAsset(fileEntry.file, path);
          uploadedFiles.push({
            title: fileEntry.title ?? fileEntry.file.name,
            description: fileEntry.description ?? '',
            file_url: asset.url,
            file_type: asset.type ?? fileEntry.file.type ?? 'file',
          });
        }
        const result = await adminCreateHomework(
          adminCode,
          {
            ...payload,
            files: uploadedFiles,
          },
          user?.id ?? null,
        );
        await refreshAdminHomework();
        return result;
      } finally {
        setAdminHomeworkUploading(false);
      }
    },
    [requireAdminCode, user?.id, refreshAdminHomework],
  );

  const handleAdminDeleteHomeworkEntry = useCallback(
    async (assignmentId) => {
      const adminCode = requireAdminCode();
      await adminDeleteHomework(adminCode, assignmentId);
      await refreshAdminHomework();
    },
    [requireAdminCode, refreshAdminHomework],
  );

  const handleAdminUploadSubmissionFile = useCallback(
    async (submissionId, file, meta = {}) => {
      const adminCode = requireAdminCode();
      setAdminHomeworkUploading(true);
      try {
        const fileToUpload = await compressImageFile(file);
        const path = `submissions/${submissionId}/feedback/${Date.now()}-${sanitizeFileName(fileToUpload.name)}`;
        const asset = await uploadHomeworkAsset(fileToUpload, path);
        await addHomeworkSubmissionFile(
          submissionId,
          {
            uploaded_by: user?.id ?? null,
            role: meta.role ?? 'tutor',
            file_url: asset.url,
            file_type: asset.type ?? fileToUpload.type ?? file.type ?? 'file',
            note: meta.note ?? '',
          },
          { adminCode },
        );
        await refreshAdminHomework();
        return true;
      } finally {
        setAdminHomeworkUploading(false);
      }
    },
    [user?.id, refreshAdminHomework, requireAdminCode],
  );

  const handleAdminUpdateHomeworkSubmission = useCallback(
    async (submissionId, payload) => {
      const adminCode = requireAdminCode();
      await updateHomeworkSubmission(submissionId, payload, { adminCode });
      await refreshAdminHomework();
    },
    [refreshAdminHomework, requireAdminCode],
  );

  const handleAdminFetchRecipients = useCallback(async () => {
    const adminCode = requireAdminCode();
    const result = await fetchHomeworkRecipients(adminCode);
    const rules = result.rules ?? (Array.isArray(result) ? result : []);
    setHomeworkRecipients(rules);
    setHomeworkRecipientsSupported(result.supported !== false);
    return { rules, supported: result.supported !== false };
  }, [requireAdminCode]);

  const handleAdminSaveRecipients = useCallback(
    async (reviewerId, studentIds) => {
      const adminCode = requireAdminCode();
      const result = await saveHomeworkRecipients(adminCode, reviewerId, studentIds);
      const rules = result.rules ?? (Array.isArray(result) ? result : []);
      setHomeworkRecipients((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const filtered = base.filter((rule) => String(rule.reviewer_id) !== String(reviewerId));
        return [...filtered, ...rules];
      });
      setHomeworkRecipientsSupported(result.supported !== false);
      return { rules, supported: result.supported !== false };
    },
    [requireAdminCode],
  );

  const adminApi = useMemo(() => ({
    users: {
      list: handleAdminListProfiles,
      create: handleAdminCreateProfile,
      update: handleAdminUpdateProfile,
      remove: handleAdminDeleteProfile,
    },
    codes: {
      list: handleAdminListAccessCodes,
      create: handleAdminCreateAccessCode,
      remove: handleAdminDeleteAccessCode,
      assign: handleAdminAssignAccessCode,
    },
    accessRequests: {
      list: handleAdminListAccessRequests,
      approve: handleAdminApproveAccessRequest,
    },
    progress: {
      fetch: handleAdminFetchProgress,
      reset: handleAdminResetProgress,
    },
    assignments: {
      list: handleAdminListTasks,
      create: handleAdminCreateTask,
      updateStatus: handleAdminUpdateTaskStatus,
      remove: handleAdminDeleteTask,
    },
    cards: {
      create: handleCardCreate,
      update: handleCardUpdate,
      remove: handleCardDelete,
    },
    practice: {
      create: handlePracticeCreate,
      update: handlePracticeUpdate,
      remove: handlePracticeDelete,
      upload: uploadPracticeImage,
    },
    knowledge: {
      create: handleAdminUpsertKnowledge,
      update: handleAdminUpsertKnowledge,
      remove: handleAdminDeleteKnowledge,
      upload: uploadKnowledgeAsset,
      sendToStudents: handleAdminSendKnowledgeToStudents,
    },
    theory: {
      create: handleAdminUpsertTheory,
      update: handleAdminUpsertTheory,
      remove: handleAdminDeleteTheory,
    },
    schedule: {
      create: handleAdminUpsertSchedule,
      update: handleAdminUpsertSchedule,
      remove: handleAdminDeleteSchedule,
    },
    personal: {
      loadByCode: handleAdminFetchPersonalTheory,
      addEntry: handleAdminAddPersonalEntry,
      addEntries: handleAdminAddPersonalEntries,
      removeEntry: handleAdminRemovePersonalEntry,
      upload: uploadKnowledgeAsset,
    },
    homework: {
      create: handleAdminCreateHomeworkEntry,
      remove: handleAdminDeleteHomeworkEntry,
      uploadSubmissionFile: handleAdminUploadSubmissionFile,
      updateSubmission: handleAdminUpdateHomeworkSubmission,
      refresh: refreshAdminHomework,
      uploading: adminHomeworkUploading,
      supportsTargeting: adminHomeworkSupportsTargets,
    },
    homeworkRecipients: {
      list: handleAdminFetchRecipients,
      saveForReviewer: handleAdminSaveRecipients,
    },
    refresh: {
      cards: refreshCards,
      practice: refreshPractice,
      knowledge: refreshKnowledge,
      theory: refreshTheory,
      schedule: refreshSchedule,
      homework: refreshAdminHomework,
    },
  }), [
    handleCardCreate,
    handleCardUpdate,
    handleCardDelete,
    handlePracticeCreate,
    handlePracticeUpdate,
    handlePracticeDelete,
    uploadPracticeImage,
    handleAdminUpsertKnowledge,
    handleAdminDeleteKnowledge,
    handleAdminListProfiles,
    handleAdminCreateProfile,
    handleAdminUpdateProfile,
    handleAdminDeleteProfile,
    handleAdminListAccessCodes,
    handleAdminCreateAccessCode,
    handleAdminDeleteAccessCode,
    handleAdminAssignAccessCode,
    handleAdminListAccessRequests,
    handleAdminApproveAccessRequest,
    handleAdminFetchProgress,
    handleAdminResetProgress,
    handleAdminListTasks,
    handleAdminCreateTask,
    handleAdminUpdateTaskStatus,
    handleAdminDeleteTask,
    handleAdminUpsertTheory,
    handleAdminDeleteTheory,
    handleAdminUpsertSchedule,
    handleAdminDeleteSchedule,
    handleAdminCreateHomeworkEntry,
    handleAdminDeleteHomeworkEntry,
    handleAdminUploadSubmissionFile,
    handleAdminUpdateHomeworkSubmission,
    refreshAdminHomework,
    handleAdminFetchPersonalTheory,
    handleAdminAddPersonalEntry,
    handleAdminAddPersonalEntries,
    handleAdminRemovePersonalEntry,
    handleAdminSendKnowledgeToStudents,
    refreshCards,
    refreshPractice,
    refreshKnowledge,
    refreshTheory,
    refreshSchedule,
    adminHomeworkUploading,
    adminHomeworkSupportsTargets,
  ]);

  useEffect(() => {
    if (view === 'admin' && user?.isAdmin) {
      refreshAdminHomework().catch((error) => {
        console.warn('Не удалось обновить данные домашних заданий администратора', error);
      });
    }
  }, [view, user?.isAdmin, refreshAdminHomework]);

  useEffect(() => {
    if (view !== 'admin' || !user?.isAdmin) return;
    handleAdminFetchRecipients().catch((error) => {
      console.warn('Не удалось обновить получателей ДЗ', error);
    });
  }, [view, user?.isAdmin, handleAdminFetchRecipients]);

  if (initialising) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <svg className="h-8 w-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p>Загружаем площадку…</p>
        </div>
      </div>
    );
  }

  if (globalError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-rose-50 px-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold text-rose-700">Возникла ошибка</h1>
          <p className="text-sm text-rose-600">{globalError}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-brand px-5 py-3 text-white font-semibold shadow hover:bg-brand-dark"
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginForm
        onSubmit={handleLogin}
        loading={authLoading}
        offlineNotice={offlineNotice}
        onRequestAccess={handleAccessRequestSubmit}
        onCheckAccess={handleAccessRequestCheck}
        accessRequest={{
          id: accessRequestId,
          status: accessRequestStatus,
          name: accessRequestName,
          code: accessRequestCode,
          error: accessRequestError,
          loading: accessRequestLoading,
        }}
      />
    );
  }

  if (view === 'trainer') {
    return (
      <TrainingDeck
        cards={cards}
        cases={practiceCases}
        progress={progress}
        onProgressChange={handleProgressChange}
        onCaseStatusChange={handleCaseStatusChange}
        onBack={() => setView('dashboard')}
        focusMode={trainerFocusMode}
        focusCategory={trainerFocusCategory}
      />
    );
  }

  if (view === 'review') {
    return (
      <ReviewDeck
        cards={reviewCards}
        cases={reviewCases}
        statuses={progress.statuses ?? {}}
        caseStatuses={progress.caseStatuses ?? {}}
        onUpdateStatus={handleCardStatusChange}
        onUpdateCaseStatus={handleCaseStatusChange}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'theory') {
    return <TheorySection items={theoryItems} onBack={() => setView('dashboard')} />;
  }

  if (view === 'schedule') {
    return (
      <ScheduleTable
        items={scheduleItems}
        selected={progress.scheduleParticipation ?? {}}
        onToggleParticipation={handleScheduleParticipationToggle}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'knowledge') {
    return (
      <KnowledgeBase
        items={theoryAllItems}
        personalItems={personalTheory}
        loadingPersonal={personalLoading}
        activeTab={knowledgeTab}
        onBack={() => setView('dashboard')}
        onSelectTab={setKnowledgeTab}
        onAddPersonal={handlePersonalTheoryAdd}
        onRemovePersonal={handlePersonalTheoryRemove}
        onUploadAsset={uploadKnowledgeAsset}
        user={user}
      />
    );
  }

  if (view === 'homework') {
    return (
      <HomeworkBoard
        assignments={homeworkAssignments}
        submissions={homeworkSubmissions}
        cards={cards}
        practiceCases={practiceCases}
        knowledgeResources={knowledgeResources}
        theoryItems={theoryItems}
        personalTheory={personalTheory}
        progress={progress}
        user={user}
        onEnsureSubmission={handleEnsureHomeworkSubmission}
        onUploadFile={handleUploadHomeworkFile}
        onRemoveFile={handleRemoveHomeworkFile}
        onUpdateSubmission={handleUpdateHomeworkSubmission}
        onProgressChange={handleProgressChange}
        onAddTaskFromAssignment={handleAddTaskFromHomework}
        onRefresh={refreshHomework}
        uploading={homeworkUploading}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'admin') {
    return (
      <AdminPanel
        user={user}
        cards={cards}
        practiceCases={practiceCases}
        theoryItems={theoryItems}
      knowledgeResources={knowledgeResources}
      scheduleItems={scheduleItems}
      homeworkAssignments={adminHomeworkAssignments}
      homeworkSubmissions={adminHomeworkSubmissions}
      adminApi={adminApi}
      homeworkSupportsTargets={adminHomeworkSupportsTargets}
      homeworkRecipients={homeworkRecipients}
      homeworkRecipientsSupported={homeworkRecipientsSupported}
      onBack={() => setView('dashboard')}
    />
  );
}

  return (
    <Dashboard
      user={user}
      progress={progressByCategory}
      totals={totalsByCategory}
      reviewSummary={reviewSummary}
      caseTotals={caseTotalsByCategory}
      caseProgress={caseProgressByCategory}
      caseSummary={caseStatusSummary}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      tasks={tasks}
      onTaskCreate={handleTaskCreate}
      onTaskStatusChange={handleTaskStatusChange}
      onTaskDelete={handleTaskDelete}
      homeworkPendingCount={homeworkPendingCount}
      presentationCount={presentationCount}
      cheatsheetCount={cheatsheetCount}
    />
  );
}
