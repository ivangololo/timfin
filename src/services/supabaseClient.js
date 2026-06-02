import { createClient } from '@supabase/supabase-js';

const apiOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : import.meta.env.VITE_APP_ORIGIN || 'http://localhost:5173';
const supabaseUrl = `${apiOrigin}/api/supabase`;
const supabaseAnonKey = 'server-side-proxy';

export const isSupabaseConfigured = true;

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

const STORAGE_KEYS = {
  user: 'fg_user',
  accessRequestId: 'fg_access_request_id',
};

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeGetItem = (key) => {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('localStorage getItem failed', error);
    return null;
  }
};

const safeSetItem = (key, value) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('localStorage setItem failed', error);
  }
};

const safeRemoveItem = (key) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('localStorage removeItem failed', error);
  }
};

const normalizeDifficulty = (value) => {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'medium';
};

const normalizeCode = (value) => {
  if (!value) throw new Error('Требуется код доступа');
  return String(value).trim().toUpperCase();
};

const isLogoColumnError = (error) =>
  Boolean(error?.message) &&
  error.message.toLowerCase().includes('logo_url') &&
  error.message.toLowerCase().includes('column');

const isScheduleMetaError = (error) =>
  Boolean(error?.message) &&
  (error.message.toLowerCase().includes('date_meta') ||
    error.message.toLowerCase().includes('registration_url') ||
    error.message.toLowerCase().includes('level') ||
    error.message.toLowerCase().includes('registration_start') ||
    error.message.toLowerCase().includes('registration_end'));

let scheduleSupportsLogo = undefined;
let scheduleSupportsMeta = undefined;
let scheduleAdminRpcAvailable = true;
const practiceImageOptIn = import.meta.env.VITE_PRACTICE_IMAGE;
// Включаем image_url по умолчанию, можно отключить через VITE_PRACTICE_IMAGE=false.
let practiceSupportsImage = practiceImageOptIn === 'false' ? false : undefined;
let practiceImagesRelationAvailable = undefined;
let practiceSupportsLogo = undefined;
// Поддержка назначения по получателям ДЗ: по умолчанию считаем включённой, отключаем только при явной ошибке колонок.
let homeworkSupportsTargets = undefined;
// RPC может отсутствовать, по умолчанию пробуем без него.
let studentHomeworkRpcAvailable = false;
// RPC может отсутствовать в схеме, поэтому по умолчанию отключаем и включим только если явно успешно сработает.
let adminHomeworkRpcAvailable = false;

const HOMEWORK_STATUS_CANONICAL = ['assigned', 'in_progress', 'in_review', 'rejected', 'completed'];
const HOMEWORK_STATUS_SET = new Set(HOMEWORK_STATUS_CANONICAL);
const HOMEWORK_STATUS_ALIASES = {
  assigned: ['assigned', 'new', 'pending', 'not_submitted', 'todo'],
  in_progress: ['in_progress', 'submitted', 'sent', 'uploaded'],
  in_review: ['in_review', 'reviewing', 'review', 'checking', 'in_check', 'under_review'],
  rejected: ['rejected', 'needs_work', 'returned', 'revision', 'changes_requested', 'needs_revision'],
  completed: ['completed', 'done', 'checked', 'reviewed', 'approved'],
};

let homeworkStatusDialect = HOMEWORK_STATUS_CANONICAL.reduce((acc, status) => {
  acc[status] = status;
  return acc;
}, {});

const learnHomeworkStatusDialect = (canonical, rawStatus) => {
  if (!canonical || !HOMEWORK_STATUS_SET.has(canonical)) return;
  const normalizedRaw = String(rawStatus ?? '').trim();
  if (!normalizedRaw || normalizedRaw.toLowerCase() === canonical) return;
  if (homeworkStatusDialect[canonical] === canonical) {
    homeworkStatusDialect[canonical] = normalizedRaw;
  }
};

const normalizeHomeworkSubmissionStatus = (rawStatus) => {
  const normalized = String(rawStatus ?? '').trim();
  if (!normalized) return 'assigned';
  const lower = normalized.toLowerCase();
  if (HOMEWORK_STATUS_SET.has(lower)) return lower;

  for (const canonical of HOMEWORK_STATUS_CANONICAL) {
    const dialect = String(homeworkStatusDialect[canonical] ?? '').toLowerCase();
    if (dialect && dialect === lower) {
      return canonical;
    }
  }

  if (HOMEWORK_STATUS_ALIASES.in_progress.some((value) => value === lower)) {
    learnHomeworkStatusDialect('in_progress', lower);
    return 'in_progress';
  }
  if (HOMEWORK_STATUS_ALIASES.in_review.some((value) => value === lower)) {
    learnHomeworkStatusDialect('in_review', lower);
    return 'in_review';
  }
  if (HOMEWORK_STATUS_ALIASES.completed.some((value) => value === lower)) {
    learnHomeworkStatusDialect('completed', lower);
    return 'completed';
  }
  if (HOMEWORK_STATUS_ALIASES.rejected.some((value) => value === lower)) {
    learnHomeworkStatusDialect('rejected', lower);
    return 'rejected';
  }
  if (HOMEWORK_STATUS_ALIASES.assigned.some((value) => value === lower)) {
    learnHomeworkStatusDialect('assigned', lower);
    return 'assigned';
  }

  return 'assigned';
};

const homeworkStatusCandidates = (canonicalStatus) => {
  const canonical = String(canonicalStatus ?? '').toLowerCase();
  if (!HOMEWORK_STATUS_SET.has(canonical)) return [canonicalStatus].filter(Boolean);
  const candidates = [];
  const seen = new Set();
  const add = (value) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return;
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    candidates.push(normalized);
  };

  add(homeworkStatusDialect[canonical]);
  add(canonical);
  (HOMEWORK_STATUS_ALIASES[canonical] ?? []).forEach(add);
  return candidates;
};

const isHomeworkStatusConstraintError = (error) => {
  const message = String(error?.message ?? '').toLowerCase();
  if (!message.includes('violates check constraint')) return false;
  if (message.includes('homework_submissions_status_check')) return true;
  return message.includes('homework_submissions') && message.includes('status_check');
};

const ensureAdminCode = (value) => {
  const normalized = normalizeCode(value);
  if (!normalized) {
    throw new Error('Укажите код администратора');
  }
  return normalized;
};

const generatePrefixedId = (prefix) => {
  const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
  const core = hasCrypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${core}` : core;
};

const sanitizeFileName = (name) => {
  const base = (name ?? 'file').split('/').pop().split('\\').pop();
  const normalized = base.normalize('NFKD').replace(/[^\w.-]+/g, '_');
  const compacted = normalized.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return compacted || `file-${Date.now()}`;
};

const normalizeImageUrls = (...sources) => {
  const urls = [];
  const seen = new Set();
  const add = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    const raw = typeof value === 'string' ? value : value?.file_url ?? value?.url ?? '';
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) return;
    const normalized = trimmed.replace(/\s/g, '%20');
    if (seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };
  sources.forEach(add);
  return urls;
};

const ensureSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase не настроен. Укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.');
  }
  return supabase;
};

export async function signInWithCode(code) {
  const normalized = code.trim().toUpperCase();
  const client = ensureSupabase();

  const { data: accessCode, error: codeError } = await client
    .from('access_codes')
    .select('id, code, owner_name, user_id')
    .eq('code', normalized)
    .maybeSingle();

  if (codeError) throw new Error('Ошибка проверки кода: ' + codeError.message);
  if (!accessCode) throw new Error('Код не найден');

  const { data: existingProfile, error: selectProfileError } = await client
    .from('profiles')
    .select('id, name, code, is_admin, is_owner')
    .eq('code', normalized)
    .maybeSingle();

  if (selectProfileError) throw new Error(selectProfileError.message);

  let profile = existingProfile;

  if (!profile) {
    const profilePayload = {
      name: accessCode.owner_name ?? `Ученик ${normalized.slice(-4)}`,
      code: normalized,
      is_admin: false,
    };

    const { data: createdProfile, error: createProfileError } = await client
      .from('profiles')
      .insert(profilePayload)
      .select()
      .single();

    if (createProfileError) throw new Error(createProfileError.message);
    profile = createdProfile;
  }

  const { error: updateError } = await client
    .from('access_codes')
    .update({ user_id: profile.id })
    .eq('id', accessCode.id);

  if (updateError) throw new Error(updateError.message);

  const user = {
    id: profile.id,
    name: profile.name,
    code: normalized,
    isAdmin: Boolean(profile.is_admin),
    isOwner: Boolean(profile.is_owner),
  };
  safeSetItem(STORAGE_KEYS.user, JSON.stringify(user));
  return user;
}

export async function loadUser() {
  const raw = safeGetItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      safeRemoveItem(STORAGE_KEYS.user);
      return null;
    }
    const hasValidId =
      typeof parsed.id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id);
    if (hasValidId) {
      if (typeof parsed.isOwner !== 'boolean' && parsed.code) {
        try {
          const profile = await fetchProfileByCode(parsed.code);
          if (profile) {
            const upgraded = {
              id: profile.id,
              name: profile.name ?? parsed.name ?? parsed.code,
              code: profile.code ?? parsed.code,
              isAdmin: Boolean(profile.is_admin),
              isOwner: Boolean(profile.is_owner),
            };
            safeSetItem(STORAGE_KEYS.user, JSON.stringify(upgraded));
            return upgraded;
          }
        } catch (error) {
          console.warn('Не удалось обновить флаг владельца', error);
        }
      }
      return {
        id: parsed.id,
        name: parsed.name,
        code: parsed.code,
        isAdmin: Boolean(parsed.isAdmin),
        isOwner: Boolean(parsed.isOwner),
      };
    }
    if (!parsed.code) {
      safeRemoveItem(STORAGE_KEYS.user);
      return null;
    }
    try {
      const profile = await fetchProfileByCode(parsed.code);
      if (!profile) {
        safeRemoveItem(STORAGE_KEYS.user);
        return null;
      }
      const upgraded = {
        id: profile.id,
        name: profile.name ?? parsed.name ?? parsed.code,
        code: profile.code ?? parsed.code,
        isAdmin: Boolean(profile.is_admin),
        isOwner: Boolean(profile.is_owner),
      };
      safeSetItem(STORAGE_KEYS.user, JSON.stringify(upgraded));
      return upgraded;
    } catch (error) {
      console.warn('Не удалось получить профиль для обновления пользователя', error);
      safeRemoveItem(STORAGE_KEYS.user);
      return null;
    }
  } catch (error) {
    console.warn('Не удалось прочитать сохранённого пользователя', error);
    return null;
  }
}

export async function logout() {
  safeRemoveItem(STORAGE_KEYS.user);
  safeRemoveItem(STORAGE_KEYS.accessRequestId);
  if (supabase) {
    await supabase.auth.signOut();
  }
}

export async function submitAccessRequest(fullName) {
  const client = ensureSupabase();
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  if (!name) throw new Error('Укажите имя и фамилию');
  const { data, error } = await client.rpc('submit_access_request', { p_full_name: name }).single();
  if (error) throw new Error(error.message);
  if (data?.id) {
    safeSetItem(STORAGE_KEYS.accessRequestId, data.id);
  }
  return data;
}

export function loadAccessRequestId() {
  return safeGetItem(STORAGE_KEYS.accessRequestId);
}

export function clearAccessRequestId() {
  safeRemoveItem(STORAGE_KEYS.accessRequestId);
}

export async function claimAccessCode(requestId) {
  const client = ensureSupabase();
  const { data, error } = await client.rpc('claim_access_code', { p_request_id: requestId }).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function loadProgress(userId) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('progress')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.data ?? {};
}

export async function saveProgress(userId, payload) {
  const client = ensureSupabase();
  const { error } = await client
    .from('progress')
    .upsert({ user_id: userId, data: payload });

  if (error) throw new Error(error.message);
}

export async function fetchCards() {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('training_cards')
    .select('id, category, question, answer, difficulty, created_at')
    .order('category', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((card) => ({
    ...card,
    difficulty: normalizeDifficulty(card.difficulty),
  }));
}

export async function fetchTheory() {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('theory')
    .select('id, title, summary, content, updated_at')
    .order('title', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchSchedule() {
  const client = ensureSupabase();
  const baseSelect = 'id, title, status, date, start, end, format, direction, registration';
  const selectWithLogo = `${baseSelect}, logo_url`;
  const selectWithMeta = `${selectWithLogo}, date_meta, registration_url, level, registration_start, registration_end`;

  let { data, error } = await client.from('schedule').select(selectWithMeta).order('date', { ascending: true });

  if (error) {
    if (isScheduleMetaError(error)) {
      scheduleSupportsMeta = false;
      ({ data, error } = await client.from('schedule').select(selectWithLogo).order('date', { ascending: true }));
    }
  }

  if (error) {
    if (isLogoColumnError(error)) {
      scheduleSupportsLogo = false;
      ({ data, error } = await client.from('schedule').select(baseSelect).order('date', { ascending: true }));
    }
  }

  if (error) throw new Error(error.message);

  scheduleSupportsLogo = scheduleSupportsLogo !== false;
  scheduleSupportsMeta = scheduleSupportsMeta !== false;
  return (data ?? []).map(mapScheduleItem);
}

const mapScheduleItem = (item) => {
  const metaRaw = item.date_meta;
  const meta = typeof metaRaw === 'string' ? safeParseJSON(metaRaw, {}) : metaRaw ?? {};
  const type = meta.type ?? 'single';
  const multiple = Array.isArray(meta.multiple_dates) ? meta.multiple_dates : [];

  const toDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  let displayDate = '';
  let orderDate = item.date ?? null;

  if (type === 'range' && meta.date_range_start && meta.date_range_end) {
    displayDate = `${formatDisplayDate(meta.date_range_start)} – ${formatDisplayDate(meta.date_range_end)}`;
    orderDate = meta.date_range_start ?? orderDate;
  } else if (type === 'multiple' && multiple.length) {
    displayDate = multiple.map(formatDisplayDate).join(', ');
    orderDate = multiple.slice().sort()[0] ?? orderDate;
  } else if (meta.single_date) {
    displayDate = formatDisplayDate(meta.single_date);
    orderDate = meta.single_date ?? orderDate;
  } else if (item.date) {
    displayDate = formatDisplayDate(item.date);
  }

  const now = new Date();
  const regStart = toDate(item.registration_start);
  const regEnd = toDate(item.registration_end ?? item.registration);

  let statusEffective = item.status ?? 'open';
  if (regStart && now < regStart) {
    statusEffective = 'waitlist';
  } else if (regEnd && now > regEnd) {
    statusEffective = 'closed';
  } else if (!item.status) {
    statusEffective = 'open';
  }

  return {
    ...item,
    date_display: displayDate,
    order_date: orderDate,
    level: item.level ?? item.direction ?? null,
    status_effective: statusEffective,
  };
};

const formatDisplayDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

const safeParseJSON = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export async function fetchPractice() {
  const client = ensureSupabase();
  const baseSelect = 'id, title, summary, prompt, solution, points, difficulty, created_at, category, mentor_comment';
  const selectCore = `${baseSelect}, logo_url`;
  const selectWithImage = `${selectCore}, image_url`;
  const selectWithImages = `${selectWithImage}, images:practice_case_images(file_url, side)`;

  const buildQuery = () => {
    if (practiceImagesRelationAvailable === false) {
      if (practiceSupportsImage === false && practiceSupportsLogo === false) return baseSelect;
      if (practiceSupportsImage === false) return selectCore;
      if (practiceSupportsLogo === false) return selectWithImage.replace(', logo_url', '');
      return selectWithImage;
    }
    if (practiceSupportsImage === false) {
      if (practiceSupportsLogo === false) return `${baseSelect}, images:practice_case_images(file_url, side)`;
      return `${selectCore}, images:practice_case_images(file_url, side)`;
    }
    if (practiceSupportsLogo === false) return `${baseSelect}, image_url, images:practice_case_images(file_url, side)`;
    return selectWithImages;
  };

  let query = buildQuery();
  let { data, error } = await client.from('practice_cases').select(query).order('created_at', { ascending: true });

  if (error && isPracticeLogoError(error)) {
    practiceSupportsLogo = false;
    query = buildQuery();
    ({ data, error } = await client.from('practice_cases').select(query).order('created_at', { ascending: true }));
  }

  if (error) {
    if (isPracticeImagesRelationError(error)) {
      practiceImagesRelationAvailable = false;
      query = buildQuery();
      ({ data, error } = await client.from('practice_cases').select(query).order('created_at', { ascending: true }));
    } else if (practiceSupportsImage !== false && isPracticeImageError(error)) {
      practiceSupportsImage = false;
      query = buildQuery();
      ({ data, error } = await client.from('practice_cases').select(query).order('created_at', { ascending: true }));
    } else if (practiceSupportsImage !== false) {
      // unknown error with image column: fallback to base select to avoid breaking UI
      ({ data, error } = await client.from('practice_cases').select(baseSelect).order('created_at', { ascending: true }));
    }
  }

  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => ({
    ...item,
    difficulty: normalizeDifficulty(item.difficulty),
    category: item.category ?? 'Общая практика',
    mentor_comment: item.mentor_comment ?? '',
    logo_url: practiceSupportsLogo === false ? null : item.logo_url ?? null,
    image_url: item.image_url ?? null,
    images_front: normalizeImageUrls(
      item.image_url,
      Array.isArray(item.images)
        ? item.images
            .filter((entry) => {
              const side = String(entry?.side ?? '').toLowerCase();
              return side === 'front' || !side;
            })
            .map((entry) => entry?.file_url ?? entry)
        : [],
    ),
    images_back: normalizeImageUrls(
      Array.isArray(item.images)
        ? item.images
            .filter((entry) => String(entry?.side ?? '').toLowerCase() === 'back')
            .map((entry) => entry?.file_url ?? entry)
        : [],
    ),
  }));
}

export async function fetchKnowledgeBase() {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('knowledge_resources')
    .select('id, category, title, description, type, url, content, difficulty, tags, updated_at')
    .order('category', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => ({
    ...item,
    difficulty: normalizeDifficulty(item.difficulty),
    tags: Array.isArray(item.tags) ? item.tags : [],
  }));
}

export async function fetchPersonalTheory(userId) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('personal_theory')
    .select('id, user_id, resource_id, title, description, type, url, content, difficulty, tags, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => ({
    ...item,
    difficulty: normalizeDifficulty(item.difficulty),
    tags: Array.isArray(item.tags) ? item.tags : [],
  }));
}

export async function addPersonalTheoryEntry(userId, payload) {
  const client = ensureSupabase();
  const insertPayload = {
    user_id: userId,
    resource_id: payload.resource_id ?? null,
    title: payload.title,
    description: payload.description ?? '',
    type: payload.type,
    url: payload.url ?? null,
    content: payload.content ?? '',
    difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
    tags: payload.tags ?? [],
  };

  const { data, error } = await client
    .from('personal_theory')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}

export async function addPersonalTheoryEntries(userIds = [], payload) {
  const client = ensureSupabase();
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  if (ids.length === 0) {
    throw new Error('Не выбраны ученики для загрузки материалов.');
  }

  const insertPayload = ids.map((userId) => ({
    user_id: userId,
    resource_id: payload.resource_id ?? null,
    title: payload.title,
    description: payload.description ?? '',
    type: payload.type,
    url: payload.url ?? null,
    content: payload.content ?? '',
    difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
    tags: payload.tags ?? [],
  }));

  const { data, error } = await client.from('personal_theory').insert(insertPayload).select();
  if (error) throw new Error(error.message);

  return (data ?? []).map((item) => ({
    ...item,
    difficulty: normalizeDifficulty(item.difficulty),
    tags: Array.isArray(item.tags) ? item.tags : [],
  }));
}

export async function removePersonalTheoryEntry(userId, entryId) {
  const client = ensureSupabase();
  const { error } = await client
    .from('personal_theory')
    .delete()
    .eq('user_id', userId)
    .eq('id', entryId);

  if (error) throw new Error(error.message);
  return true;
}

export async function uploadKnowledgeAsset(file, path) {
  const client = ensureSupabase();
  const bucket = client.storage.from('knowledge');
  const targetPath = path ?? `${Date.now()}-${sanitizeFileName(file.name)}`;
  const { data, error } = await bucket.upload(targetPath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });

  if (error) throw new Error(error.message);
  const { data: publicUrl } = bucket.getPublicUrl(data.path);
  return {
    path: data.path,
    url: publicUrl?.publicUrl ?? null,
  };
}

export async function uploadPracticeImage(file, path) {
  const client = ensureSupabase();
  const bucket = client.storage.from('knowledge');
  const targetPath = path ?? `practice/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { data, error } = await bucket.upload(targetPath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });

  if (error) throw new Error(error.message);
  const { data: publicUrl } = bucket.getPublicUrl(data.path);
  return {
    path: data.path,
    url: publicUrl?.publicUrl ?? null,
  };
}

export async function fetchTasks(userId) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('tasks')
    .select('id, user_id, title, category, status, difficulty, due_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((task) => ({
    ...task,
    difficulty: normalizeDifficulty(task.difficulty),
  }));
}

export async function createTask(userId, payload) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('tasks')
    .insert({
      user_id: userId,
      title: payload.title,
      category: payload.category ?? '',
      status: payload.status ?? 'todo',
      difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
      due_date: payload.due_date ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
  };
}

export async function updateTaskStatus(userId, taskId, nextStatus) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('tasks')
    .update({ status: nextStatus })
    .eq('user_id', userId)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
  };
}

export async function deleteTask(userId, taskId) {
  const client = ensureSupabase();
  const { error } = await client
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .eq('id', taskId);

  if (error) throw new Error(error.message);
  return true;
}

export async function createCard(payload) {
  const client = ensureSupabase();
  const insertPayload = {
    category: payload.category,
    question: payload.question,
    answer: payload.answer,
    difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
  };
  const { data, error } = await client
    .from('training_cards')
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, difficulty: normalizeDifficulty(data.difficulty) };
}

export async function updateCard(id, payload) {
  const client = ensureSupabase();
  const updatePayload = {
    category: payload.category,
    question: payload.question,
    answer: payload.answer,
    difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
  };
  const { data, error } = await client
    .from('training_cards')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, difficulty: normalizeDifficulty(data.difficulty) };
}

export async function deleteCard(id) {
  const client = ensureSupabase();
  const { error } = await client.from('training_cards').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function createPracticeCase(payload) {
  const client = ensureSupabase();
  const id = payload.id?.trim() || generatePrefixedId('practice');
  const imagesFront = normalizeImageUrls(payload.images_front);
  const imagesBack = normalizeImageUrls(payload.images_back);
  const primaryImage = imagesFront[0] ?? normalizeImageUrls(payload.image_url)[0] ?? null;
  const logoUrl = payload.logo_url ?? null;
  const insertPayload = {
    id,
    title: payload.title,
    summary: payload.summary ?? null,
    prompt: payload.prompt,
    solution: payload.solution,
    points: payload.points ?? null,
    difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
    category: payload.category ?? 'Общая практика',
    mentor_comment: payload.mentor_comment ?? '',
  };
  if (practiceSupportsLogo !== false && payload.logo_url !== undefined) {
    insertPayload.logo_url = logoUrl;
  }
  if (practiceSupportsImage && primaryImage) {
    insertPayload.image_url = primaryImage;
  }
  let { data, error } = await client
    .from('practice_cases')
    .insert(insertPayload)
    .select()
    .single();
  if (error) {
    if (isPracticeImageError(error)) {
      practiceSupportsImage = false;
      delete insertPayload.image_url;
      const retry = await client.from('practice_cases').insert(insertPayload).select().single();
      if (retry.error) throw new Error(retry.error.message);
      data = retry.data;
    } else if (isPracticeLogoError(error)) {
      practiceSupportsLogo = false;
      delete insertPayload.logo_url;
      const retry = await client.from('practice_cases').insert(insertPayload).select().single();
      if (retry.error) throw new Error(retry.error.message);
      data = retry.data;
    } else {
      throw new Error(error.message);
    }
  }
  if (practiceImagesRelationAvailable !== false && (imagesFront.length > 0 || imagesBack.length > 0)) {
    await upsertPracticeImages(id, { front: imagesFront, back: imagesBack });
  }
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
    category: data.category ?? 'Общая практика',
    mentor_comment: data.mentor_comment ?? '',
    logo_url: practiceSupportsLogo === false ? null : data.logo_url ?? logoUrl ?? null,
    image_url: data.image_url ?? null,
    images_front: imagesFront.length ? imagesFront : primaryImage ? [primaryImage] : [],
    images_back: imagesBack,
  };
}

export async function updatePracticeCase(id, payload) {
  const client = ensureSupabase();
  const imagesFront = normalizeImageUrls(payload.images_front);
  const imagesBack = normalizeImageUrls(payload.images_back);
  const primaryImage = imagesFront[0] ?? normalizeImageUrls(payload.image_url)[0] ?? null;
  const logoUrl = payload.logo_url ?? null;
  const updatePayload = {
    title: payload.title,
    summary: payload.summary ?? null,
    prompt: payload.prompt,
    solution: payload.solution,
    points: payload.points ?? null,
    difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
    category: payload.category ?? 'Общая практика',
    mentor_comment: payload.mentor_comment ?? '',
  };
  if (practiceSupportsLogo !== false && payload.logo_url !== undefined) {
    updatePayload.logo_url = logoUrl;
  }
  if (practiceSupportsImage && payload.image_url !== undefined) {
    updatePayload.image_url = primaryImage ?? null;
  }
  let { data, error } = await client
    .from('practice_cases')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (isPracticeImageError(error)) {
      practiceSupportsImage = false;
      delete updatePayload.image_url;
      const retry = await client.from('practice_cases').update(updatePayload).eq('id', id).select().single();
      if (retry.error) throw new Error(retry.error.message);
      data = retry.data;
    } else if (isPracticeLogoError(error)) {
      practiceSupportsLogo = false;
      delete updatePayload.logo_url;
      const retry = await client.from('practice_cases').update(updatePayload).eq('id', id).select().single();
      if (retry.error) throw new Error(retry.error.message);
      data = retry.data;
    } else {
      throw new Error(error.message);
    }
  }
  const shouldSyncImages = payload.images_front !== undefined || payload.images_back !== undefined;
  if (shouldSyncImages) {
    await upsertPracticeImages(id, { front: imagesFront ?? [], back: imagesBack ?? [] });
  }
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
    category: data.category ?? 'Общая практика',
    mentor_comment: data.mentor_comment ?? '',
    logo_url: practiceSupportsLogo === false ? null : data.logo_url ?? logoUrl ?? null,
    image_url: data.image_url ?? null,
    images_front: imagesFront ?? (primaryImage ? [primaryImage] : []),
    images_back: imagesBack ?? [],
  };
}

const upsertPracticeImages = async (caseId, images = { front: [], back: [] }) => {
  const client = ensureSupabase();
  if (practiceImagesRelationAvailable === false) return;
  const frontUrls = normalizeImageUrls(images.front);
  const backUrls = normalizeImageUrls(images.back);
  try {
    await client.from('practice_case_images').delete().eq('case_id', caseId);
    const payload = [];
    frontUrls.forEach((url) => payload.push({ case_id: caseId, file_url: url, side: 'front' }));
    backUrls.forEach((url) => payload.push({ case_id: caseId, file_url: url, side: 'back' }));
    if (payload.length === 0) return;
    await client.from('practice_case_images').insert(payload);
    practiceImagesRelationAvailable = true;
  } catch (error) {
    if (isPracticeImagesRelationError(error)) {
      practiceImagesRelationAvailable = false;
      return;
    }
    throw error;
  }
};

export async function deletePracticeCase(id) {
  const client = ensureSupabase();
  const { error } = await client.from('practice_cases').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

const normalizeTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

export async function createKnowledgeResource(payload) {
  const client = ensureSupabase();
  const id = payload.id?.trim() || generatePrefixedId('kb');
  const insertPayload = {
    id,
    category: payload.category,
    title: payload.title,
    description: payload.description ?? '',
    type: payload.type,
    url: payload.url ?? null,
    content: payload.content ?? '',
    difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
    tags: normalizeTags(payload.tags),
  };
  const { data, error } = await client
    .from('knowledge_resources')
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
    tags: normalizeTags(data.tags),
  };
}

export async function updateKnowledgeResource(id, payload) {
  const client = ensureSupabase();
  const updatePayload = {
    category: payload.category,
    title: payload.title,
    description: payload.description ?? '',
    type: payload.type,
    url: payload.url ?? null,
    content: payload.content ?? '',
    difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
    tags: normalizeTags(payload.tags),
  };
  const { data, error } = await client
    .from('knowledge_resources')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
    tags: normalizeTags(data.tags),
  };
}

export async function deleteKnowledgeResource(id) {
  const client = ensureSupabase();
  const { error } = await client.from('knowledge_resources').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function createTheoryItem(payload) {
  const client = ensureSupabase();
  const insertPayload = {
    id: payload.id,
    title: payload.title,
    summary: payload.summary ?? '',
    content: payload.content ?? '',
  };
  const { data, error } = await client
    .from('theory')
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateTheoryItem(id, payload) {
  const client = ensureSupabase();
  const updatePayload = {
    title: payload.title,
    summary: payload.summary ?? '',
    content: payload.content ?? '',
  };
  const { data, error } = await client
    .from('theory')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTheoryItem(id) {
  const client = ensureSupabase();
  const { error } = await client.from('theory').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

const toNullableText = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeScheduleWritePayload = (payload = {}) => ({
  ...payload,
  title: typeof payload.title === 'string' ? payload.title.trim() : payload.title,
  status: payload.status ?? 'open',
  date: toNullableText(payload.date),
  start: toNullableText(payload.start),
  end: toNullableText(payload.end),
  format: toNullableText(payload.format),
  level: toNullableText(payload.level),
  direction: toNullableText(payload.direction),
  registration: toNullableText(payload.registration),
  logo_url: toNullableText(payload.logo_url),
  registration_url: toNullableText(payload.registration_url),
  registration_start: toNullableText(payload.registration_start),
  registration_end: toNullableText(payload.registration_end),
});

export async function createScheduleItem(payload) {
  const client = ensureSupabase();
  const normalizedPayload = normalizeScheduleWritePayload(payload);
  let insertPayload = {
    title: normalizedPayload.title,
    status: normalizedPayload.status,
    date: normalizedPayload.date ?? null,
    start: normalizedPayload.start ?? null,
    end: normalizedPayload.end ?? null,
    format: normalizedPayload.format ?? null,
    direction: normalizedPayload.level ?? normalizedPayload.direction ?? null,
    registration: normalizedPayload.registration ?? null,
    logo_url: normalizedPayload.logo_url ?? null,
    level: normalizedPayload.level ?? null,
    registration_url: normalizedPayload.registration_url ?? null,
    date_meta: normalizedPayload.date_meta ?? null,
    registration_start: normalizedPayload.registration_start ?? null,
    registration_end: normalizedPayload.registration_end ?? null,
  };
  if (scheduleSupportsLogo === false) {
    delete insertPayload.logo_url;
  }
  if (scheduleSupportsMeta === false) {
    delete insertPayload.level;
    delete insertPayload.registration_url;
    delete insertPayload.date_meta;
    delete insertPayload.registration_start;
    delete insertPayload.registration_end;
  }
  const attempt = async (body) =>
    client
      .from('schedule')
      .insert(body)
      .select()
      .single();

  let { data, error } = await attempt(insertPayload);
  if (error && isScheduleMetaError(error)) {
    scheduleSupportsMeta = false;
    delete insertPayload.level;
    delete insertPayload.registration_url;
    delete insertPayload.date_meta;
    delete insertPayload.registration_start;
    delete insertPayload.registration_end;
    ({ data, error } = await attempt(insertPayload));
  }
  if (error && isLogoColumnError(error)) {
    scheduleSupportsLogo = false;
    delete insertPayload.logo_url;
    ({ data, error } = await attempt(insertPayload));
  }
  if (error) throw new Error(error.message);
  scheduleSupportsLogo = scheduleSupportsLogo !== false;
  scheduleSupportsMeta = scheduleSupportsMeta !== false;
  return data;
}

export async function updateScheduleItem(id, payload) {
  const client = ensureSupabase();
  const normalizedPayload = normalizeScheduleWritePayload(payload);
  let updatePayload = {
    title: normalizedPayload.title,
    status: normalizedPayload.status,
    date: normalizedPayload.date ?? null,
    start: normalizedPayload.start ?? null,
    end: normalizedPayload.end ?? null,
    format: normalizedPayload.format ?? null,
    direction: normalizedPayload.level ?? normalizedPayload.direction ?? null,
    registration: normalizedPayload.registration ?? null,
    logo_url: normalizedPayload.logo_url ?? null,
    level: normalizedPayload.level ?? null,
    registration_url: normalizedPayload.registration_url ?? null,
    date_meta: normalizedPayload.date_meta ?? null,
    registration_start: normalizedPayload.registration_start ?? null,
    registration_end: normalizedPayload.registration_end ?? null,
  };
  if (scheduleSupportsLogo === false) {
    delete updatePayload.logo_url;
  }
  if (scheduleSupportsMeta === false) {
    delete updatePayload.level;
    delete updatePayload.registration_url;
    delete updatePayload.date_meta;
    delete updatePayload.registration_start;
    delete updatePayload.registration_end;
  }

  const attempt = async (body) =>
    client
      .from('schedule')
      .update(body)
      .eq('id', id)
      .select()
      .single();

  let { data, error } = await attempt(updatePayload);

  if (error && isScheduleMetaError(error)) {
    scheduleSupportsMeta = false;
    delete updatePayload.level;
    delete updatePayload.registration_url;
    delete updatePayload.date_meta;
    delete updatePayload.registration_start;
    delete updatePayload.registration_end;
    ({ data, error } = await attempt(updatePayload));
  }

  if (error && isLogoColumnError(error)) {
    scheduleSupportsLogo = false;
    delete updatePayload.logo_url;
    ({ data, error } = await attempt(updatePayload));
  }

  if (error) throw new Error(error.message);
  scheduleSupportsLogo = scheduleSupportsLogo !== false;
  scheduleSupportsMeta = scheduleSupportsMeta !== false;
  return data;
}

export async function deleteScheduleItem(id) {
  const client = ensureSupabase();
  const { error } = await client.from('schedule').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function fetchProfileByCode(code) {
  const client = ensureSupabase();
  const normalized = code.trim().toUpperCase();
  const { data, error } = await client
    .from('profiles')
    .select('id, name, code, is_admin, is_owner')
    .eq('code', normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function adminListProfiles(adminCode) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { data, error } = await client.rpc('admin_list_profiles', { admin_code: normalized });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminCreateProfile(adminCode, payload) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const hasAdminFlag = payload?.is_admin === true || payload?.is_admin === false;
  const { data, error } = await client.rpc('admin_create_profile', {
    admin_code: normalized,
    p_name: payload.name,
    p_code: normalizeCode(payload.code),
    p_is_admin: hasAdminFlag ? Boolean(payload.is_admin) : null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminUpdateProfile(adminCode, profileId, payload) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { data, error } = await client.rpc('admin_update_profile', {
    admin_code: normalized,
    p_profile_id: profileId,
    p_name: payload?.name ?? null,
    p_is_admin: payload?.is_admin ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminDeleteProfile(adminCode, profileId) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { error } = await client.rpc('admin_delete_profile', {
    admin_code: normalized,
    p_profile_id: profileId,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function adminListAccessCodes(adminCode) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { data, error } = await client.rpc('admin_list_access_codes', { admin_code: normalized });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminCreateAccessCode(adminCode, payload) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { data, error } = await client.rpc('admin_create_access_code', {
    admin_code: normalized,
    p_code: normalizeCode(payload.code),
    p_owner_name: payload.owner_name ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminDeleteAccessCode(adminCode, accessCodeId) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { error } = await client.rpc('admin_delete_access_code', {
    admin_code: normalized,
    p_code_id: accessCodeId,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function adminAssignAccessCode(adminCode, payload) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { data, error } = await client.rpc('admin_assign_access_code', {
    admin_code: normalized,
    p_code_id: payload.code_id,
    p_profile_id: payload.profile_id,
    p_owner_name: payload.owner_name ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminListAccessRequests(adminCode) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { data, error } = await client.rpc('admin_list_access_requests', { admin_code: normalized });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminApproveAccessRequest(adminCode, requestId) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { data, error } = await client.rpc('admin_approve_access_request', {
    admin_code: normalized,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminFetchProgress(adminCode, targetCode) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const target = normalizeCode(targetCode);
  const { data, error } = await client.rpc('admin_fetch_progress', {
    admin_code: normalized,
    p_code: target,
  });
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function adminResetProgress(adminCode, targetCode) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const target = normalizeCode(targetCode);
  const { error } = await client.rpc('admin_reset_progress', {
    admin_code: normalized,
    p_code: target,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function adminListTasks(adminCode, targetCode) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const target = normalizeCode(targetCode);
  const { data, error } = await client.rpc('admin_list_tasks', {
    admin_code: normalized,
    p_code: target,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((task) => ({
    ...task,
    difficulty: normalizeDifficulty(task.difficulty),
  }));
}

export async function adminCreateTask(adminCode, targetCode, payload) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const target = normalizeCode(targetCode);
  const { data, error } = await client.rpc('admin_create_task', {
    admin_code: normalized,
    p_code: target,
    p_title: payload.title,
    p_category: payload.category ?? null,
    p_status: payload.status ?? 'todo',
    p_difficulty: payload.difficulty ?? 'medium',
    p_due_date: payload.due_date ?? null,
  });
  if (error) throw new Error(error.message);
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
  };
}

export async function adminUpdateTaskStatus(adminCode, targetCode, taskId, nextStatus) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const target = normalizeCode(targetCode);
  const { data, error } = await client.rpc('admin_update_task_status', {
    admin_code: normalized,
    p_code: target,
    p_task_id: taskId,
    p_status: nextStatus,
  });
  if (error) throw new Error(error.message);
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
  };
}

export async function adminDeleteTask(adminCode, targetCode, taskId) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const target = normalizeCode(targetCode);
  const { error } = await client.rpc('admin_delete_task', {
    admin_code: normalized,
    p_code: target,
    p_task_id: taskId,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function adminUpsertKnowledgeResource(adminCode, payload) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const resolvedId = payload.id?.trim() || generatePrefixedId('kb');
  // Порядок ключей соответствует актуальной сигнатуре в PostgREST
  const rpcPayload = {
    admin_code: normalized,
    p_category: payload.category,
    p_content: payload.content ?? null,
    p_description: payload.description ?? null,
    p_difficulty: payload.difficulty ?? 'medium',
    p_id: resolvedId,
    p_tags: Array.isArray(payload.tags) ? payload.tags : normalizeTags(payload.tags),
    p_title: payload.title,
    p_type: payload.type,
    p_url: payload.url ?? null,
  };

  let data;
  let error;

  ({ data, error } = await client.rpc('admin_upsert_knowledge_resource', rpcPayload));

  // Фолбэк: если функция не найдена в кэше PostgREST, пробуем прямой upsert (при наличии RLS-политики на запись).
  if (error && isRpcMissing(error, 'admin_upsert_knowledge_resource')) {
    const upsertPayload = {
      id: resolvedId,
      category: payload.category,
      title: payload.title,
      description: payload.description ?? '',
      type: payload.type,
      url: payload.url ?? null,
      content: payload.content ?? '',
      difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
      tags: Array.isArray(payload.tags) ? payload.tags : normalizeTags(payload.tags),
    };
    ({ data, error } = await client
      .from('knowledge_resources')
      .upsert(upsertPayload, { onConflict: 'id' })
      .select()
      .single());

    if (error?.code === '42501') {
      throw new Error(
        'Недостаточно прав для записи в knowledge_resources. Добавьте политику записи (knowledge_write) или обновите кэш PostgREST для RPC.',
      );
    }
  }

  if (error) throw new Error(error.message);
  return {
    ...data,
    difficulty: normalizeDifficulty(data.difficulty),
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}

export async function adminDeleteKnowledgeResource(adminCode, resourceId) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { error } = await client.rpc('admin_delete_knowledge_resource', {
    admin_code: normalized,
    p_id: resourceId,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function adminUpsertTheory(adminCode, payload) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { data, error } = await client.rpc('admin_upsert_theory', {
    admin_code: normalized,
    p_id: payload.id,
    p_title: payload.title,
    p_summary: payload.summary ?? null,
    p_content: payload.content ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminDeleteTheory(adminCode, theoryId) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const { error } = await client.rpc('admin_delete_theory', {
    admin_code: normalized,
    p_id: theoryId,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function adminUpsertSchedule(adminCode, payload) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  const attempt = async (body) => client.rpc('admin_upsert_schedule', body);
  const normalizedPayload = normalizeScheduleWritePayload(payload);

  let requestPayload = {
    admin_code: normalized,
    p_id: normalizedPayload.id ?? null,
    p_title: normalizedPayload.title,
    p_status: normalizedPayload.status,
    p_date: normalizedPayload.date ?? null,
    p_start: normalizedPayload.start ?? null,
    p_end: normalizedPayload.end ?? null,
    p_format: normalizedPayload.format ?? null,
    p_direction: normalizedPayload.direction ?? normalizedPayload.level ?? null,
    p_registration: normalizedPayload.registration ?? null,
    p_logo_url: normalizedPayload.logo_url ?? null,
    p_level: normalizedPayload.level ?? null,
    p_registration_url: normalizedPayload.registration_url ?? null,
    p_date_meta: normalizedPayload.date_meta ?? null,
    p_registration_start: normalizedPayload.registration_start ?? null,
    p_registration_end: normalizedPayload.registration_end ?? null,
  };

  if (scheduleSupportsLogo === false) {
    delete requestPayload.p_logo_url;
  }
  if (scheduleSupportsMeta === false) {
    delete requestPayload.p_level;
    delete requestPayload.p_registration_url;
    delete requestPayload.p_date_meta;
    delete requestPayload.p_registration_start;
    delete requestPayload.p_registration_end;
  }

  const shouldTryRpc = scheduleAdminRpcAvailable !== false;
  let data = null;
  let error = null;

  if (shouldTryRpc) {
    ({ data, error } = await attempt(requestPayload));
  }

  if (error && isScheduleMetaError(error)) {
    scheduleSupportsMeta = false;
    delete requestPayload.p_level;
    delete requestPayload.p_registration_url;
    delete requestPayload.p_date_meta;
    delete requestPayload.p_registration_start;
    delete requestPayload.p_registration_end;
    ({ data, error } = await attempt(requestPayload));
  }

  if (error && isLogoColumnError(error)) {
    scheduleSupportsLogo = false;
    requestPayload = {
      admin_code: normalized,
      p_id: normalizedPayload.id ?? null,
      p_title: normalizedPayload.title,
      p_status: normalizedPayload.status,
      p_date: normalizedPayload.date ?? null,
      p_start: normalizedPayload.start ?? null,
      p_end: normalizedPayload.end ?? null,
      p_format: normalizedPayload.format ?? null,
      p_direction: normalizedPayload.direction ?? normalizedPayload.level ?? null,
      p_registration: normalizedPayload.registration ?? null,
    };
    if (scheduleSupportsMeta !== false) {
      requestPayload.p_level = normalizedPayload.level ?? null;
      requestPayload.p_registration_url = normalizedPayload.registration_url ?? null;
      requestPayload.p_date_meta = normalizedPayload.date_meta ?? null;
      requestPayload.p_registration_start = normalizedPayload.registration_start ?? null;
      requestPayload.p_registration_end = normalizedPayload.registration_end ?? null;
    }
    ({ data, error } = await attempt(requestPayload));
  }

  if (error) {
    if (isRpcMissing(error, 'admin_upsert_schedule')) {
      scheduleAdminRpcAvailable = false;
      error = null;
    } else {
      throw new Error(error.message);
    }
  }

  if (!data) {
    try {
      if (normalizedPayload.id) {
        return await updateScheduleItem(normalizedPayload.id, normalizedPayload);
      }
      return await createScheduleItem(normalizedPayload);
    } catch (fallbackError) {
      throw new Error(fallbackError instanceof Error ? fallbackError.message : 'Не удалось сохранить мероприятие.');
    }
  }

  scheduleSupportsLogo = scheduleSupportsLogo !== false;
  scheduleSupportsMeta = scheduleSupportsMeta !== false;
  return data;
}

export async function adminDeleteSchedule(adminCode, scheduleId) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);
  if (scheduleAdminRpcAvailable !== false) {
    const { error } = await client.rpc('admin_delete_schedule', {
      admin_code: normalized,
      p_id: scheduleId,
    });
    if (!error) return true;
    if (!isRpcMissing(error, 'admin_delete_schedule')) {
      throw new Error(error.message);
    }
    scheduleAdminRpcAvailable = false;
  }

  await deleteScheduleItem(scheduleId);
  return true;
}

export async function uploadHomeworkAsset(file, path) {
  const client = ensureSupabase();
  const bucket = client.storage.from('homework');
  const targetPath = path ?? `${Date.now()}-${sanitizeFileName(file.name)}`;
  const { data, error } = await bucket.upload(targetPath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });

  if (error) throw new Error(error.message);
  const { data: publicUrl } = bucket.getPublicUrl(data.path);
  return {
    path: data.path,
    url: publicUrl?.publicUrl ?? null,
    type: file.type,
    name: file.name,
    size: file.size,
  };
}

let homeworkRecipientsSupported = undefined;

const mapHomeworkAssignment = (assignment) => ({
  id: assignment.id,
  title: assignment.title,
  description: assignment.description ?? '',
  difficulty: normalizeDifficulty(assignment.difficulty ?? 'medium'),
  due_date: assignment.due_date ?? null,
  created_at: assignment.created_at,
  updated_at: assignment.updated_at,
  links: Array.isArray(assignment.links) ? assignment.links : [],
  files: Array.isArray(assignment.files) ? assignment.files : [],
  assign_to: assignment.assign_to === 'all' || assignment.assign_to === 'selected' ? assignment.assign_to : 'selected',
  target_profiles: (() => {
    const source =
      assignment.target_profile_ids ??
      assignment.target_profiles ??
      [];
    if (!Array.isArray(source)) return [];
    return source
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          return entry.id ?? entry.profile_id ?? null;
        }
        return entry;
      })
      .filter(Boolean);
  })(),
});

const mapHomeworkSubmission = (submission) => ({
  id: submission.id,
  homework_id: submission.homework_id,
  user_id: submission.user_id,
  status: normalizeHomeworkSubmissionStatus(submission.status),
  student_note: submission.student_note ?? '',
  reviewer_note: submission.reviewer_note ?? '',
  updated_at: submission.updated_at,
  created_at: submission.created_at,
  files: Array.isArray(submission.files) ? submission.files : [],
  user: submission.user ?? null,
});

const isHomeworkTargetColumnError = (error) => {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('assign_to') || message.includes('target_profile_ids');
};

const isHomeworkRecipientsError = (error) =>
  Boolean(error?.message) && error.message.toLowerCase().includes('homework_recipients');

const isRpcMissing = (error, fnName) => {
  const code = String(error?.code ?? error?.status ?? '').toLowerCase();
  const message = String(error?.message ?? '').toLowerCase();
  if (!fnName && !message) return false;
  if (code === '404' || code === 'pgrst202') return true;
  if (message.includes('rpc disabled')) return true;
  if (message.includes('could not find the function') && message.includes('schema cache')) return true;
  // Частый случай: RPC существует, но внутри него используется отсутствующая функция-охранник.
  if (message.includes('assert_admin') && message.includes('does not exist')) return true;
  // RPC может быть в схеме, но ломаться из-за рассинхрона колонок.
  if (message.includes('relation "schedule"') && message.includes('column "finish"') && message.includes('does not exist')) {
    return true;
  }
  if (fnName && message.includes(fnName.toLowerCase())) {
    if (
      message.includes('not exist') ||
      message.includes('does not exist') ||
      message.includes('not found') ||
      message.includes('could not find') ||
      message.includes('missing')
    ) {
      return true;
    }
  }
  return false;
};

const isPracticeImageError = (error) => Boolean(error?.message) && error.message.toLowerCase().includes('image_url');
const isPracticeImagesRelationError = (error) =>
  Boolean(error?.message) && error.message.toLowerCase().includes('practice_case_images');
const isPracticeLogoError = (error) => Boolean(error?.message) && error.message.toLowerCase().includes('logo_url');
const isTableMissing = (error) => Boolean(error?.message) && error.message.toLowerCase().includes('does not exist');

export async function fetchHomeworkAssignments() {
  const client = ensureSupabase();
  const baseSelect = `
        id,
        title,
        description,
        difficulty,
        due_date,
        created_at,
        updated_at,
        links:homework_links(id, resource_type, reference_id, created_at),
        files:homework_files(id, title, description, file_url, file_type, created_at)
      `;
  const selectWithTargets = `${baseSelect}, assign_to, target_profile_ids`;

  const fetchAssignments = async (query) =>
    client
      .from('homework_assignments')
      .select(query)
      .order('created_at', { ascending: false });

  const shouldIncludeTargets = homeworkSupportsTargets !== false;
  let query = shouldIncludeTargets ? selectWithTargets : baseSelect;

  let { data, error } = await fetchAssignments(query);
  if (error && isHomeworkTargetColumnError(error)) {
    homeworkSupportsTargets = false;
    query = baseSelect;
    ({ data, error } = await fetchAssignments(query));
  }

  if (!error && homeworkSupportsTargets === undefined && query === selectWithTargets) {
    homeworkSupportsTargets = true;
  }

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapHomeworkAssignment);
}

export async function fetchHomeworkSubmissionsForUser(userId) {
  if (!userId) return [];
  const client = ensureSupabase();
  const rpcName = 'student_list_homework_submissions';
  let data;
  let error = null;

  if (studentHomeworkRpcAvailable !== false) {
    ({ data, error } = await client.rpc(rpcName, { p_profile_id: userId }));
  }

  if (error || studentHomeworkRpcAvailable === false) {
    studentHomeworkRpcAvailable = false;
    ({ data, error } = await client
      .from('homework_submissions')
      .select(
        `
          id,
          homework_id,
          user_id,
          status,
          student_note,
          reviewer_note,
          updated_at,
          created_at,
          files:homework_submission_files(id, role, file_url, file_type, note, created_at)
        `,
      )
      .eq('user_id', userId));
  }

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapHomeworkSubmission);
}

export async function ensureHomeworkSubmission(userId, homeworkId) {
  if (!userId || !homeworkId) return null;
  const client = ensureSupabase();
  const rpcName = 'student_upsert_homework_submission';
  const rpcCall = () =>
    client
      .rpc(rpcName, {
        p_profile_id: userId,
        p_homework_id: homeworkId,
      })
      .single();

  let data;
  let error = null;
  if (studentHomeworkRpcAvailable !== false) {
    ({ data, error } = await rpcCall());
  }

  if (error || studentHomeworkRpcAvailable === false) {
    studentHomeworkRpcAvailable = false;
    const selectQuery = `
          id,
          homework_id,
          user_id,
          status,
          student_note,
          reviewer_note,
          updated_at,
          created_at,
          files:homework_submission_files(id, role, file_url, file_type, note, created_at)
        `;

    const { data: existing, error: existingError } = await client
      .from('homework_submissions')
      .select(selectQuery)
      .eq('homework_id', homeworkId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing) {
      data = existing;
      error = null;
    } else {
      const attemptInsert = (body) =>
        client.from('homework_submissions').insert(body).select(selectQuery).single();

      let insertPayload = { homework_id: homeworkId, user_id: userId };
      let { data: inserted, error: insertError } = await attemptInsert(insertPayload);

      if (insertError && isHomeworkStatusConstraintError(insertError)) {
        insertError = null;
        for (const candidateStatus of homeworkStatusCandidates('assigned')) {
          const candidatePayload = { ...insertPayload, status: candidateStatus };
          const retry = await attemptInsert(candidatePayload);
          if (!retry.error) {
            inserted = retry.data;
            learnHomeworkStatusDialect('assigned', candidateStatus);
            break;
          }
          if (!isHomeworkStatusConstraintError(retry.error)) {
            throw new Error(retry.error.message);
          }
        }
        if (!inserted) {
          throw new Error(
            'Не удалось создать отправку: статус в базе данных не поддерживает значения приложения. Обновите constraint статуса.',
          );
        }
      }

      if (insertError) {
        const code = String(insertError.code ?? '').toLowerCase();
        const message = String(insertError.message ?? '').toLowerCase();
        const isDuplicate = code === '23505' || message.includes('duplicate key') || message.includes('unique');
        if (isDuplicate) {
          const { data: retryExisting, error: retryExistingError } = await client
            .from('homework_submissions')
            .select(selectQuery)
            .eq('homework_id', homeworkId)
            .eq('user_id', userId)
            .maybeSingle();
          if (retryExistingError) throw new Error(retryExistingError.message);
          inserted = retryExisting;
        } else {
          throw new Error(insertError.message);
        }
      }

      data = inserted;
      error = null;
    }
  }

  if (error) throw new Error(error.message);
  return data ? mapHomeworkSubmission(data) : null;
}

export async function addHomeworkSubmissionFile(submissionId, payload, options = {}) {
  const client = ensureSupabase();
  const { profileId, adminCode } = options;
  const rpcName = profileId ? 'student_add_submission_file' : 'admin_add_submission_file';
  const role = payload.role ?? 'student';
  const uploadedBy = payload.uploaded_by ?? profileId ?? null;
  let data;
  let error = null;

  const shouldTryRpc =
    Boolean(profileId || adminCode) &&
    ((profileId && studentHomeworkRpcAvailable !== false) || (adminCode && adminHomeworkRpcAvailable !== false));

  if (shouldTryRpc) {
    ({ data, error } = await client
      .rpc(rpcName, {
        p_submission_id: submissionId,
        p_profile_id: profileId ?? null,
        p_admin_code: adminCode ?? null,
        p_file_url: payload.file_url,
        p_file_type: payload.file_type ?? 'file',
        p_note: payload.note ?? '',
        p_uploaded_by: uploadedBy,
        p_role: role,
      })
      .single());
  }

  if (error) {
    if (isRpcMissing(error, rpcName)) {
      if (profileId) studentHomeworkRpcAvailable = false;
      if (adminCode) adminHomeworkRpcAvailable = false;
      error = null;
    } else {
      throw new Error(error.message);
    }
  }

  if (!data) {
    const insertPayload = {
      submission_id: submissionId,
      uploaded_by: uploadedBy,
      role,
      file_url: payload.file_url,
      file_type: payload.file_type ?? 'file',
      note: payload.note ?? '',
    };
    ({ data, error } = await client
      .from('homework_submission_files')
      .insert(insertPayload)
      .select()
      .single());
  }

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteHomeworkSubmissionFile(fileId, options = {}) {
  const client = ensureSupabase();
  const { profileId, adminCode } = options;
  const rpcName = profileId ? 'student_delete_submission_file' : 'admin_delete_submission_file';

  const shouldTryRpc =
    Boolean(profileId || adminCode) &&
    ((profileId && studentHomeworkRpcAvailable !== false) || (adminCode && adminHomeworkRpcAvailable !== false));

  if (shouldTryRpc) {
    const { error } = await client.rpc(rpcName, {
      p_file_id: fileId,
      p_profile_id: profileId ?? null,
      p_admin_code: adminCode ?? null,
    });
    if (!error) return true;
    if (error && !isRpcMissing(error, rpcName)) {
      throw new Error(error.message);
    }
  }

  let query = client.from('homework_submission_files').delete().eq('id', fileId);
  if (profileId) {
    query = query.eq('uploaded_by', profileId);
  }
  const { error: fallbackError } = await query;
  if (fallbackError) throw new Error(fallbackError.message);
  return true;
}

export async function updateHomeworkSubmission(submissionId, payload, options = {}) {
  const client = ensureSupabase();
  const { profileId, adminCode } = options;
  const rpcName = profileId ? 'student_update_homework_submission' : 'admin_update_homework_submission';
  const requestedStatus = payload.status;
  const statusCandidates =
    requestedStatus === undefined || requestedStatus === null
      ? [null]
      : homeworkStatusCandidates(requestedStatus);

  const selectQuery = `
        id,
        homework_id,
        user_id,
        status,
        student_note,
        reviewer_note,
        updated_at,
        created_at,
        files:homework_submission_files(id, role, file_url, file_type, note, created_at)
      `;

  const baseUpdatePayload = {};
  if (payload.student_note !== undefined) baseUpdatePayload.student_note = payload.student_note;
  if (payload.reviewer_note !== undefined) baseUpdatePayload.reviewer_note = payload.reviewer_note;

  const shouldTryRpc =
    Boolean(profileId || adminCode) &&
    ((profileId && studentHomeworkRpcAvailable !== false) || (adminCode && adminHomeworkRpcAvailable !== false));

  for (const candidateStatus of statusCandidates) {
    let data = null;
    let error = null;

    if (shouldTryRpc) {
      ({ data, error } = await client
        .rpc(rpcName, {
          p_submission_id: submissionId,
          p_profile_id: profileId ?? null,
          p_admin_code: adminCode ?? null,
          p_status: candidateStatus ?? null,
          p_student_note: payload.student_note ?? null,
          p_reviewer_note: payload.reviewer_note ?? null,
        })
        .single());
    }

    if (error) {
      if (isRpcMissing(error, rpcName)) {
        if (profileId) studentHomeworkRpcAvailable = false;
        if (adminCode) adminHomeworkRpcAvailable = false;
        error = null;
      } else if (isHomeworkStatusConstraintError(error)) {
        continue;
      } else {
        throw new Error(error.message);
      }
    }

    if (data) {
      const canonical = String(requestedStatus ?? '').toLowerCase();
      if (candidateStatus && HOMEWORK_STATUS_SET.has(canonical)) {
        learnHomeworkStatusDialect(canonical, candidateStatus);
      }
      return mapHomeworkSubmission(data);
    }

    const updatePayload = { ...baseUpdatePayload };
    if (requestedStatus !== undefined && requestedStatus !== null) {
      updatePayload.status = candidateStatus;
    }

    const fallback = await client.from('homework_submissions').update(updatePayload).eq('id', submissionId).select(selectQuery).single();

    if (fallback.error) {
      if (isHomeworkStatusConstraintError(fallback.error)) {
        continue;
      }
      throw new Error(fallback.error.message);
    }

    const canonical = String(requestedStatus ?? '').toLowerCase();
    if (candidateStatus && HOMEWORK_STATUS_SET.has(canonical)) {
      learnHomeworkStatusDialect(canonical, candidateStatus);
    }
    return mapHomeworkSubmission(fallback.data);
  }

  throw new Error(
    'Статус не поддерживается базой данных (check constraint для homework_submissions.status). Обновите список допустимых статусов.',
  );
}

export async function fetchHomeworkRecipients(adminCode, reviewerId = null) {
  ensureAdminCode(adminCode);
  const client = ensureSupabase();
  let query = client.from('homework_recipients').select('reviewer_id, student_id');
  if (reviewerId) {
    query = query.eq('reviewer_id', reviewerId);
  }

  const { data, error } = await query;
  if (error) {
    if (isHomeworkRecipientsError(error)) {
      homeworkRecipientsSupported = false;
      return { rules: [], supported: false };
    }
    return { rules: [], supported: false };
  }

  homeworkRecipientsSupported = true;
  return { rules: data ?? [], supported: true };
}

export async function saveHomeworkRecipients(adminCode, reviewerId, studentIds = []) {
  ensureAdminCode(adminCode);
  const client = ensureSupabase();
  if (!reviewerId) {
    throw new Error('Не указан куратор.');
  }
  if (homeworkRecipientsSupported === false) {
    return { rules: [], supported: false };
  }

  const ids = Array.isArray(studentIds) ? studentIds : [];

  const deleteResult = await client.from('homework_recipients').delete().eq('reviewer_id', reviewerId);
  if (deleteResult.error) {
    if (isHomeworkRecipientsError(deleteResult.error)) {
      homeworkRecipientsSupported = false;
      return { rules: [], supported: false };
    }
    return { rules: [], supported: false };
  }

  if (ids.length > 0) {
    // Обеспечиваем эксклюзивное закрепление ученика за куратором: очищаем чужие связи для выбранных студентов.
    const { error: deleteOthersError } = await client
      .from('homework_recipients')
      .delete()
      .in('student_id', ids)
      .neq('reviewer_id', reviewerId);
    if (deleteOthersError) {
      if (isHomeworkRecipientsError(deleteOthersError)) {
        homeworkRecipientsSupported = false;
        return { rules: [], supported: false };
      }
      return { rules: [], supported: false };
    }

    const payload = ids.map((studentId) => ({
      reviewer_id: reviewerId,
      student_id: studentId,
    }));
    const { error: insertError } = await client.from('homework_recipients').insert(payload);
    if (insertError) {
      if (isHomeworkRecipientsError(insertError)) {
        homeworkRecipientsSupported = false;
        return { rules: [], supported: false };
      }
      return { rules: [], supported: false };
    }
  }

  homeworkRecipientsSupported = true;
  return { rules: ids.map((studentId) => ({ reviewer_id: reviewerId, student_id: studentId })), supported: true };
}

export async function adminFetchHomework(adminCode) {
  const client = ensureSupabase();
  const normalized = ensureAdminCode(adminCode);

  const baseSelect = `
        id,
        title,
        description,
        difficulty,
        due_date,
        created_at,
        updated_at,
        created_by,
        links:homework_links(id, resource_type, reference_id, created_at),
        files:homework_files(id, title, description, file_url, file_type, created_at)
      `;
  const selectWithTargets = `${baseSelect}, assign_to, target_profile_ids`;

  const fetchAssignments = async (query) =>
    client
      .from('homework_assignments')
      .select(query)
      .order('created_at', { ascending: false });

  const assignmentsPromise = (async () => {
    const shouldIncludeTargets = homeworkSupportsTargets !== false;
    let query = shouldIncludeTargets ? selectWithTargets : baseSelect;
    let result = await fetchAssignments(query);

    if (result.error && isHomeworkTargetColumnError(result.error)) {
      homeworkSupportsTargets = false;
      query = baseSelect;
      result = await fetchAssignments(query);
    }

    if (!result.error && homeworkSupportsTargets === undefined && query === selectWithTargets) {
      homeworkSupportsTargets = true;
    }

    return result;
  })();

  const submissionsPromise = (async () => {
    let data;
    let error = null;
    if (adminHomeworkRpcAvailable === false) {
      const { data: fallbackData, error: fallbackError } = await client
        .from('homework_submissions')
        .select(
          `
            id,
            homework_id,
            user_id,
            status,
            student_note,
            reviewer_note,
            updated_at,
            created_at,
            files:homework_submission_files(id, role, file_url, file_type, note, created_at),
            user:profiles(id, name, code)
          `,
        );
      if (fallbackError) throw new Error(fallbackError.message);
      return { data: fallbackData, error: null };
    }

    ({ data, error } = await client.rpc('admin_list_homework_submissions', { p_admin_code: normalized }));

    if (error) {
      adminHomeworkRpcAvailable = false;
      const { data: fallbackData, error: fallbackError } = await client
        .from('homework_submissions')
        .select(
          `
            id,
            homework_id,
            user_id,
            status,
            student_note,
            reviewer_note,
            updated_at,
            created_at,
            files:homework_submission_files(id, role, file_url, file_type, note, created_at),
            user:profiles(id, name, code)
          `,
        );
      if (fallbackError) throw new Error(fallbackError.message);
      return { data: fallbackData, error: null };
    }

    return { data, error: null };
  })();

  const [{ data: assignmentsData, error: assignmentsError }, { data: submissionsData, error: submissionsError }] =
    await Promise.all([assignmentsPromise, submissionsPromise]);

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }
  if (submissionsError) throw new Error(submissionsError.message);

  if (assignmentsData?.length) {
    if (Object.prototype.hasOwnProperty.call(assignmentsData[0], 'assign_to')) {
      homeworkSupportsTargets = true;
    } else if (homeworkSupportsTargets === undefined) {
      homeworkSupportsTargets = false;
    }
  }

  return {
    assignments: (assignmentsData ?? []).map(mapHomeworkAssignment),
    submissions: (submissionsData ?? []).map(mapHomeworkSubmission),
    supportsTargets: homeworkSupportsTargets !== false,
  };
}

export async function adminCreateHomework(adminCode, payload, createdBy) {
  const client = ensureSupabase();
  ensureAdminCode(adminCode);
  const buildPayload = (includeTargets) => {
    const base = {
      title: payload.title,
      description: payload.description ?? '',
      difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
      due_date: payload.due_date ?? null,
      created_by: createdBy ?? null,
    };
    if (includeTargets) {
      base.assign_to = payload.assignTo === 'all' || payload.assignTo === 'selected' ? payload.assignTo : 'selected';
      base.target_profile_ids =
        payload.assignTo === 'selected' && Array.isArray(payload.targetProfileIds)
          ? payload.targetProfileIds
          : [];
    }
    return base;
  };

  const attempt = async (body) =>
    client
      .from('homework_assignments')
      .insert(body)
      .select('*')
      .single();

  const initialPayload = buildPayload(homeworkSupportsTargets !== false);
  let { data, error } = await attempt(initialPayload);
  if (error && isHomeworkTargetColumnError(error)) {
    homeworkSupportsTargets = false;
    ({ data, error } = await attempt(buildPayload(false)));
  }

  if (error) throw new Error(error.message);

  homeworkSupportsTargets = homeworkSupportsTargets !== false;

  const assignment = mapHomeworkAssignment(data);

  if (Array.isArray(payload.links) && payload.links.length > 0) {
    const linksPayload = payload.links.map((link) => ({
      homework_id: assignment.id,
      resource_type: link.resource_type,
      reference_id: link.reference_id,
    }));
    const { error: linksError } = await client.from('homework_links').insert(linksPayload);
    if (linksError) throw new Error(linksError.message);
  }

  if (Array.isArray(payload.files) && payload.files.length > 0) {
    const filesPayload = payload.files.map((file) => ({
      homework_id: assignment.id,
      title: file.title ?? null,
      description: file.description ?? null,
      file_url: file.file_url,
      file_type: file.file_type ?? 'file',
    }));
    const { error: filesError } = await client.from('homework_files').insert(filesPayload);
    if (filesError) throw new Error(filesError.message);
  }

  return assignment;
}

export async function adminUpdateHomework(adminCode, assignmentId, payload) {
  const client = ensureSupabase();
  ensureAdminCode(adminCode);
  let updatePayload = {
    title: payload.title,
    description: payload.description ?? '',
    difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
    due_date: payload.due_date ?? null,
    assign_to: payload.assignTo === 'all' || payload.assignTo === 'selected' ? payload.assignTo : 'selected',
    target_profile_ids:
      payload.assignTo === 'selected' && Array.isArray(payload.targetProfileIds)
        ? payload.targetProfileIds
        : [],
  };

  const attempt = async (body) =>
    client
      .from('homework_assignments')
      .update(body)
      .eq('id', assignmentId)
      .select('*')
      .single();

  if (homeworkSupportsTargets === false) {
    delete updatePayload.assign_to;
    delete updatePayload.target_profile_ids;
  }

  let { data, error } = await attempt(updatePayload);
  if (error && isHomeworkTargetColumnError(error)) {
    homeworkSupportsTargets = false;
    const fallbackPayload = {
      title: payload.title,
      description: payload.description ?? '',
      difficulty: normalizeDifficulty(payload.difficulty ?? 'medium'),
      due_date: payload.due_date ?? null,
    };
    ({ data, error } = await attempt(fallbackPayload));
  }

  if (error) throw new Error(error.message);

  homeworkSupportsTargets = homeworkSupportsTargets !== false;

  if (payload.replaceLinks) {
    const { error: delLinks } = await client.from('homework_links').delete().eq('homework_id', assignmentId);
    if (delLinks) throw new Error(delLinks.message);
    if (Array.isArray(payload.links) && payload.links.length > 0) {
      const linksPayload = payload.links.map((link) => ({
        homework_id: assignmentId,
        resource_type: link.resource_type,
        reference_id: link.reference_id,
      }));
      const { error: addLinks } = await client.from('homework_links').insert(linksPayload);
      if (addLinks) throw new Error(addLinks.message);
    }
  }

  if (payload.replaceFiles) {
    const { error: delFiles } = await client.from('homework_files').delete().eq('homework_id', assignmentId);
    if (delFiles) throw new Error(delFiles.message);
    if (Array.isArray(payload.files) && payload.files.length > 0) {
      const filesPayload = payload.files.map((file) => ({
        homework_id: assignmentId,
        title: file.title ?? null,
        description: file.description ?? null,
        file_url: file.file_url,
        file_type: file.file_type ?? 'file',
      }));
      const { error: addFiles } = await client.from('homework_files').insert(filesPayload);
      if (addFiles) throw new Error(addFiles.message);
    }
  }

  return mapHomeworkAssignment(data);
}

export async function adminDeleteHomework(adminCode, assignmentId) {
  const client = ensureSupabase();
  ensureAdminCode(adminCode);
  // Удаляем связанные сущности, чтобы не уткнуться в внешние ключи.
  const { data: submissions, error: submissionsLoadError } = await client
    .from('homework_submissions')
    .select('id')
    .eq('homework_id', assignmentId);
  if (submissionsLoadError && !isTableMissing(submissionsLoadError)) {
    throw new Error(submissionsLoadError.message);
  }

  const submissionIds = (submissions ?? []).map((row) => row.id);
  if (submissionIds.length > 0) {
    const { error: deleteSubmissionFilesError } = await client
      .from('homework_submission_files')
      .delete()
      .in('submission_id', submissionIds);
    if (deleteSubmissionFilesError && !isTableMissing(deleteSubmissionFilesError)) {
      throw new Error(deleteSubmissionFilesError.message);
    }

    const { error: deleteSubmissionsError } = await client
      .from('homework_submissions')
      .delete()
      .in('id', submissionIds);
    if (deleteSubmissionsError && !isTableMissing(deleteSubmissionsError)) {
      throw new Error(deleteSubmissionsError.message);
    }
  }

  const { error: deleteLinksError } = await client.from('homework_links').delete().eq('homework_id', assignmentId);
  if (deleteLinksError && !isTableMissing(deleteLinksError)) {
    throw new Error(deleteLinksError.message);
  }

  const { error: deleteFilesError } = await client.from('homework_files').delete().eq('homework_id', assignmentId);
  if (deleteFilesError && !isTableMissing(deleteFilesError)) {
    throw new Error(deleteFilesError.message);
  }

  const { error } = await client.from('homework_assignments').delete().eq('id', assignmentId);
  if (error && !isTableMissing(error)) throw new Error(error.message);
  return true;
}
