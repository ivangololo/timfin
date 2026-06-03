#!/usr/bin/env bash
set -euo pipefail

API_DIR="${API_DIR:-/opt/psbbitrix24-api}"
WEBROOT="${WEBROOT:-/var/www/psbbitrix24.ru}"
RELEASE_ROOT="${RELEASE_ROOT:-/opt/psbbitrix24-releases}"
SERVICE_NAME="${SERVICE_NAME:-psbbitrix24-api}"
NGINX_SITE="${NGINX_SITE:-psbbitrix24.ru}"
STAMP="$(date +%Y%m%d-%H%M%S)"

sudo mkdir -p "$API_DIR" "$WEBROOT" "$RELEASE_ROOT/$STAMP"
sudo cp -a dist "$RELEASE_ROOT/$STAMP/dist"
sudo cp -a server "$RELEASE_ROOT/$STAMP/server"
sudo cp -a deploy "$RELEASE_ROOT/$STAMP/deploy"
sudo cp package.json package-lock.json "$RELEASE_ROOT/$STAMP/"
if [ -f .env ]; then
  sudo cp .env "$RELEASE_ROOT/$STAMP/.env"
fi

if [ -d "$WEBROOT" ]; then
  sudo tar -C "$WEBROOT" -czf "$RELEASE_ROOT/$STAMP/webroot-backup.tgz" . || true
fi

sudo rsync -a --delete "$RELEASE_ROOT/$STAMP/dist/" "$WEBROOT/"
sudo rsync -a --delete "$RELEASE_ROOT/$STAMP/server/" "$API_DIR/server/"
sudo cp "$RELEASE_ROOT/$STAMP/package.json" "$RELEASE_ROOT/$STAMP/package-lock.json" "$API_DIR/"
if [ -f "$RELEASE_ROOT/$STAMP/.env" ]; then
  sudo cp "$RELEASE_ROOT/$STAMP/.env" "$API_DIR/.env"
fi

if [ ! -f "$API_DIR/.env" ]; then
  echo "Missing $API_DIR/.env. Create it or deploy with the local .env included." >&2
  exit 1
fi

sudo cp "$RELEASE_ROOT/$STAMP/deploy/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service"
sudo cp "$RELEASE_ROOT/$STAMP/deploy/nginx-psbbitrix24.conf" "/etc/nginx/sites-available/${NGINX_SITE}.conf"
sudo ln -sfn "/etc/nginx/sites-available/${NGINX_SITE}.conf" "/etc/nginx/sites-enabled/${NGINX_SITE}.conf"
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/menteresource-api.conf /etc/nginx/sites-available/menteresource-api.conf
if systemctl list-unit-files menteresource-api.service >/dev/null 2>&1; then
  sudo systemctl disable --now menteresource-api.service || true
fi
sudo rm -f /etc/systemd/system/menteresource-api.service

cd "$API_DIR"
sudo npm ci --omit=dev
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl --no-pager --full status "$SERVICE_NAME"
