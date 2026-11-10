#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Define PROJECT_ID con el ID del proyecto de Google Cloud}"
: "${SERVICE_ACCOUNT:?Define SERVICE_ACCOUNT con el correo de la cuenta de servicio de Cloud Run}"
: "${IMAGE:?Define IMAGE con la URL de la imagen publicada en Artifact Registry}"

REGION=${REGION:-southamerica-west1}
SERVICE=${SERVICE:-page-builder}
ENV_FILE=${ENV_FILE:-cloudrun.env.yaml}
SECRETS=${SECRETS:-ADMIN_PASSWORD=page-builder-admin-password:1,SESSION_SECRET=page-builder-session-secret:1}

gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "$IMAGE" \
  --service-account "$SERVICE_ACCOUNT" \
  --port 8080 \
  --concurrency 4 \
  --max-instances 1 \
  --memory 768Mi \
  --timeout 240s \
  --startup-probe 'httpGet.path=/health,httpGet.port=8080,periodSeconds=5,timeoutSeconds=3,failureThreshold=12' \
  --env-vars-file "$ENV_FILE" \
  --set-secrets "$SECRETS" \
  --no-allow-unauthenticated
