import { useEffect, useState } from 'react';
import AmbientBackdrop from './AmbientBackdrop.jsx';

export default function LoginForm({ onSubmit, loading, offlineNotice = '', onRequestAccess, onCheckAccess, accessRequest }) {
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [requestError, setRequestError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!code.trim()) {
      setError('Введите персональный код');
      return;
    }
    try {
      await onSubmit(code);
      setCode('');
    } catch (err) {
      setError(err.message || 'Не удалось авторизоваться');
    }
  };

  const handleRequestSubmit = async (event) => {
    event.preventDefault();
    if (!onRequestAccess) return;
    const normalized = fullName.trim();
    setRequestError('');
    if (!normalized) {
      setRequestError('Введите имя и фамилию для заявки.');
      return;
    }
    try {
      await onRequestAccess(normalized);
      setFullName('');
    } catch (err) {
      setRequestError(err.message || 'Не удалось отправить заявку.');
    }
  };

  const handleCheckStatus = async () => {
    if (!onCheckAccess) return;
    setRequestError('');
    try {
      await onCheckAccess();
    } catch (err) {
      setRequestError(err.message || 'Не удалось проверить статус.');
    }
  };

  useEffect(() => {
    if (accessRequest?.code) {
      setCode(accessRequest.code);
      setError('');
    }
  }, [accessRequest?.code]);

  const requestStatus = accessRequest?.status ?? '';
  const requestId = accessRequest?.id ?? '';
  const requestLoading = Boolean(accessRequest?.loading);
  const combinedRequestError = requestError || accessRequest?.error || '';

  const statusMessage = (() => {
    if (!requestStatus && !requestId) return '';
    if (requestStatus === 'pending') {
      return 'Заявка отправлена. Ожидайте одобрения администратора.';
    }
    if (requestStatus === 'approved' && accessRequest?.code) {
      return 'Заявка одобрена. Код доступен ниже.';
    }
    if (requestStatus === 'approved') {
      return 'Заявка одобрена. Получите код ниже.';
    }
    if (requestStatus === 'delivered') {
      return 'Код уже был показан ранее.';
    }
    if (requestStatus === 'not_found') {
      return 'Заявка не найдена. Отправьте новую.';
    }
    return '';
  })();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-50">
      <AmbientBackdrop variant="login" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),transparent_55%),radial-gradient(circle_at_bottom,_rgba(148,163,184,0.18),transparent_60%)]" />

    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
        <div className="grid gap-10 rounded-[2.5rem] border border-white/10 bg-white/5 p-10 backdrop-blur-xl shadow-[0_30px_80px_rgba(15,23,42,0.45)] lg:grid-cols-[1.2fr_1fr]">
          <section className="flex flex-col justify-between gap-10">
            <div className="space-y-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-100">
                Тимур Шафеев
              </span>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                  Финансовая грамотность
                </h1>
                <p className="text-base leading-relaxed text-slate-200">
                  Личный кабинет с тренажёрами, теориями и расписанием занятий. Вход осуществляется по персональному коду, который можно использовать повторно.
                </p>
              </div>
              <dl className="grid gap-5 text-sm text-slate-200 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/10 px-5 py-4 shadow-inner">
                  <dt className="text-xs uppercase tracking-widest text-slate-300">Модули</dt>
                  <dd className="mt-2 font-semibold text-white">Тренажёр · Теория · Расписание</dd>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 px-5 py-4 shadow-inner">
                  <dt className="text-xs uppercase tracking-widest text-slate-300">Поддержка</dt>
                  <dd className="mt-2 font-semibold text-white">Помощь наставника в чате</dd>
                </div>
              </dl>
            </div>

            <p className="text-xs text-slate-400">
              Нужна помощь? Напишите в Telegram: <span className="font-medium text-white">@timur_fincoach</span>
            </p>
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-2xl">
            <header className="space-y-3 text-center text-slate-900">
              <h2 className="text-2xl font-semibold">Вход по персональному коду</h2>
              <p className="text-sm text-slate-600">После авторизации вы сможете продолжить обучение с того места, где остановились.</p>
            </header>

            {offlineNotice && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
                {offlineNotice}
              </div>
            )}

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="code" className="block text-sm font-medium text-slate-700">
                  Персональный код
                </label>
                <input
                  id="code"
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="FG-XXXX-0000"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg tracking-[0.35em] text-center font-semibold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-brand px-6 py-3 text-lg font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Проверяем код…' : 'Войти в кабинет'}
              </button>
            </form>

            <div className="mt-8 space-y-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-brand-dark">
                  Нет кода?
                </span>
                <p className="text-sm text-slate-700">Оставьте заявку — администратор выдаст доступ.</p>
              </div>

              <form className="space-y-3" onSubmit={handleRequestSubmit}>
                <div className="space-y-2">
                  <label htmlFor="full_name" className="block text-sm font-medium text-slate-700">
                    Имя и фамилия
                  </label>
                  <input
                    id="full_name"
                    type="text"
                    placeholder="Как к вам обращаться?"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                    disabled={requestLoading}
                  />
                </div>

                {combinedRequestError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {combinedRequestError}
                  </div>
                )}

                {statusMessage && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {statusMessage}
                    {requestId && (
                      <span className="ml-2 font-semibold text-amber-800">ID заявки: {requestId}</span>
                    )}
                  </div>
                )}

                {accessRequest?.code && (
                  <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center text-emerald-800 shadow-inner">
                    <p className="text-xs uppercase tracking-[0.3em]">Ваш новый код доступа</p>
                    <p className="text-3xl font-mono font-semibold text-emerald-900">{accessRequest.code}</p>
                    <p className="text-xs text-emerald-700">Сохраните этот код — он показывается только один раз.</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={requestLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark disabled:opacity-70"
                  >
                    {requestLoading ? 'Отправляем…' : 'Отправить заявку'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCheckStatus}
                    disabled={requestLoading || !requestId}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-60"
                  >
                    Проверить статус
                  </button>
                </div>
              </form>

              <p className="text-xs text-slate-500">
                После одобрения код появится выше. Он также будет указан рядом с вашим именем в личном кабинете.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
