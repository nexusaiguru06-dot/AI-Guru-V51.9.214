#!/usr/bin/env bash
# V51.9.186 — the daily fee-reminder run on Google Cloud (run once in Cloud Shell, after setup-google-cloud.sh).
#
# Every day at REMINDER_TIME (India time) Cloud Scheduler calls AI Guru's /api/ai-guru/cron/fee-reminders. Each run sends
# the reminders due that day into the students' Messages:
#   • a reminder 3 days before and on the due date (once each)
#   • a reminder EVERY DAY of the grace period ("day 2 of 5 · 3 days left")
#   • "Your grace period is over, please make payment to continue" once, the day after the grace period ends
# Running it again the same day sends nothing twice.
#
#   PROJECT_ID=your-project REMINDER_TIME=09:00 bash scripts/cloud/setup-daily-reminders.sh
set -euo pipefail
PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID, e.g. PROJECT_ID=project-c5a9001c-2043-41d4-b68}"
REGION="${REGION:-asia-south1}"
REMINDER_TIME="${REMINDER_TIME:-09:00}"          # HH:MM, India time
SERVICE="${SERVICE:-ai-guru}"
JOB="${JOB:-ai-guru-fee-reminders}"
HH="${REMINDER_TIME%%:*}"; MM="${REMINDER_TIME##*:}"
case "$HH$MM" in *[!0-9]*|'') echo "REMINDER_TIME must look like 09:00"; exit 1;; esac

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
gcloud config set project "$PROJECT_ID" >/dev/null

say "1/4 Turning on Cloud Scheduler"
gcloud services enable cloudscheduler.googleapis.com

say "2/4 A secret only the scheduler and the app know (kept in Secret Manager)"
if gcloud secrets describe ai-guru-cron-secret >/dev/null 2>&1; then
  CRON_SECRET=$(gcloud secrets versions access latest --secret=ai-guru-cron-secret)
else
  CRON_SECRET=$(openssl rand -hex 32)
  printf '%s' "$CRON_SECRET" | gcloud secrets create ai-guru-cron-secret --replication-policy=automatic --data-file=- >/dev/null
fi

say "3/4 Giving the secret to the app (a new revision starts; the site stays up)"
gcloud run services update "$SERVICE" --region="$REGION" --update-secrets=AI_GURU_CRON_SECRET=ai-guru-cron-secret:latest >/dev/null
URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')

say "4/4 The daily job: every day at $REMINDER_TIME India time"
ARGS=(--location="$REGION" --schedule="$((10#$MM)) $((10#$HH)) * * *" --time-zone="Asia/Kolkata"
  --uri="$URL/api/ai-guru/cron/fee-reminders" --http-method=POST
  --attempt-deadline=300s --max-retry-attempts=3 --min-backoff=60s)
if gcloud scheduler jobs describe "$JOB" --location="$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB" "${ARGS[@]}" --update-headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" >/dev/null
else
  gcloud scheduler jobs create http "$JOB" "${ARGS[@]}" --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" --message-body='{}' >/dev/null
fi

echo "Trying it once now…"
gcloud scheduler jobs run "$JOB" --location="$REGION"
sleep 20
echo "Done. Open the office page → Students management → ⏰ Fees due: it shows when the daily run last happened."
echo "Change the time later with:  REMINDER_TIME=07:30 PROJECT_ID=$PROJECT_ID bash scripts/cloud/setup-daily-reminders.sh"
