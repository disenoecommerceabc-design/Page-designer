#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

: "${REGION:?Indica la región donde ya existe el servicio pagedesigner}"
project=page-designer-514313
service=pagedesigner
port=8080
secrets="ADMIN_PASSWORD=${ADMIN_SECRET_REF:-page-builder-admin-password:1},SESSION_SECRET=${SESSION_SECRET_REF:-page-builder-session-secret:1}"

gcloud run deploy "$service" \
  --project="$project" --region="$REGION" --source=. \
  --port="$port" --command="" --args="" \
  --concurrency=4 --max-instances=1 \
  --startup-probe="httpGet.path=/health,httpGet.port=$port,periodSeconds=5,timeoutSeconds=3,failureThreshold=12" \
  --update-env-vars='APP_ENV=production,ALLOW_EPHEMERAL_DATA=true,COOKIE_SECURE=true,ALLOWED_HOSTS=*.run.app,FORWARDED_ALLOW_IPS=*,ADMIN_USERNAME=admin,AI_ENABLED=false' \
  --update-secrets="$secrets"
