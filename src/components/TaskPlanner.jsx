import { useCallback, useMemo, useState } from 'react';

const STATUS_FLOW = ['todo', 'in_progress', 'done'];

const STATUS_CONFIG = {
  todo: {
    label: 'К началу',
    badge: 'bg-slate-100 text-slate-600',
    card: 'border-slate-200',
  },
  in_progress: {
    label: 'В работе',
    badge: 'bg-amber-100 text-amber-700',
    card: 'border-amber-200',
  },
  done: {
    label: 'Готово',
    badge: 'bg-emerald-100 text-emerald-700',
    card: 'border-emerald-200',
  },
};

const NEXT_STATUS_LABEL = {
  todo: 'В работу',
  in_progress: 'Завершить',
};

const DIFFICULTY_CONFIG = {
  easy: {
    label: 'Лёгкая',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  medium: {
    label: 'Средняя',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  hard: {
    label: 'Сложная',
    badge: 'bg-rose-50 text-rose-600 border-rose-200',
  },
};

const columns = [
  { id: 'todo', title: 'Запланировано' },
  { id: 'in_progress', title: 'В процессе' },
  { id: 'done', title: 'Завершено' },
];

const QUICK_ACTIONS = {
  todo: [
    { target: 'in_progress', icon: 'play', label: 'В работу', tone: 'brand' },
    { target: 'done', icon: 'check', label: 'Готово', tone: 'success' },
  ],
  in_progress: [
    { target: 'todo', icon: 'rewind', label: 'Назад в план', tone: 'muted' },
    { target: 'done', icon: 'check', label: 'Готово', tone: 'success' },
  ],
  done: [{ target: 'todo', icon: 'refresh', label: 'Вернуть в план', tone: 'muted' }],
};

const QUICK_BUTTON_STYLES = {
  brand: 'border-brand/40 text-brand hover:bg-brand/5',
  success: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50',
  muted: 'border-slate-200 text-slate-500 hover:bg-slate-50',
};

const normalizeTask = (task) => ({
  ...task,
  status: task.status ?? 'todo',
  difficulty: task.difficulty ?? 'medium',
});

export default function TaskPlanner({ tasks, onCreate, onStatusChange, onDelete }) {
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks.map(normalizeTask) : []), [tasks]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Общее');
  const [status, setStatus] = useState('todo');
  const [difficulty, setDifficulty] = useState('medium');
  const [error, setError] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      tasks: safeTasks.filter((task) => task.status === column.id),
    }));
  }, [safeTasks]);

  const stats = useMemo(() => {
    return STATUS_FLOW.reduce(
      (acc, key) => ({
        ...acc,
        [key]: safeTasks.filter((task) => task.status === key).length,
      }),
      {},
    );
  }, [safeTasks]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Добавьте название задачи');
      return;
    }

    try {
      setBusy(true);
      await onCreate({
        title: title.trim(),
        category,
        status,
        difficulty,
      });
      setTitle('');
      setCategory('Общее');
      setStatus('todo');
      setDifficulty('medium');
    } catch (err) {
      setError(err.message ?? 'Не удалось сохранить задачу');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = useCallback(
    async (taskId, nextStatus) => {
      try {
        setError('');
        setBusy(true);
        await onStatusChange(taskId, nextStatus);
      } catch (err) {
        setError(err.message ?? 'Не удалось обновить задачу');
      } finally {
        setBusy(false);
      }
    },
    [onStatusChange],
  );

  const _handleProgressClick = useCallback(
    async (task) => {
      const currentIndex = STATUS_FLOW.indexOf(task.status);
      const nextIndex = Math.min(currentIndex + 1, STATUS_FLOW.length - 1);
      const nextStatus = STATUS_FLOW[nextIndex];
      if (!NEXT_STATUS_LABEL[task.status] || task.status === 'done') return;
      await updateStatus(task.id, nextStatus);
    },
    [updateStatus],
  );

  const _handleReturnToStart = useCallback(
    async (task) => {
      await updateStatus(task.id, 'todo');
    },
    [updateStatus],
  );

  const handleDragStart = (task) => (event) => {
    setDraggedTaskId(task.id);
    event.dataTransfer?.setData('text/plain', task.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (columnId) => (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setHoveredColumn(columnId);
  };

  const handleDrop = (columnId) => async (event) => {
    event.preventDefault();
    const taskId = event.dataTransfer?.getData('text/plain') || draggedTaskId;
    setHoveredColumn(null);
    setDraggedTaskId(null);
    if (!taskId) return;
    const targetColumn = columnId ?? hoveredColumn;
    if (!targetColumn) return;
    const task = safeTasks.find((item) => item.id === taskId);
    if (!task || task.status === targetColumn) {
      return;
    }
    await updateStatus(taskId, targetColumn);
  };

  const handleDragEnd = () => {
    setHoveredColumn(null);
    setDraggedTaskId(null);
  };

  const handleDeleteClick = async (taskId) => {
    try {
      setError('');
      setBusy(true);
      await onDelete(taskId);
    } catch (err) {
      setError(err.message ?? 'Не удалось удалить задачу');
    } finally {
      setBusy(false);
    }
  };

  const renderActions = (task) => {
    const _actionLabel = NEXT_STATUS_LABEL[task.status] ?? 'Продвинуть';
    const quickActions = QUICK_ACTIONS[task.status] ?? [];
    const renderQuickIcon = (icon) => {
      switch (icon) {
        case 'play':
          return (
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 4.5v11a1 1 0 001.555.832l7-5.5a1 1 0 000-1.664l-7-5.5A1 1 0 006 4.5z" />
            </svg>
          );
        case 'check':
          return (
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172l-3.293-3.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" />
            </svg>
          );
        case 'rewind':
          return (
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.707 15.707a1 1 0 01-1.414 0L2.586 10l5.707-5.707a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" />
              <path d="M16.707 15.707a1 1 0 01-1.414 0L9.586 10l5.707-5.707a1 1 0 011.414 1.414L12.414 10l4.293 4.293a1 1 0 010 1.414z" />
            </svg>
          );
        case 'refresh':
          return (
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4.5V2a1 1 0 00-2 0v5a1 1 0 001 1h5a1 1 0 000-2H5.341a6 6 0 118.384 7.018 1 1 0 10.882 1.8A8 8 0 104.341 4.5H4z" />
            </svg>
          );
        default:
          return null;
      }
    };

    return (
      <div className="flex flex-wrap items-center gap-3 pt-3 text-xs font-medium text-slate-500">
        {quickActions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {quickActions.map((action) => (
              <button
                key={`${task.id}-${action.target}`}
                type="button"
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] transition ${QUICK_BUTTON_STYLES[action.tone]}`}
                onClick={() => updateStatus(task.id, action.target)}
              >
                {renderQuickIcon(action.icon)}
                <span className="sr-only">{action.label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-3 py-1 text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
          onClick={() => handleDeleteClick(task.id)}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.366-.446.915-.707 1.493-.707h.5c.578 0 1.127.26 1.493.707l.447.546H15a1 1 0 110 2h-.167l-.623 9.35A2 2 0 0112.218 17h-4.436a2 2 0 01-1.992-1.995L5.167 5.645H5a1 1 0 110-2h2.81l.447-.546zM7.172 5.645l.547 8.2a1 1 0 00.999.93h2.564a1 1 0 00.999-.93l.547-8.2H7.172z"
              clipRule="evenodd"
            />
          </svg>
          Удалить
        </button>
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-brand-dark">Мои задачи</h2>
        <p className="text-sm text-slate-700">
          Планируйте обучение по финансовой грамотности: фиксируйте ключевые шаги, следите за статусами и отмечайте завершение модулей.
        </p>
      </div>

      <div className="grid gap-4 rounded-[2.25rem] border border-white/60 bg-gradient-to-r from-white/85 via-white/70 to-brand/10 p-8 shadow-[0_32px_75px_rgba(15,23,42,0.12)] md:grid-cols-4">
        {columns.map((column) => (
          <div key={column.id} className="rounded-2xl border border-white/50 bg-white/80 p-5 shadow-[0_18px_38px_rgba(37,99,235,0.1)]">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{column.title}</span>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{stats[column.id] ?? 0}</p>
            <p className="mt-1 text-xs text-slate-500">{STATUS_CONFIG[column.id].label}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-[1.9rem] border border-white/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.15)] md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
      >
        <div className="md:col-span-1">
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Название</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например, разобрать тему инвестиций"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Категория</label>
          <input
            type="text"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Статус</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="todo">Запланировано</option>
            <option value="in_progress">В процессе</option>
            <option value="done">Завершено</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Сложность</label>
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="easy">Лёгкая</option>
            <option value="medium">Средняя</option>
            <option value="hard">Сложная</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark"
          >
            {busy ? 'Сохраняем…' : 'Добавить задачу'}
          </button>
        </div>
        {error && (
          <div className="md:col-span-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">{error}</div>
        )}
      </form>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {grouped.map((column) => (
          <div
            key={column.id}
            onDragOver={handleDragOver(column.id)}
            onDrop={handleDrop(column.id)}
            className={`flex min-h-[12rem] flex-col gap-4 rounded-[1.9rem] border bg-gradient-to-br from-white/85 via-white/70 to-brand/10 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.14)] transition ${
              hoveredColumn === column.id ? 'border-brand/60 ring-2 ring-brand/30' : 'border-white/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{column.title}</h3>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CONFIG[column.id].badge}`}>
                {stats[column.id] ?? 0} {STATUS_CONFIG[column.id].label}
              </span>
            </div>
            <div className="space-y-4">
              {column.tasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/60 bg-white/70 px-4 py-6 text-center text-xs text-slate-500">
                  Перетащите сюда задачу или создайте новую.
                </p>
              ) : (
                column.tasks.map((task) => {
                  const difficultyMeta = DIFFICULTY_CONFIG[task.difficulty] ?? DIFFICULTY_CONFIG.medium;
                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={handleDragStart(task)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab rounded-2xl border bg-white/95 px-4 py-3 text-xs shadow-[0_22px_46px_rgba(15,23,42,0.12)] transition hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(37,99,235,0.2)] active:cursor-grabbing sm:text-sm ${STATUS_CONFIG[column.id].card}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-900">{task.title}</h4>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          {task.category}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${difficultyMeta.badge}`}>
                          <span className="font-semibold uppercase tracking-widest">{difficultyMeta.label}</span>
                        </span>
                        {task.due_date && <span>Срок: {new Date(task.due_date).toLocaleDateString('ru-RU')}</span>}
                      </div>
                      {renderActions(task)}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
