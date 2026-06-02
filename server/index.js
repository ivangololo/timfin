import express from 'express';
import { createClient } from '@supabase/supabase-js';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const app = express();
const port = Number(process.env.PORT || 3100);
const supabaseUrl = required('SUPABASE_URL').replace(/\/+$/, '');
const supabaseAnonKey = required('SUPABASE_ANON_KEY');
const proxyBase = process.env.PUBLIC_SUPABASE_PROXY_BASE || '/api/supabase';
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const normalizeCode = (value) => String(value ?? '').trim().toUpperCase();

const maybeSingle = async (query) => {
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
};

const single = async (query) => {
  const { data, error } = await query.single();
  if (error) throw error;
  return data;
};

const list = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

const rewriteSupabaseUrls = (value) => {
  if (typeof value === 'string') return value.split(supabaseUrl).join(proxyBase);
  if (Array.isArray(value)) return value.map(rewriteSupabaseUrls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteSupabaseUrls(item)]));
  }
  return value;
};

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'menteresource-api' });
});

app.use(
  '/api/supabase',
  express.raw({ type: '*/*', limit: process.env.UPLOAD_LIMIT || '25mb' }),
  asyncHandler(async (req, res) => {
    const upstreamPath = req.originalUrl.replace(/^\/api\/supabase/, '') || '/';
    const upstreamUrl = `${supabaseUrl}${upstreamPath}`;
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue;
      const lower = key.toLowerCase();
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(lower)) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    headers.set('apikey', supabaseAnonKey);
    headers.set('authorization', `Bearer ${supabaseAnonKey}`);

    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(lower)) return;
      res.setHeader(key, value);
    });

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await upstream.json();
      return res.json(rewriteSupabaseUrls(payload));
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  }),
);

app.get(
  '/api/bootstrap',
  asyncHandler(async (_req, res) => {
    const [cards, theory, schedule, practice, knowledgeBase, homework] = await Promise.all([
      list(supabase.from('training_cards').select('*')),
      list(supabase.from('theory').select('*')),
      list(supabase.from('schedule').select('*').order('date', { ascending: true })),
      list(supabase.from('practice_cases').select('*')),
      list(supabase.from('knowledge_resources').select('*')),
      list(
        supabase
          .from('homework_assignments')
          .select('*, links:homework_links(*), files:homework_files(*)')
          .order('created_at', { ascending: false }),
      ),
    ]);

    res.json(rewriteSupabaseUrls({ cards, theory, schedule, practice, knowledgeBase, homework }));
  }),
);

app.use('/api', express.json({ limit: process.env.JSON_LIMIT || '2mb' }));

app.post(
  '/api/auth/sign-in',
  asyncHandler(async (req, res) => {
    const code = normalizeCode(req.body?.code);
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const accessCode = await maybeSingle(
      supabase.from('access_codes').select('id, code, owner_name, user_id').eq('code', code),
    );
    if (!accessCode) return res.status(404).json({ error: 'Code not found' });

    let profile = await maybeSingle(
      supabase.from('profiles').select('id, name, code, is_admin, is_owner').eq('code', code),
    );

    if (!profile) {
      profile = await single(
        supabase
          .from('profiles')
          .insert({ name: accessCode.owner_name ?? `Student ${code.slice(-4)}`, code, is_admin: false })
          .select('id, name, code, is_admin, is_owner'),
      );
    }

    res.json({ user: profile });
  }),
);

app.get(
  '/api/user/:id/progress',
  asyncHandler(async (req, res) => {
    const progress = await maybeSingle(supabase.from('progress').select('*').eq('user_id', req.params.id));
    res.json({ progress });
  }),
);

app.put(
  '/api/user/:id/progress',
  asyncHandler(async (req, res) => {
    const progress = await single(
      supabase
        .from('progress')
        .upsert({ ...req.body, user_id: req.params.id }, { onConflict: 'user_id' })
        .select(),
    );
    res.json({ progress });
  }),
);

app.get(
  '/api/user/:id/tasks',
  asyncHandler(async (req, res) => {
    const tasks = await list(supabase.from('tasks').select('*').eq('user_id', req.params.id).order('created_at'));
    res.json({ tasks });
  }),
);

app.post(
  '/api/user/:id/tasks',
  asyncHandler(async (req, res) => {
    const task = await single(supabase.from('tasks').insert({ ...req.body, user_id: req.params.id }).select());
    res.status(201).json({ task });
  }),
);

app.patch(
  '/api/tasks/:id',
  asyncHandler(async (req, res) => {
    const task = await single(supabase.from('tasks').update(req.body).eq('id', req.params.id).select());
    res.json({ task });
  }),
);

app.delete(
  '/api/tasks/:id',
  asyncHandler(async (req, res) => {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  }),
);

app.get(
  '/api/user/:id/personal-theory',
  asyncHandler(async (req, res) => {
    const theory = await list(
      supabase.from('personal_theory').select('*').eq('user_id', req.params.id).order('created_at'),
    );
    res.json({ theory: rewriteSupabaseUrls(theory) });
  }),
);

app.get(
  '/api/homework',
  asyncHandler(async (_req, res) => {
    const homework = await list(
      supabase
        .from('homework_assignments')
        .select('*, links:homework_links(*), files:homework_files(*)')
        .order('created_at', { ascending: false }),
    );
    res.json({ homework: rewriteSupabaseUrls(homework) });
  }),
);

app.get(
  '/api/user/:id/homework-submissions',
  asyncHandler(async (req, res) => {
    const submissions = await list(
      supabase
        .from('homework_submissions')
        .select('*, files:homework_submission_files(*)')
        .eq('user_id', req.params.id)
        .order('created_at', { ascending: false }),
    );
    res.json({ submissions: rewriteSupabaseUrls(submissions) });
  }),
);

app.post(
  '/api/access-requests',
  asyncHandler(async (req, res) => {
    const { fullName, name } = req.body ?? {};
    const { data, error } = await supabase
      .rpc('submit_access_request', { p_full_name: fullName ?? name })
      .single();
    if (error) throw error;
    res.status(201).json({ request: data });
  }),
);

app.post(
  '/api/access-requests/:id/claim',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase.rpc('claim_access_code', { p_request_id: req.params.id }).single();
    if (error) throw error;
    res.json({ accessCode: data });
  }),
);

app.use((err, _req, res, _next) => {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || 'Internal server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`menteresource-api listening on 127.0.0.1:${port}`);
});
