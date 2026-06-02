#!/usr/bin/env bash
set -euo pipefail

API_DIR="${API_DIR:-/opt/menteresource-api}"
WEBROOT="${WEBROOT:-/var/www/menteresource.ru}"
RELEASE_ROOT="${RELEASE_ROOT:-/opt/menteresource-releases}"
STAMP="$(date +%Y%m%d-%H%M%S)"

sudo mkdir -p "$API_DIR" "$WEBROOT" "$RELEASE_ROOT/$STAMP"
sudo cp -a dist "$RELEASE_ROOT/$STAMP/dist"
sudo cp -a server "$RELEASE_ROOT/$STAMP/server"
sudo cp package.json package-lock.json "$RELEASE_ROOT/$STAMP/"

if [ -d "$WEBROOT" ]; then
  sudo tar -C "$WEBROOT" -czf "$RELEASE_ROOT/$STAMP/webroot-backup.tgz" . || true
fi

sudo rsync -a --delete "$RELEASE_ROOT/$STAMP/dist/" "$WEBROOT/"
sudo rsync -a --delete "$RELEASE_ROOT/$STAMP/server/" "$API_DIR/server/"
sudo cp "$RELEASE_ROOT/$STAMP/package.json" "$RELEASE_ROOT/$STAMP/package-lock.json" "$API_DIR/"

cd "$API_DIR"
sudo npm ci --omit=dev
sudo systemctl daemon-reload
sudo systemctl restart menteresource-api
sudo systemctl reload nginx
sudo systemctl --no-pager --full status menteresource-api
