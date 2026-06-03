# psbbitrix24-api

Node.js backend for `psbbitrix24.ru`. It keeps Supabase calls on the server side and exposes same-origin API routes under `/api`.

## Environment

Create `/opt/psbbitrix24-api/.env` on the server:

```ini
NODE_ENV=production
PORT=3100
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PUBLIC_SUPABASE_PROXY_BASE=/api/supabase
UPLOAD_LIMIT=50mb
JSON_LIMIT=2mb
```

Do not put Supabase service role keys into the frontend.

The backend also accepts `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, so the existing local `.env` can be uploaded on the first deploy.

## One-command deploy

From Windows PowerShell:

```powershell
npm run deploy:server
```

For the first deploy, when the server does not have `/opt/psbbitrix24-api/.env` yet:

```powershell
npm run deploy:server -- -UploadEnv
```

The command builds the frontend, uploads `dist`, `server`, `deploy`, and package files to `ubuntu@89.208.211.231:49619`, installs nginx/systemd config, runs `npm ci --omit=dev`, restarts `psbbitrix24-api`, and reloads nginx.

## Nginx

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3100/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50m;
}
```

## systemd

```ini
[Unit]
Description=PSB Bitrix24 API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/psbbitrix24-api
EnvironmentFile=/opt/psbbitrix24-api/.env
ExecStart=/usr/bin/node /opt/psbbitrix24-api/server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
