# menteresource-api

Node.js backend for `menteresource.ru`. It keeps Supabase calls on the server side and exposes same-origin API routes under `/api`.

## Environment

Create `/opt/menteresource-api/.env` on the server:

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
Description=MenteResource API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/menteresource-api
EnvironmentFile=/opt/menteresource-api/.env
ExecStart=/usr/bin/node /opt/menteresource-api/server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
