#!/usr/bin/env bash
set -euo pipefail

# Despliegue repetible de Zumbido 05 hacia cPanel (sin secretos embebidos)
DEPLOY_HOST="${DEPLOY_HOST:-68.168.112.211}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_USER="${DEPLOY_USER:-lgsalced}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/antigravity_msn_rsa}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/lgsalced/apps/msn}"

SSH_OPTS=(-i "$DEPLOY_KEY" -p "$DEPLOY_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

echo "==> 1. Compilando frontend PWA..."
npm run build

echo "==> 2. Sincronizando codigo y dist hacia ${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_APP_DIR}..."
ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p '${REMOTE_APP_DIR}/data' '${REMOTE_APP_DIR}/logs' '${REMOTE_APP_DIR}/run'"

rsync -az --delete \
  -e "ssh -i ${DEPLOY_KEY} -p ${DEPLOY_PORT} -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.venv' \
  --exclude 'data' \
  --exclude 'logs' \
  --exclude 'run' \
  --exclude 'node_modules' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  backend dist requirements.txt \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_APP_DIR}/"

scp -i "$DEPLOY_KEY" -P "$DEPLOY_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  deploy/cpanel/start.sh "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_APP_DIR}/start.sh"

echo "==> 3. Actualizando dependencias Python y reiniciando uvicorn..."
ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "
  set -euo pipefail
  chmod +x '${REMOTE_APP_DIR}/start.sh'
  '${REMOTE_APP_DIR}/.venv/bin/pip' install -q -r '${REMOTE_APP_DIR}/requirements.txt'
  '${REMOTE_APP_DIR}/start.sh' --restart
  APP_PORT=\$(grep -E '^PORT=' '${REMOTE_APP_DIR}/.env' | cut -d= -f2)
  for _ in \$(seq 1 40); do
    if curl -fsS \"http://127.0.0.1:\${APP_PORT}/api/health\"; then
      echo
      exit 0
    fi
    sleep 0.5
  done
  echo 'Health check timeout' >&2
  exit 1
"

echo "==> Despliegue completado."
