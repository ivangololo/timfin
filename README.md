# Финансовая грамотность — личный кабинет ученика

Одностраничное приложение для учеников репетитора Тимура Шафеева. Проект создан на базе React, Vite, Tailwind CSS и Supabase (через REST API) и содержит расширенные модули: тренажёр карточек (с уровнем сложности, режимом «Все темы» и анимированным переворотом), целенаправленное повторение, практика с кейсами, база знаний с загрузкой файлов, персональная теория для каждого ученика, теория, расписание олимпиад и планировщик задач.

## Быстрый старт

```bash
npm install
npm run dev
```

Приложение стартует на [http://localhost:5173](http://localhost:5173).

## Максимально подробная инструкция для Windows

> Ниже приведён сценарий «с нуля»: от подготовки рабочего окружения до запуска сайта и сборки production-версии. Шаги рассчитаны на Windows 10/11 и не требуют установки WSL.

### 1. Подготовка окружения

1. **Установите Git**
   - Скачайте инсталлятор с [https://git-scm.com/download/win](https://git-scm.com/download/win).
   - В установщике оставьте параметры по умолчанию (включая «Git from the command line and also from 3rd-party software»).
   - После установки откройте «Пуск» → введите `cmd` → запустите «Командную строку». Выполните `git --version`, чтобы убедиться, что Git доступен.

2. **Установите Node.js LTS (18.x или 20.x)**
   - Скачайте MSI-файл с [https://nodejs.org/en](https://nodejs.org/en) (кнопка **LTS**).
   - Запустите установщик, отметьте пункт «Automatically install the necessary tools» (при его наличии) и завершите установку.
   - Перезапустите терминал и выполните `node -v` и `npm -v`, чтобы проверить наличие Node.js и npm.

3. **(Опционально) Установите Visual Studio Code**
   - Доступно на [https://code.visualstudio.com/](https://code.visualstudio.com/).
   - Во время установки добавьте пункт «Add to PATH» для быстрого вызова `code .` из терминала.

### 2. Клонирование репозитория

1. Выберите папку, где будет размещён проект (например, `C:\Projects`).
2. Откройте PowerShell или Windows Terminal и выполните:

   ```powershell
   cd C:\Projects
   git clone https://github.com/<your-account>/projectfortimur.git
   cd projectfortimur\app
   ```

   > Замените `<your-account>` на ваш реальный путь репозитория или используйте `git clone` с SSH, если настроены ключи.

### 3. Настройка переменных окружения (при использовании Supabase)

1. В каталоге `app` создайте файл `.env`. В PowerShell это можно сделать так:

   ```powershell
   copy .env.example .env
   ```

2. Откройте `.env` любым редактором и пропишите ключи вашего Supabase-проекта:

   ```env
   VITE_SUPABASE_URL=https://your-instance.supabase.co
   VITE_SUPABASE_ANON_KEY=public-anon-key
   ```

3. Если файл `.env` отсутствует или пуст, приложение не сможет подключиться к данным. Supabase-ключи обязательны.

### 4. Установка зависимостей

1. Убедитесь, что находитесь в папке `app`.
2. Выполните установку пакетов:

   ```powershell
   npm install
   ```

   В первый запуск команда загрузит директорию `node_modules`. На Windows иногда требуется несколько минут в зависимости от скорости соединения.

### 5. Запуск сервера разработки

1. В той же консоли запустите Vite:

   ```powershell
   npm run dev
   ```

2. Vite отобразит ссылку вида `http://localhost:5173/`. Удерживайте клавишу `Ctrl` и кликните по адресу либо вставьте URL в браузер (Chrome, Edge, Firefox).
3. Чтобы остановить сервер, вернитесь в терминал и нажмите `Ctrl + C`, затем подтвердите остановку клавишей `Y` (если появится запрос).

### 6. Работа с кодом и hot-reload

1. В VS Code откройте папку `app` (`File → Open Folder` или команда `code .` из PowerShell).
2. Любые изменения в файлах `src/…` автоматически отобразятся в браузере благодаря hot-reload от Vite.
3. Tailwind CSS классы применяются мгновенно — достаточно сохранить файл (`Ctrl + S`).

### 7. Проверка качества кода и сборка production-версии

```powershell
npm run lint      # проверка ESLint
npm run build     # production-сборка (вывод в каталог dist)
npm run preview   # локальный просмотр production-сборки
```

После `npm run build` папка `dist` содержит статические файлы, готовые для загрузки на хостинг (например, Vercel, Netlify, любой статический сервер).

### 8. Типичные проблемы на Windows

- **Права доступа**: при запуске PowerShell в корпоративной среде убедитесь, что политика выполнения (`Get-ExecutionPolicy`) позволяет исполнять скрипты. В случае ограничений используйте команду `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` от имени администратора.
- **Прокси или антивирус**: при проблемах с `npm install` проверьте настройки прокси или временно отключите фильтры, блокирующие скачивание пакетов.
- **Конфликты портов**: если порт `5173` занят, Vite предложит другой. Следуйте ссылке, указанной в терминале.
- **Обновление зависимостей**: при смене веток или обновлении проекта повторно выполните `npm install`, чтобы синхронизировать `node_modules`.

### Переменные окружения

Создайте файл `.env` в папке `app` и укажите ключи Supabase:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Без этих переменных приложение не сможет загрузить данные. Все карточки, задания, практика, база знаний и теория хранятся в Supabase.

### Основные сценарии

- **Авторизация по коду** — проверка доступных кодов через Supabase (таблица `access_codes`).
- **Заявка на доступ** — новый ученик отправляет имя и фамилию, заявка попадает в админ‑панель, администратор её одобряет (таблица `access_requests`, функции `submit_access_request`, `admin_list_access_requests`, `admin_approve_access_request`, `claim_access_code`), код генерируется автоматически и показывается ученику один раз.
- **Прогресс учеников** — сохраняется в Supabase (`progress`). Фиксируются статусы `know`, `unsure`, `dontknow`, чтобы формировать отдельный список повторения.
- **Карточки и теория** — загружаются из Supabase (`training_cards`, `theory`).
- **Повторение карточек** — отдельный модуль, куда автоматически попадают карточки со статусами «Не знаю» и «Не уверен».
- **Расписание олимпиад** — таблица мероприятий с фильтрами по статусу (Supabase `schedule`).
- **Практические кейсы** — задачи с развёрнутыми решениями и уровнем сложности из таблицы `practice_cases`.
- **База знаний** — общий каталог статей, ссылок и файлов (`knowledge_resources`) + публичный Storage-бакет `knowledge`.
- **Моя теория** — персональные материалы ученика (`personal_theory`), можно добавлять записи из базы знаний или загружать текст, изображения и PDF в реальном времени.
- **Тренажёр карточек** — более 100 карточек по темам с пометкой сложности и режимом «Все темы», данные берутся из `training_cards`.
- **Мои задачи** — личный план ученика с drag-and-drop и уровнями сложности (таблица `tasks`).

### Supabase: авторизация по коду

```sql
create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_name text,
  user_id uuid references profiles(id) on delete set null,
  issued_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table access_codes enable row level security;

create policy "profiles_read" on profiles for select using (true);
create policy "codes_read" on access_codes for select using (true);
```

*Совет:* если коды не должны быть публичными, ограничьте доступ на чтение и используйте сервисный ключ в Edge Function/крон-скрипте.

### Supabase: карточки тренажёра

```sql
create table if not exists training_cards (
  id bigserial primary key,
  category text not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

alter table training_cards enable row level security;
create policy "cards_select" on training_cards for select using (true);
```

### Supabase: теория и практика

```sql
create table if not exists theory (
  id text primary key,
  title text not null,
  summary text,
  content text not null,
  updated_at timestamptz not null default now()
);

create table if not exists practice_cases (
  id text primary key,
  title text not null,
  summary text,
  prompt text not null,
  solution text not null,
  points integer,
  difficulty text not null default 'medium',
  created_at timestamptz not null default now()
);

alter table theory enable row level security;
alter table practice_cases enable row level security;

create policy "theory_select" on theory for select using (true);
create policy "practice_select" on practice_cases for select using (true);
```

### Supabase: база знаний

```sql
create table if not exists knowledge_resources (
  id text primary key,
  category text not null,
  title text not null,
  description text,
  type text not null,
  url text,
  content text,
  difficulty text not null default 'medium',
  tags text[] default '{}',
  updated_at timestamptz not null default now()
);

alter table knowledge_resources enable row level security;
create policy "knowledge_select" on knowledge_resources for select using (true);
```

### Supabase: персональная теория

```sql
create table if not exists personal_theory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  resource_id text references knowledge_resources(id),
  title text not null,
  description text,
  type text not null,
  url text,
  content text,
  difficulty text not null default 'medium',
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

alter table personal_theory enable row level security;
create policy "personal_theory_select" on personal_theory for select using (auth.uid() = user_id);
create policy "personal_theory_insert" on personal_theory for insert with check (auth.uid() = user_id);
create policy "personal_theory_delete" on personal_theory for delete using (auth.uid() = user_id);
```

### Supabase Storage: файлы базы знаний

1. В панели Supabase откройте **Storage → Create bucket** и создайте публичный бакет `knowledge` (Public bucket = On).
2. В разделе **Policies** добавьте правило на чтение:

```sql
create policy "knowledge_public_read" on storage.objects
  for select using (bucket_id = 'knowledge');
```

3. Для загрузки файлов из интерфейса также добавьте политику вставки для авторизованных пользователей (при необходимости ограничьте по ролям):

```sql
create policy "knowledge_authenticated_upload" on storage.objects
  for insert with check (bucket_id = 'knowledge');
```

Файлы (PDF, изображения) будут загружаться в этот бакет и получать публичные ссылки, которые отображаются в базе знаний и «Моей теории».

### Supabase: прогресс карточек

JSON-колонка `data` в таблице `progress` теперь хранит объект вида:

```json
{
  "statuses": {
    "1": "know",
    "2": "unsure",
    "5": "dontknow"
  },
  "lastSeenIndex": {
    "Налоги": 3
  },
  "knownCardIds": ["1"],
  "reviewCardIds": ["2", "5"],
  "reviewStatuses": {
    "1": "know",
    "2": "unsure",
    "5": "dontknow"
  }
}
```

Если хранится только массив `knownCardIds`, приложение автоматически преобразует его к новой структуре.

```sql
create table if not exists progress (
  user_id uuid primary key references profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function update_progress_timestamp()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_progress_timestamp on progress;
create trigger trg_progress_timestamp
before insert or update on progress
for each row execute function update_progress_timestamp();

alter table progress enable row level security;
create policy "progress_rw" on progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Supabase: таблица расписания олимпиад

Для синхронизации раздела «Расписание» используйте расширенную структуру (все поля, кроме `title`, можно оставлять пустыми):

```sql
create table if not exists schedule (
  id bigint generated by default as identity primary key,
  title text not null,
  status text default 'open',
  date date,
  start time,
  "end" time,
  format text,
  direction text,
  registration text,
  logo_url text,
  registration_url text,
  date_meta jsonb,
  registration_start date,
  registration_end date,
  level text
);
```

Рекомендуемые политики RLS:

```sql
alter table schedule enable row level security;
create policy "schedule_select" on schedule for select using (true);
```

### Supabase: таблица задач

Для синхронизации раздела «Мои задачи» добавьте таблицу `tasks`:

```sql
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  category text,
  status text not null default 'todo',
  difficulty text not null default 'medium',
  due_date date,
  created_at timestamptz not null default now(),
  constraint tasks_difficulty_check check (difficulty in ('easy','medium','hard'))
);
```

Рекомендуемые политики RLS для `anon`-ключа:

```sql
alter table tasks enable row level security;
create policy "tasks_select" on tasks for select using (auth.uid() = user_id);
create policy "tasks_insert" on tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update" on tasks for update using (auth.uid() = user_id);
create policy "tasks_delete" on tasks for delete using (auth.uid() = user_id);
```

Если RLS отключён, приложение также сможет работать, но в боевом режиме рекомендуется ограничить доступ.

## Скрипты

| Команда        | Назначение                     |
| -------------- | ------------------------------ |
| `npm run dev`  | Запускает Vite dev server      |
| `npm run build`| Производственная сборка        |
| `npm run lint` | Проверка кода ESLint           |
| `npm run preview` | Предпросмотр production-сборки |

## Структура

- `src/components` — интерфейсные блоки (личный кабинет, тренажёр, повторение, практика, база знаний, теория, расписание, задачи).
- `src/services/supabaseClient.js` — клиент Supabase с fallback на локальные данные, поддерживает загрузку файлов и персональные подборки.
- `src/data` — примерные JSON-файлы для наполнения Supabase (карточки, теория, практика, база знаний, расписание, коды доступа, задачи).
- `tailwind.config.js` — тема интерфейса и глобальные стили.
