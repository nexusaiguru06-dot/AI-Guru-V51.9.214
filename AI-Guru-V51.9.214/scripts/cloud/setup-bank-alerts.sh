#!/usr/bin/env bash
# V51.9.190 — let the school's bank alerts confirm UPI payments automatically (run once in Cloud Shell).
#
# 1. Makes a secret (kept in Secret Manager) and gives it to the app as AI_GURU_BANK_ALERT_SECRET.
# 2. Prints the two things to paste into the Gmail script (scripts/payments/gmail-bank-alerts.gs):
#    the address of AI Guru's bank-alert door, and the secret.
#
#   PROJECT_ID=your-project bash scripts/cloud/setup-bank-alerts.sh
set -euo pipefail
PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID, e.g. PROJECT_ID=project-c5a9001c-2043-41d4-b68}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-ai-guru}"
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
gcloud config set project "$PROJECT_ID" >/dev/null

say "1/2 A secret only the Gmail script and the app know (Secret Manager)"
if gcloud secrets describe ai-guru-bank-alert-secret >/dev/null 2>&1; then
  SECRET=$(gcloud secrets versions access latest --secret=ai-guru-bank-alert-secret)
else
  SECRET=$(openssl rand -hex 32)
  printf '%s' "$SECRET" | gcloud secrets create ai-guru-bank-alert-secret --replication-policy=automatic --data-file=- >/dev/null
fi

say "2/2 Giving it to the app (a new revision starts; the site stays up)"
gcloud run services update "$SERVICE" --region="$REGION" --update-secrets=AI_GURU_BANK_ALERT_SECRET=ai-guru-bank-alert-secret:latest >/dev/null
URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')

cat <<MSG

Done. Now open https://script.google.com with the Gmail account that gets the HDFC alerts:
  New project → paste scripts/payments/gmail-bank-alerts.gs → Project Settings → Script properties → add:
    AI_GURU_URL     $URL/api/ai-guru/payments/bank-alert
    AI_GURU_SECRET  $SECRET
  Then run  install  once (allow the access it asks for). It checks your inbox every 5 minutes.
Keep the secret private. To change it:  gcloud secrets versions add ai-guru-bank-alert-secret --data-file=-
MSG
